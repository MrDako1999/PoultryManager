import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Activity, Wheat, Droplets } from 'lucide-react';

const HOUSE_COLORS = [
  'hsl(142, 71%, 35%)',
  'hsl(221, 83%, 53%)',
  'hsl(25, 95%, 53%)',
  'hsl(280, 67%, 50%)',
  'hsl(350, 89%, 50%)',
  'hsl(190, 90%, 40%)',
  'hsl(45, 93%, 47%)',
  'hsl(330, 65%, 55%)',
];

function getHouseId(entry) {
  const h = entry.house;
  return typeof h === 'object' ? h?._id : h;
}

function getHouseName(entry, fallback) {
  const h = entry.house;
  return (typeof h === 'object' ? h?.name : null) || fallback;
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium mb-1.5">Day {label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium tabular-nums">
            {Number(entry.value).toLocaleString('en-US')} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

const METRIC_TABS = [
  { key: 'feed', icon: Wheat },
  { key: 'water', icon: Droplets },
];

const VIEW_TABS = [
  { key: 'cumulative', icon: Activity },
  { key: 'daily', icon: BarChart3 },
];

export default function ConsumptionCharts({ houses, dailyLogs }) {
  const { t } = useTranslation();
  const [activeMetric, setActiveMetric] = useState('feed');
  const [activeView, setActiveView] = useState('cumulative');

  const { housesMeta, chartData, hasData } = useMemo(() => {
    if (!houses?.length) return { housesMeta: [], chartData: [], hasData: false };

    const meta = houses.map((entry, i) => ({
      id: getHouseId(entry),
      name: getHouseName(entry, `House ${i + 1}`),
      color: HOUSE_COLORS[i % HOUSE_COLORS.length],
    }));

    const dailyLogs_ = (dailyLogs || []).filter(
      (log) => log.logType === 'DAILY' && !log.deletedAt &&
        (log.feedKg != null || log.waterLiters != null)
    );

    if (!dailyLogs_.length) return { housesMeta: meta, chartData: [], hasData: false };

    const feedByHouseDay = {};
    const waterByHouseDay = {};
    const allDays = new Set();

    dailyLogs_.forEach((log) => {
      const hId = typeof log.house === 'object' ? log.house?._id : log.house;
      const day = log.cycleDay || 1;
      const key = `${hId}_${day}`;
      allDays.add(day);
      if (log.feedKg != null) feedByHouseDay[key] = (feedByHouseDay[key] || 0) + log.feedKg;
      if (log.waterLiters != null) waterByHouseDay[key] = (waterByHouseDay[key] || 0) + log.waterLiters;
    });

    const sortedDays = [...allDays].sort((a, b) => a - b);
    const minDay = sortedDays[0];
    const maxDay = sortedDays[sortedDays.length - 1];
    const fullDayRange = [];
    for (let d = minDay; d <= maxDay; d++) fullDayRange.push(d);

    const cumFeed = {};
    const cumWater = {};
    meta.forEach((h) => { cumFeed[h.id] = 0; cumWater[h.id] = 0; });

    const data = fullDayRange.map((day) => {
      const point = { cycleDay: day };
      meta.forEach((h) => {
        const feed = feedByHouseDay[`${h.id}_${day}`] || 0;
        const water = waterByHouseDay[`${h.id}_${day}`] || 0;
        point[`dailyFeed_${h.id}`] = feed;
        point[`dailyWater_${h.id}`] = water;
        cumFeed[h.id] += feed;
        cumWater[h.id] += water;
        point[`cumFeed_${h.id}`] = cumFeed[h.id];
        point[`cumWater_${h.id}`] = cumWater[h.id];
      });
      return point;
    });

    return { housesMeta: meta, chartData: data, hasData: true };
  }, [houses, dailyLogs]);

  if (!houses?.length) return null;

  const metricLabels = {
    feed: t('charts.feedConsumption', 'Feed Consumption'),
    water: t('charts.waterConsumption', 'Water Consumption'),
  };

  const viewLabels = {
    cumulative: t('charts.cumulative', 'Cumulative'),
    daily: t('charts.daily', 'Daily'),
  };

  const unit = activeMetric === 'feed' ? 'kg' : 'L';
  const dailyKey = activeMetric === 'feed' ? 'dailyFeed' : 'dailyWater';
  const cumKey = activeMetric === 'feed' ? 'cumFeed' : 'cumWater';

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center justify-center text-center">
          <Wheat className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('charts.noConsumptionData', 'No feed or water data recorded yet')}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t('charts.noConsumptionHint', 'Add daily logs with feed/water entries to see consumption charts')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold">
              {metricLabels[activeMetric]}
            </CardTitle>
            <Tabs value={activeMetric} onValueChange={setActiveMetric}>
              <TabsList className="h-8">
                {METRIC_TABS.map(({ key, icon: Icon }) => (
                  <TabsTrigger key={key} value={key} className="h-6 px-2.5 text-xs gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{metricLabels[key]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList className="h-8">
              {VIEW_TABS.map(({ key, icon: Icon }) => (
                <TabsTrigger key={key} value={key} className="h-6 px-2.5 text-xs gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{viewLabels[key]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[300px] sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            {activeView === 'cumulative' ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="cycleDay"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{ value: t('charts.cycleDay', 'Cycle Day'), position: 'insideBottom', offset: -2, fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(v) => v.toLocaleString('en-US')}
                />
                <RechartsTooltip content={<CustomTooltip unit={unit} />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
                {housesMeta.map((h) => (
                  <Area
                    key={h.id}
                    type="monotone"
                    dataKey={`${cumKey}_${h.id}`}
                    name={h.name}
                    stroke={h.color}
                    fill={h.color}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: h.color }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  />
                ))}
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="cycleDay"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{ value: t('charts.cycleDay', 'Cycle Day'), position: 'insideBottom', offset: -2, fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <RechartsTooltip content={<CustomTooltip unit={unit} />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
                {housesMeta.map((h) => (
                  <Bar
                    key={h.id}
                    dataKey={`${dailyKey}_${h.id}`}
                    name={h.name}
                    fill={h.color}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
