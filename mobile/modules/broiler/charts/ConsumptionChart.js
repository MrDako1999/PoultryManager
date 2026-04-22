import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Wheat, Droplets } from 'lucide-react-native';
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

export default function ConsumptionChart({
  dailyLogs = [],
  houses = [],
  startDate,
  metric = 'feed',
  view = 'cumulative',
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const [pinIdx, setPinIdx] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const valueKey = metric === 'feed' ? 'feedKg' : 'waterLiters';
  const unit = metric === 'feed' ? 'kg' : 'L';
  const Icon = metric === 'feed' ? Wheat : Droplets;
  const emptyTitle = metric === 'feed'
    ? t('charts.noFeedData', 'No feed data yet')
    : t('charts.noWaterData', 'No water data yet');

  const axisColor = resolvedTheme === 'dark' ? '#2a3a2a' : '#dfe7df';

  const { housesMeta, dayLabels, seriesByHouse, hasData } = useMemo(() => {
    const meta = houses.map((h, i) => {
      const houseId = typeof h.house === 'object' ? h.house?._id : h.house;
      return {
        id: houseId || `h${i}`,
        name: (typeof h.house === 'object' ? h.house?.name : null)
          || h.name
          || t('farms.houseN', 'House {{n}}', { n: i + 1 }),
        color: colorForIndex(i),
      };
    });
    const idToIdx = Object.fromEntries(meta.map((m, i) => [m.id, i]));

    const logs = (dailyLogs || []).filter(
      (log) => log.logType === 'DAILY' && !log.deletedAt && log[valueKey] != null
    );
    if (!logs.length) return { housesMeta: meta, dayLabels: [], seriesByHouse: [], hasData: false };

    const byDay = {};
    logs.forEach((log) => {
      const houseId = log.house?._id || log.house;
      const idx = idToIdx[houseId];
      if (idx == null) return;
      const day = getCycleDay(log, startDate);
      if (!byDay[day]) byDay[day] = new Array(meta.length).fill(0);
      byDay[day][idx] += log[valueKey] || 0;
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
  }, [dailyLogs, houses, startDate, view, valueKey, t]);

  if (!hasData) {
    return (
      <View className="items-center justify-center" style={{ height: CHART_HEIGHT }}>
        <View className="rounded-full bg-muted p-3 mb-2">
          <Icon size={20} color={MUTED} />
        </View>
        <Text className="text-sm font-medium text-foreground">{emptyTitle}</Text>
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

  const xAxisLabelTexts = (() => {
    const n = dayLabels.length;
    if (n === 0) return [];
    const usable = Math.max(0, (containerWidth || 320) - 48);
    const minPx = 55;
    const maxLabels = Math.max(2, Math.floor(usable / minPx));
    const rawStep = Math.ceil(n / Math.max(1, maxLabels - 1));
    const niceSteps = [1, 2, 5, 7, 10, 14, 20, 25, 30, 50, 100];
    const step = niceSteps.find((s) => s >= rawStep) || rawStep;
    return dayLabels.map((d, i) => ((i === 0 || (i + 1) % step === 0) ? `${d}` : ''));
  })();

  // Y-axis max derived from data so all series fit with ~10% headroom and
  // ticks fall on round numbers.
  let yMax = 0;
  if (view === 'cumulative') {
    seriesByHouse.forEach((s) => s.forEach((v) => { if (v > yMax) yMax = v; }));
  } else {
    dayLabels.forEach((_d, i) => {
      const sum = housesMeta.reduce((acc, _m, hIdx) => acc + (seriesByHouse[hIdx][i] || 0), 0);
      if (sum > yMax) yMax = sum;
    });
  }
  yMax = niceCeil(yMax, 4);

  let chartContent = null;

  if (availableWidth > 0) {
    if (view === 'daily') {
      const stackData = dayLabels.map((_day, i) => {
        const stacks = housesMeta.map((m, hIdx) => ({
          value: seriesByHouse[hIdx][i] || 0,
          color: m.color,
        })).filter((s) => s.value > 0);
        return {
          stacks: stacks.length > 0 ? stacks : [{ value: 0, color: 'transparent' }],
        };
      });

      const barWidth = Math.max(3, Math.floor(spacing * 0.6));
      const barSpacing = Math.max(1, spacing - barWidth);

      chartContent = (
        <BarChart
          stackData={stackData}
          xAxisLabelTexts={xAxisLabelTexts}
          height={CHART_HEIGHT}
          barWidth={barWidth}
          spacing={barSpacing}
          initialSpacing={0}
          endSpacing={6}
          yAxisLabelWidth={yAxisWidth}
          rulesType="solid"
          rulesColor={axisColor}
          yAxisColor={axisColor}
          xAxisColor={axisColor}
          yAxisTextStyle={{ color: MUTED, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: MUTED, fontSize: 10, width: 30, textAlign: 'center', marginLeft: -15 }}
          noOfSections={4}
          maxValue={yMax || undefined}
          formatYLabel={(v) => abbrev(Number(v))}
          highlightedBarIndex={pinIdx ?? -1}
          highlightedBarConfig={{ color: 'rgba(150, 150, 150, 0.18)' }}
          onPress={(_item, idx) => setPinIdx(idx)}
        />
      );
    } else {
      const lineData = buildLineDataProps(seriesByHouse);
      const pointerConfig = {
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
      };
      chartContent = (
        <LineChart
          data={lineData.data}
          data2={lineData.data2}
          data3={lineData.data3}
          data4={lineData.data4}
          data5={lineData.data5}
          data6={lineData.data6}
          data7={lineData.data7}
          data8={lineData.data8}
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
          hideRules={false}
          rulesType="solid"
          rulesColor={axisColor}
          yAxisColor={axisColor}
          xAxisColor={axisColor}
          yAxisTextStyle={{ color: MUTED, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: MUTED, fontSize: 10, width: 30, textAlign: 'center', marginLeft: -15 }}
          noOfSections={4}
          maxValue={yMax || undefined}
          formatYLabel={(v) => abbrev(Number(v))}
          hideDataPoints
          pointerConfig={pointerConfig}
        />
      );
    }
  }

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w !== containerWidth) setContainerWidth(w);
      }}
    >
      {chartContent ? (
        // Force LTR direction inside the chart so iOS doesn't auto-flip
        // the absolutely-positioned pointer line / labels while leaving
        // the SVG-rendered curves in their original LTR pixel space.
        // Without this, the selection line and the data dots end up at
        // different X positions in RTL — see MortalityChart for the same
        // fix and the user's RTL screenshot for the bug.
        <View
          style={{
            width: availableWidth,
            overflow: 'hidden',
            direction: 'ltr',
          }}
        >
          {chartContent}
        </View>
      ) : (
        <View style={{ height: CHART_HEIGHT }} />
      )}
      <FocusReadout
        pinIdx={pinIdx}
        dayLabels={dayLabels}
        seriesByHouse={seriesByHouse}
        housesMeta={housesMeta}
        unit={unit}
      />
      <Legend housesMeta={housesMeta} unit={unit} />
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

function FocusReadout({ pinIdx, dayLabels, seriesByHouse, housesMeta, unit }) {
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
              {m.name}: {(seriesByHouse[i][pinIdx] || 0).toLocaleString()} {unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legend({ housesMeta, unit }) {
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-3">
      {housesMeta.map((m) => (
        <View key={m.id} className="flex-row items-center gap-1.5">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
            {m.name} ({unit})
          </Text>
        </View>
      ))}
    </View>
  );
}

function abbrev(n) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(n)}`;
}

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
