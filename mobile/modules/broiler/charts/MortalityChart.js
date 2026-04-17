import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Activity } from 'lucide-react-native';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import useThemeStore from '@/stores/themeStore';
import { colorForIndex } from '@/modules/broiler/components/HouseColors';

const CHART_HEIGHT = 220;
const MUTED = 'hsl(150, 10%, 45%)';

function getCycleDay(log, startDate) {
  if (log.cycleDay != null) return log.cycleDay;
  if (!log.logDate || !startDate) return 0;
  const ms = new Date(log.logDate) - new Date(startDate);
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export default function MortalityChart({
  dailyLogs = [],
  houses = [],
  startDate,
  view = 'cumulative',
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const [pinIdx, setPinIdx] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const axisColor = resolvedTheme === 'dark' ? '#2a3a2a' : '#dfe7df';
  const labelColor = MUTED;

  const { housesMeta, dayLabels, seriesByHouse, hasData } = useMemo(() => {
    const meta = houses.map((h, i) => {
      const houseId = typeof h.house === 'object' ? h.house?._id : h.house;
      return {
        id: houseId || `h${i}`,
        name: (typeof h.house === 'object' ? h.house?.name : null) || h.name || `House ${i + 1}`,
        color: colorForIndex(i),
      };
    });
    const idToIdx = Object.fromEntries(meta.map((m, i) => [m.id, i]));

    const logs = (dailyLogs || []).filter(
      (log) => log.logType === 'DAILY' && log.deaths != null && !log.deletedAt
    );
    if (!logs.length) return { housesMeta: meta, dayLabels: [], seriesByHouse: [], hasData: false };

    const byDay = {};
    logs.forEach((log) => {
      const houseId = log.house?._id || log.house;
      const idx = idToIdx[houseId];
      if (idx == null) return;
      const day = getCycleDay(log, startDate);
      if (!byDay[day]) byDay[day] = new Array(meta.length).fill(0);
      byDay[day][idx] += log.deaths || 0;
    });

    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    if (!days.length) return { housesMeta: meta, dayLabels: [], seriesByHouse: [], hasData: false };

    const maxDay = Math.max(1, days[days.length - 1]);
    const labels = [];
    const cumulative = new Array(meta.length).fill(0);
    const series = meta.map(() => []);

    for (let d = 1; d <= maxDay; d++) {
      labels.push(d);
      const dayValues = byDay[d] || new Array(meta.length).fill(0);
      meta.forEach((_m, i) => {
        cumulative[i] += dayValues[i];
        const value = view === 'cumulative' ? cumulative[i] : dayValues[i];
        series[i].push(value);
      });
    }

    return { housesMeta: meta, dayLabels: labels, seriesByHouse: series, hasData: true };
  }, [dailyLogs, houses, startDate, view]);

  // X-axis ticks: even round-number steps (1, 7, 14, 21, ...) anchored at day 1,
  // chosen so visible labels are at least ~55px apart and never overlap.
  const xAxisLabelTexts = useMemo(() => {
    const n = dayLabels.length;
    if (n === 0) return [];
    const usable = Math.max(0, (containerWidth || 320) - 48);
    const minPx = 55;
    const maxLabels = Math.max(2, Math.floor(usable / minPx));
    const rawStep = Math.ceil(n / Math.max(1, maxLabels - 1));
    const niceSteps = [1, 2, 5, 7, 10, 14, 20, 25, 30, 50, 100];
    const step = niceSteps.find((s) => s >= rawStep) || rawStep;
    return dayLabels.map((d, i) => ((i === 0 || (i + 1) % step === 0) ? `${d}` : ''));
  }, [dayLabels, containerWidth]);

  // Y-axis max across all houses, rounded up to a tick that divides cleanly
  // into noOfSections (4) sections, with ~10% headroom above the real max.
  const yMax = useMemo(() => {
    let max = 0;
    seriesByHouse.forEach((s) => s.forEach((v) => { if (v > max) max = v; }));
    return niceCeil(max, 4);
  }, [seriesByHouse]);

  if (!hasData) {
    return (
      <View className="items-center justify-center" style={{ height: CHART_HEIGHT }}>
        <View className="rounded-full bg-muted p-3 mb-2">
          <Activity size={20} color={MUTED} />
        </View>
        <Text className="text-sm font-medium text-foreground">
          {t('charts.noData', 'No mortality data yet')}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {t('charts.noDataHint', 'Add daily logs to see trends')}
        </Text>
      </View>
    );
  }

  const yAxisWidth = 40;
  const sidePad = 12;
  const availableWidth = Math.max(0, containerWidth);
  const innerWidth = Math.max(0, availableWidth - yAxisWidth - sidePad);
  const spacing = dayLabels.length > 1
    ? Math.max(4, Math.floor(innerWidth / (dayLabels.length - 1)))
    : 0;

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w !== containerWidth) setContainerWidth(w);
      }}
    >
      {availableWidth === 0 ? (
        <View style={{ height: CHART_HEIGHT }} />
      ) : view === 'daily' ? (
        <DailyDeathsBarChart
          housesMeta={housesMeta}
          dayLabels={dayLabels}
          xAxisLabelTexts={xAxisLabelTexts}
          seriesByHouse={seriesByHouse}
          availableWidth={availableWidth}
          spacing={spacing}
          yAxisWidth={yAxisWidth}
          yMax={yMax}
          axisColor={axisColor}
          labelColor={labelColor}
          pinIdx={pinIdx}
          setPinIdx={setPinIdx}
        />
      ) : (
        <CumulativeLineChart
          housesMeta={housesMeta}
          dayLabels={dayLabels}
          xAxisLabelTexts={xAxisLabelTexts}
          seriesByHouse={seriesByHouse}
          availableWidth={availableWidth}
          spacing={spacing}
          yAxisWidth={yAxisWidth}
          yMax={yMax}
          axisColor={axisColor}
          labelColor={labelColor}
          pinIdx={pinIdx}
          setPinIdx={setPinIdx}
        />
      )}
    </View>
  );
}

function CumulativeLineChart({
  housesMeta, dayLabels, xAxisLabelTexts, seriesByHouse, availableWidth, spacing, yAxisWidth, yMax, axisColor, labelColor, pinIdx, setPinIdx,
}) {
  const dataProps = useMemo(() => buildLineDataProps(seriesByHouse), [seriesByHouse]);
  const pointerConfig = useMemo(
    () => ({
      pointerStripWidth: 1.5,
      pointerStripHeight: CHART_HEIGHT,
      pointerStripColor: 'rgba(150, 150, 150, 0.55)',
      pointerStripUptoDataPoint: false,
      pointerColor: housesMeta[0]?.color || 'hsl(148, 60%, 20%)',
      radius: 4,
      activatePointersInstantlyOnTouch: true,
      autoAdjustPointerLabelPosition: true,
      persistPointer: true,
      pointerVanishDelay: 0,
      pointerLabelComponent: (_items, _secondary, idx) => {
        if (typeof idx === 'number') {
          setTimeout(() => setPinIdx(idx), 0);
        }
        return null;
      },
    }),
    [housesMeta, setPinIdx]
  );

  return (
    <View>
      <View style={{ width: availableWidth, overflow: 'hidden' }}>
        <LineChart
          data={dataProps.data}
          data2={dataProps.data2}
          data3={dataProps.data3}
          data4={dataProps.data4}
          data5={dataProps.data5}
          data6={dataProps.data6}
          data7={dataProps.data7}
          data8={dataProps.data8}
          color1={housesMeta[0]?.color}
          color2={housesMeta[1]?.color}
          color3={housesMeta[2]?.color}
          color4={housesMeta[3]?.color}
          color5={housesMeta[4]?.color}
          color6={housesMeta[5]?.color}
          color7={housesMeta[6]?.color}
          color8={housesMeta[7]?.color}
          xAxisLabelTexts={xAxisLabelTexts}
          thickness={2}
          curved
          height={CHART_HEIGHT}
          initialSpacing={0}
          endSpacing={6}
          spacing={spacing}
          yAxisLabelWidth={yAxisWidth}
          maxValue={yMax || undefined}
          hideRules={false}
          rulesType="solid"
          rulesColor={axisColor}
          yAxisColor={axisColor}
          xAxisColor={axisColor}
          yAxisTextStyle={{ color: labelColor, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: labelColor, fontSize: 10, width: 30, textAlign: 'center', marginLeft: -15 }}
          noOfSections={4}
          formatYLabel={(v) => abbrev(Number(v))}
          hideDataPoints
          pointerConfig={pointerConfig}
        />
      </View>
      <FocusReadout
        pinIdx={pinIdx}
        dayLabels={dayLabels}
        seriesByHouse={seriesByHouse}
        housesMeta={housesMeta}
      />
      <Legend housesMeta={housesMeta} />
    </View>
  );
}

function DailyDeathsBarChart({
  housesMeta, dayLabels, xAxisLabelTexts, seriesByHouse, availableWidth, spacing, yAxisWidth, yMax, axisColor, labelColor, pinIdx, setPinIdx,
}) {
  const stackData = useMemo(() => {
    return dayLabels.map((_day, i) => {
      const stacks = housesMeta.map((m, hIdx) => ({
        value: seriesByHouse[hIdx][i] || 0,
        color: m.color,
      })).filter((s) => s.value > 0);
      return {
        stacks: stacks.length > 0 ? stacks : [{ value: 0, color: 'transparent' }],
      };
    });
  }, [dayLabels, seriesByHouse, housesMeta]);

  // For stacked bars, yMax must be the tallest stack, not single-series max.
  const stackYMax = useMemo(() => {
    let max = 0;
    dayLabels.forEach((_d, i) => {
      const sum = housesMeta.reduce((acc, _m, hIdx) => acc + (seriesByHouse[hIdx][i] || 0), 0);
      if (sum > max) max = sum;
    });
    return niceCeil(max, 4);
  }, [dayLabels, seriesByHouse, housesMeta]);

  const barWidth = Math.max(3, Math.floor(spacing * 0.6));
  const barSpacing = Math.max(1, spacing - barWidth);

  return (
    <View>
      <View style={{ width: availableWidth, overflow: 'hidden' }}>
        <BarChart
          stackData={stackData}
          xAxisLabelTexts={xAxisLabelTexts}
          height={CHART_HEIGHT}
          barWidth={barWidth}
          spacing={barSpacing}
          initialSpacing={0}
          endSpacing={6}
          yAxisLabelWidth={yAxisWidth}
          maxValue={stackYMax || undefined}
          rulesType="solid"
          rulesColor={axisColor}
          yAxisColor={axisColor}
          xAxisColor={axisColor}
          yAxisTextStyle={{ color: labelColor, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: labelColor, fontSize: 10, width: 30, textAlign: 'center', marginLeft: -15 }}
          noOfSections={4}
          formatYLabel={(v) => abbrev(Number(v))}
          highlightedBarIndex={pinIdx ?? -1}
          highlightedBarConfig={{ color: 'rgba(150, 150, 150, 0.18)' }}
          onPress={(_item, idx) => setPinIdx(idx)}
        />
      </View>
      <FocusReadout
        pinIdx={pinIdx}
        dayLabels={dayLabels}
        seriesByHouse={seriesByHouse}
        housesMeta={housesMeta}
      />
      <Legend housesMeta={housesMeta} />
    </View>
  );
}

function buildLineDataProps(seriesByHouse) {
  const props = {};
  const keys = ['data', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7', 'data8'];
  seriesByHouse.slice(0, 8).forEach((series, hIdx) => {
    props[keys[hIdx]] = series.map((value) => ({ value }));
  });
  return props;
}

function FocusReadout({ pinIdx, dayLabels, seriesByHouse, housesMeta }) {
  if (pinIdx == null || pinIdx < 0 || pinIdx >= dayLabels.length) {
    return (
      <Text className="text-[11px] text-muted-foreground mt-2">
        Tap chart to inspect a day
      </Text>
    );
  }
  return (
    <View className="mt-2 rounded-md border border-border bg-muted/30 p-2">
      <Text className="text-[11px] font-semibold text-foreground tabular-nums">
        Day {dayLabels[pinIdx]}
      </Text>
      <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-1">
        {housesMeta.map((m, i) => (
          <View key={m.id} className="flex-row items-center gap-1.5">
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
            <Text className="text-[11px] text-foreground tabular-nums">
              {m.name}: {(seriesByHouse[i][pinIdx] || 0).toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legend({ housesMeta }) {
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-3">
      {housesMeta.map((m) => (
        <View key={m.id} className="flex-row items-center gap-1.5">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{m.name}</Text>
        </View>
      ))}
    </View>
  );
}

function abbrev(n) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(n)}`;
}

// Round `max` up to a y-axis ceiling that gives ~10% headroom and divides
// cleanly into `sections` equal increments. Each tick falls on a "nice"
// number (1, 2, 2.5, or 5 times the magnitude) so labels stay legible.
function niceCeil(max, sections = 4) {
  if (!max || max <= 0) return 0;
  const target = max * 1.1;
  const perSection = target / sections;
  const magnitude = Math.pow(10, Math.floor(Math.log10(perSection)));
  const ratio = perSection / magnitude;
  let niceStep;
  if (ratio <= 1) niceStep = 1;
  else if (ratio <= 2) niceStep = 2;
  else if (ratio <= 2.5) niceStep = 2.5;
  else if (ratio <= 5) niceStep = 5;
  else niceStep = 10;
  const step = niceStep * magnitude;
  return Math.ceil(target / step) * step;
}
