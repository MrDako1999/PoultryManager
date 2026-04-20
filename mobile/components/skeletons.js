import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Skeleton, { SkeletonText } from './ui/Skeleton';
import { useHeroSheetTokens } from './HeroSheetScreen';

// -----------------------------------------------------------------------------
// Design-language helpers — wrappers that mirror the real cards' structure
// (SheetSection eyebrow + elevated card body) so loading states feel like
// the page is settling into place rather than appearing from nowhere.
// -----------------------------------------------------------------------------

function SectionEyebrow({ width = '40%' }) {
  return (
    <View style={designStyles.eyebrowRow}>
      <Skeleton width={13} height={13} borderRadius={3} />
      <SkeletonText width={width} height={11} />
    </View>
  );
}

function ElevatedCard({ children, style }) {
  const { elevatedCardBg, elevatedCardBorder, dark } = useHeroSheetTokens();
  return (
    <View
      style={[
        designStyles.elevatedCard,
        {
          backgroundColor: elevatedCardBg,
          borderColor: elevatedCardBorder,
          ...(dark
            ? {}
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function StatGrid({ count = 3 }) {
  const { borderColor } = useHeroSheetTokens();
  return (
    <View style={[designStyles.statGrid, { borderTopColor: borderColor }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={designStyles.statCellWrap}>
          {i > 0 ? (
            <View style={[designStyles.statDivider, { backgroundColor: borderColor }]} />
          ) : null}
          <View style={designStyles.statCell}>
            <View style={designStyles.statLabelRow}>
              <Skeleton width={11} height={11} borderRadius={3} />
              <SkeletonText width="60%" height={9} />
            </View>
            <SkeletonText width="70%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function KpiCardSkeleton({ withHeadline = true, withSubline = true, withChildren = false, statsCount = 3, eyebrowWidth }) {
  return (
    <View style={designStyles.sectionWrap}>
      <SectionEyebrow width={eyebrowWidth} />
      <ElevatedCard>
        {withHeadline ? (
          <Skeleton width="55%" height={28} borderRadius={6} />
        ) : null}
        {withSubline ? (
          <View style={{ marginTop: 6 }}>
            <SkeletonText width="40%" height={12} />
          </View>
        ) : null}
        {withChildren ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            <Skeleton width="100%" height={6} borderRadius={3} />
            <Skeleton width="100%" height={6} borderRadius={3} />
          </View>
        ) : null}
        {statsCount > 0 ? <StatGrid count={statsCount} /> : null}
      </ElevatedCard>
    </View>
  );
}

function ListRowSkeleton({ isLast = false }) {
  const { borderColor } = useHeroSheetTokens();
  return (
    <View
      style={[
        designStyles.listRow,
        !isLast ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor } : null,
      ]}
    >
      <Skeleton width={32} height={32} borderRadius={10} />
      <View style={designStyles.listRowTextCol}>
        <SkeletonText width="55%" height={14} />
        <SkeletonText width="35%" height={11} />
      </View>
      <Skeleton width={16} height={16} borderRadius={4} />
    </View>
  );
}

function ListSectionSkeleton({ rows = 4 }) {
  return (
    <View style={designStyles.sectionWrap}>
      <ElevatedCard style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <ListRowSkeleton key={i} isLast={i === rows - 1} />
        ))}
      </ElevatedCard>
    </View>
  );
}

function FilterChipsSkeleton() {
  return (
    <View style={designStyles.chipsRow}>
      {[64, 88, 80, 72].map((w, i) => (
        <Skeleton key={i} width={w} height={36} borderRadius={999} />
      ))}
    </View>
  );
}

function SearchBarSkeleton() {
  return (
    <View style={designStyles.searchWrap}>
      <Skeleton width="100%" height={44} borderRadius={14} />
    </View>
  );
}

export function SkeletonStatCard() {
  return (
    <View style={designStyles.legacyStatCard}>
      <SkeletonText width="55%" height={10} />
      <Skeleton width="70%" height={18} borderRadius={4} />
    </View>
  );
}

/**
 * SkeletonRow — design-language batch list row used by BatchesList loading.
 * Mirrors the BatchListCard recipe: avatar tile + title + meta + chevron.
 */
export function SkeletonRow() {
  const { borderColor } = useHeroSheetTokens();
  return (
    <View style={[designStyles.listRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]}>
      <Skeleton width={44} height={44} borderRadius={14} />
      <View style={designStyles.listRowTextCol}>
        <SkeletonText width="55%" height={14} />
        <SkeletonText width="35%" height={11} />
      </View>
      <Skeleton width={16} height={16} borderRadius={4} />
    </View>
  );
}

export function SkeletonSectionHeader() {
  return (
    <View className="rounded-lg border border-border bg-card overflow-hidden">
      <View className="flex-row items-center px-3 py-2.5 gap-2">
        <Skeleton width={16} height={16} borderRadius={3} />
        <SkeletonText width="40%" height={13} />
      </View>
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

export function SkeletonBatchDetail() {
  const insets = useSafeAreaInsets();
  const { screenBg, heroGradient, sheetBg, borderColor } = useHeroSheetTokens();
  // Use the lightest gradient stop as a flat color so the header reads as
  // the brand strip without animating the gradient itself.
  const headerBg = heroGradient[heroGradient.length - 1];
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {/* Header gradient strip — back btn + avatar + title block + edit btn */}
      <View
        style={{
          backgroundColor: headerBg,
          paddingTop: insets.top + 12,
          paddingBottom: 18,
          paddingHorizontal: 16,
        }}
      >
        <View style={designStyles.headerRow}>
          <View style={designStyles.headerTranslucent}>
            <Skeleton width={18} height={18} borderRadius={4} style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <View
              style={{
                width: '60%',
                height: 18,
                borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.32)',
              }}
            />
            <View
              style={{
                width: '40%',
                height: 11,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.22)',
              }}
            />
          </View>
          <View style={designStyles.headerTranslucent}>
            <Skeleton width={16} height={16} borderRadius={4} style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
          </View>
        </View>
      </View>

      {/* Tabs strip */}
      <View
        style={{
          backgroundColor: sheetBg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: borderColor,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <View style={designStyles.tabsRow}>
          {[64, 92, 70, 92, 80, 60].map((w, i) => (
            <Skeleton key={i} width={w} height={16} borderRadius={4} />
          ))}
        </View>
      </View>

      {/* Body — Overview-style cards */}
      <View style={{ padding: 0, paddingTop: 16, gap: 0 }}>
        <KpiCardSkeleton eyebrowWidth="35%" />
        <KpiCardSkeleton withChildren eyebrowWidth="48%" />
      </View>
    </View>
  );
}

export function SkeletonDetailPage() {
  return (
    <View className="flex-1 py-4 px-4 gap-4">
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Skeleton width={60} height={22} borderRadius={10} />
          <Skeleton width={80} height={22} borderRadius={10} />
        </View>
        <Skeleton width="65%" height={16} borderRadius={4} />
        <SkeletonText width="40%" height={12} />
      </View>

      <View className="rounded-lg border border-border bg-card p-3 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className="flex-row items-center justify-between">
            <SkeletonText width="30%" height={11} />
            <Skeleton width="40%" height={13} borderRadius={4} />
          </View>
        ))}
      </View>

      <View className="rounded-lg border border-border bg-card p-3 gap-3">
        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-row items-center justify-between">
            <SkeletonText width="35%" height={11} />
            <Skeleton width="30%" height={13} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonListScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3 border-b border-border gap-3">
        <View className="flex-row items-center gap-3">
          <Skeleton width={24} height={24} borderRadius={4} />
          <Skeleton width="40%" height={18} borderRadius={4} />
        </View>
        <Skeleton width="100%" height={38} borderRadius={8} />
      </View>
      <View>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonDashboardKpiHero() {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <SkeletonText width="25%" height={14} />
        <Skeleton width={180} height={28} borderRadius={6} />
      </View>

      {/* Flock + Net Profit — BatchKpiCard layout (headline + stat grid) */}
      <KpiCardSkeleton eyebrowWidth="14%" />
      <KpiCardSkeleton eyebrowWidth="32%" />
    </View>
  );
}

export function SkeletonDashboardBatchCard() {
  const { elevatedCardBg, elevatedCardBorder, dark } = useHeroSheetTokens();
  return (
    <View
      style={[
        designStyles.dashboardCard,
        {
          backgroundColor: elevatedCardBg,
          borderColor: elevatedCardBorder,
          ...(dark ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
            elevation: 2,
          }),
        },
      ]}
    >
      <View style={designStyles.dashboardCardHeader}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonText width="55%" height={14} />
          <SkeletonText width="35%" height={11} />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <SkeletonText width="40%" height={11} />
          <SkeletonText width={36} height={11} />
        </View>
        <Skeleton width="100%" height={5} borderRadius={3} />
      </View>
    </View>
  );
}

function SkeletonHeroCard({ rows = 0 }) {
  return (
    <View className="rounded-xl border border-border bg-card p-4 gap-2">
      <SkeletonText width="30%" height={10} />
      <Skeleton width="55%" height={26} borderRadius={6} />
      <SkeletonText width="20%" height={11} />
      {rows > 0 && (
        <View className="flex-row mt-3 pt-3 border-t border-border gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <View key={i} className="flex-1 gap-1.5">
              <SkeletonText width="60%" height={9} />
              <SkeletonText width="80%" height={13} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SkeletonBarRow() {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <SkeletonText width="25%" height={11} />
        <SkeletonText width="20%" height={11} />
      </View>
      <Skeleton width="100%" height={6} borderRadius={3} />
    </View>
  );
}

function SkeletonHouseRow() {
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-muted/40 px-2 py-2">
      <Skeleton width={11} height={11} borderRadius={2} />
      <View className="flex-1">
        <SkeletonText width="35%" height={11} />
      </View>
      <SkeletonText width={90} height={11} />
      <SkeletonText width={45} height={11} />
    </View>
  );
}

export function SkeletonBatchOverview() {
  const insets = useSafeAreaInsets();
  const { screenBg } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 120 }}>
        {/* Net Profit */}
        <KpiCardSkeleton eyebrowWidth="35%" />

        {/* Cycle Performance with per-house list */}
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="48%" />
          <ElevatedCard>
            <Skeleton width="55%" height={28} borderRadius={6} />
            <View style={{ marginTop: 6 }}>
              <SkeletonText width="50%" height={12} />
            </View>
            <View style={{ marginTop: 14 }}>
              <Skeleton width="100%" height={6} borderRadius={3} />
            </View>
            <View style={{ gap: 6, marginTop: 14 }}>
              {[0, 1, 2].map((i) => <SkeletonHouseRow key={i} />)}
            </View>
            <StatGrid count={3} />
          </ElevatedCard>
        </View>

        {/* Feed mix */}
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="20%" />
          <ElevatedCard>
            <Skeleton width="40%" height={28} borderRadius={6} />
            <View style={{ marginTop: 6 }}>
              <SkeletonText width="35%" height={12} />
            </View>
            <View style={{ gap: 10, marginTop: 14 }}>
              <SkeletonBarRow />
              <SkeletonBarRow />
              <SkeletonBarRow />
            </View>
          </ElevatedCard>
        </View>

        {/* Expenses by category */}
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="50%" />
          <ElevatedCard>
            <Skeleton width="45%" height={28} borderRadius={6} />
            <View style={{ gap: 10, marginTop: 14 }}>
              <SkeletonBarRow />
              <SkeletonBarRow />
              <SkeletonBarRow />
              <SkeletonBarRow />
            </View>
          </ElevatedCard>
        </View>
      </View>
    </View>
  );
}

function SkeletonChartCard() {
  return (
    <View className="rounded-lg border border-border bg-card p-3 gap-3">
      <View className="flex-row items-center justify-between">
        <SkeletonText width="40%" height={13} />
        <Skeleton width={70} height={28} borderRadius={6} />
      </View>
      <Skeleton width="100%" height={220} borderRadius={6} />
      <View className="flex-row gap-2">
        <SkeletonText width={60} height={10} />
        <SkeletonText width={60} height={10} />
        <SkeletonText width={60} height={10} />
      </View>
    </View>
  );
}

function SkeletonHouseSummaryCard() {
  return (
    <View className="rounded-xl border border-border bg-card p-3 gap-2">
      <View className="flex-row items-center gap-2">
        <Skeleton width={28} height={28} borderRadius={6} />
        <View className="flex-1">
          <SkeletonText width="40%" height={13} />
        </View>
        <Skeleton width={36} height={18} borderRadius={6} />
        <Skeleton width={14} height={14} borderRadius={3} />
      </View>
      <View className="flex-row items-center gap-2">
        <Skeleton width={70} height={18} borderRadius={4} />
        <SkeletonText width={50} height={11} />
      </View>
      <View className="flex-row pt-2 border-t border-border gap-2">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 gap-1">
            <SkeletonText width="60%" height={9} />
            <SkeletonText width="80%" height={11} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonBatchPerformance() {
  const insets = useSafeAreaInsets();
  const { screenBg } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 120 }}>
        {/* Mortality KPI */}
        <KpiCardSkeleton eyebrowWidth="22%" />
        {/* Consumption KPI */}
        <KpiCardSkeleton eyebrowWidth="28%" />
        {/* Two chart cards */}
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="38%" />
          <ElevatedCard>
            <View style={designStyles.chartHeaderRow}>
              <SkeletonText width="40%" height={14} />
              <Skeleton width={70} height={28} borderRadius={8} />
            </View>
            <Skeleton width="100%" height={200} borderRadius={6} />
          </ElevatedCard>
        </View>
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="40%" />
          <ElevatedCard>
            <View style={designStyles.chartHeaderRow}>
              <SkeletonText width="35%" height={14} />
              <Skeleton width={70} height={28} borderRadius={8} />
            </View>
            <View style={{ marginBottom: 14, alignItems: 'flex-end' }}>
              <Skeleton width={70} height={28} borderRadius={8} />
            </View>
            <Skeleton width="100%" height={200} borderRadius={6} />
          </ElevatedCard>
        </View>
        {/* Per-house raw data sections */}
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="44%" />
          <ElevatedCard style={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 }}>
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => <SkeletonHousePanel key={i} />)}
            </View>
          </ElevatedCard>
        </View>
      </View>
    </View>
  );
}

function SkeletonHousePanel() {
  const { elevatedCardBg, elevatedCardBorder } = useHeroSheetTokens();
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: elevatedCardBg,
        borderColor: elevatedCardBorder,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View style={designStyles.housePanelRow}>
        <Skeleton width={16} height={16} borderRadius={4} />
        <Skeleton width={14} height={14} borderRadius={3} />
        <View style={{ flex: 1 }}>
          <SkeletonText width="40%" height={14} />
        </View>
        <SkeletonText width={66} height={11} />
        <Skeleton width={32} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

export function SkeletonFarmPerformanceTab() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View
        style={{ padding: 16, paddingBottom: insets.bottom + 96, gap: 12 }}
      >
        <View className="rounded-xl border border-border bg-card p-4 gap-2">
          <SkeletonText width="25%" height={10} />
          <View className="flex-row items-center gap-2">
            <Skeleton width="35%" height={26} borderRadius={6} />
            <SkeletonText width="20%" height={11} />
          </View>
          <View className="flex-row pt-3 border-t border-border gap-2 mt-1">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-1 gap-1.5">
                <SkeletonText width="60%" height={9} />
                <SkeletonText width="80%" height={13} />
              </View>
            ))}
          </View>
        </View>

        <View className="rounded-xl border border-border bg-card p-4 gap-3">
          <SkeletonText width="30%" height={10} />
          <View className="flex-row gap-3">
            {[0, 1].map((i) => (
              <View key={i} className="flex-1 gap-1">
                <SkeletonText width="40%" height={9} />
                <Skeleton width="60%" height={22} borderRadius={4} />
              </View>
            ))}
          </View>
          <View className="flex-row pt-3 border-t border-border gap-2">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-1 gap-1.5">
                <SkeletonText width="60%" height={9} />
                <SkeletonText width="80%" height={13} />
              </View>
            ))}
          </View>
        </View>

        <SkeletonChartCard />
        <SkeletonChartCard />

        <SkeletonFarmCard />
        <SkeletonFarmCard />
        <SkeletonFarmCard />
      </View>
    </View>
  );
}

export function SkeletonSourcesTab() {
  const insets = useSafeAreaInsets();
  const { screenBg } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 120 }}>
        <KpiCardSkeleton eyebrowWidth="22%" />
        <SearchBarSkeleton />
        <ListSectionSkeleton rows={4} />
      </View>
    </View>
  );
}

export function SkeletonFeedOrdersTab() {
  const insets = useSafeAreaInsets();
  const { screenBg } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 120 }}>
        <View style={designStyles.sectionWrap}>
          <SectionEyebrow width="20%" />
          <ElevatedCard>
            <Skeleton width="50%" height={28} borderRadius={6} />
            <View style={{ marginTop: 6 }}>
              <SkeletonText width="35%" height={12} />
            </View>
            <View style={{ gap: 10, marginTop: 14 }}>
              <SkeletonBarRow />
              <SkeletonBarRow />
              <SkeletonBarRow />
            </View>
            <StatGrid count={3} />
          </ElevatedCard>
        </View>
        <FilterChipsSkeleton />
        <SearchBarSkeleton />
        <ListSectionSkeleton rows={4} />
      </View>
    </View>
  );
}

export function SkeletonExpensesTab() {
  const insets = useSafeAreaInsets();
  const { screenBg } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 120 }}>
        <KpiCardSkeleton eyebrowWidth="25%" statsCount={2} />
        <FilterChipsSkeleton />
        <SearchBarSkeleton />
        <ListSectionSkeleton rows={4} />
      </View>
    </View>
  );
}

export function SkeletonTransfersTab() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: 12, paddingBottom: insets.bottom + 96 }}>
        <View className="px-4 mb-3">
          <View className="rounded-xl border border-border bg-card p-4 gap-2">
            <SkeletonText width="25%" height={10} />
            <Skeleton width="55%" height={26} borderRadius={6} />
            <View className="flex-row pt-3 border-t border-border gap-2 mt-1">
              {[0, 1].map((i) => (
                <View key={i} className="flex-1 gap-1.5">
                  <SkeletonText width="60%" height={9} />
                  <SkeletonText width="80%" height={13} />
                </View>
              ))}
            </View>
          </View>
        </View>

        <FilterChipsSkeleton />

        <SearchBarSkeleton />

        <ListSectionSkeleton rows={4} />
      </View>
    </View>
  );
}

function SkeletonHeroCardWithStats({ headlineHeight = 26 }) {
  return (
    <View className="rounded-xl border border-border bg-card p-4 gap-2">
      <SkeletonText width="25%" height={10} />
      <Skeleton width="55%" height={headlineHeight} borderRadius={6} />
      <Skeleton width="100%" height={6} borderRadius={3} />
      <View className="flex-row pt-3 border-t border-border gap-2 mt-1">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 gap-1.5">
            <SkeletonText width="60%" height={9} />
            <SkeletonText width="70%" height={13} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonFarmCard() {
  return (
    <View className="rounded-xl border border-border bg-card p-3 gap-2">
      <View className="flex-row items-center gap-3">
        <Skeleton width={40} height={40} borderRadius={12} />
        <View className="flex-1 gap-1.5">
          <SkeletonText width="55%" height={13} />
          <SkeletonText width="35%" height={11} />
        </View>
        <Skeleton width={16} height={16} borderRadius={4} />
      </View>
      <View className="flex-row pt-2 border-t border-border gap-2">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 gap-1">
            <SkeletonText width="60%" height={9} />
            <SkeletonText width="50%" height={13} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonFarmDetail() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View className="flex-row gap-2">
          <Skeleton width={80} height={24} borderRadius={12} />
          <Skeleton width={140} height={24} borderRadius={12} />
        </View>

        <Skeleton width="100%" height={32} borderRadius={6} />

        <SkeletonHeroCardWithStats />
        <SkeletonHeroCardWithStats />

        <View className="rounded-xl border border-border bg-card p-4 gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <Skeleton width={16} height={16} borderRadius={4} />
              <SkeletonText width="20%" height={13} />
            </View>
            <SkeletonText width={70} height={11} />
          </View>
          {[0, 1, 2].map((i) => (
            <View key={i} className="rounded-md bg-muted/40 p-2 gap-1">
              <View className="flex-row items-center gap-2">
                <Skeleton width={12} height={12} borderRadius={2} />
                <View className="flex-1">
                  <SkeletonText width="35%" height={11} />
                </View>
                <SkeletonText width={70} height={11} />
              </View>
              <Skeleton width="100%" height={4} borderRadius={2} />
            </View>
          ))}
        </View>

        <View className="rounded-xl border border-border bg-card p-3 gap-2">
          <View className="flex-row items-start gap-3">
            <Skeleton width={36} height={36} borderRadius={8} />
            <View className="flex-1 gap-1.5">
              <SkeletonText width="50%" height={13} />
              <SkeletonText width="35%" height={11} />
            </View>
          </View>
          <Skeleton width="100%" height={6} borderRadius={3} />
          <View className="flex-row pt-2 border-t border-border gap-2">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-1 gap-1">
                <SkeletonText width="60%" height={9} />
                <SkeletonText width="70%" height={13} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export function SkeletonBusinessCard() {
  return (
    <View className="rounded-xl border border-border bg-card p-3 gap-2">
      <View className="flex-row items-center gap-3">
        <Skeleton width={40} height={40} borderRadius={12} />
        <View className="flex-1 gap-1.5">
          <SkeletonText width="55%" height={13} />
          <SkeletonText width="35%" height={11} />
        </View>
        <Skeleton width={16} height={16} borderRadius={4} />
      </View>
      <View className="flex-row pt-2 border-t border-border gap-2">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 gap-1">
            <SkeletonText width="60%" height={9} />
            <SkeletonText width="50%" height={13} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonContactCard() {
  return (
    <View className="rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center gap-3">
        <Skeleton width={40} height={40} borderRadius={20} />
        <View className="flex-1 gap-1.5">
          <SkeletonText width="55%" height={13} />
          <SkeletonText width="40%" height={11} />
        </View>
        <Skeleton width={48} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

function SkeletonCollapsibleSection() {
  return (
    <View className="rounded-lg border border-border bg-card overflow-hidden">
      <View className="flex-row items-center px-3 py-2.5 gap-2">
        <Skeleton width={16} height={16} borderRadius={3} />
        <Skeleton width={14} height={14} borderRadius={3} />
        <SkeletonText width="40%" height={13} />
      </View>
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

export function SkeletonBusinessDetail() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View className="flex-row gap-2">
          <Skeleton width={140} height={24} borderRadius={12} />
          <Skeleton width={100} height={24} borderRadius={12} />
        </View>

        <Skeleton width="100%" height={32} borderRadius={6} />

        <SkeletonHeroCardWithStats />
        <SkeletonHeroCardWithStats />

        <SkeletonCollapsibleSection />
        <SkeletonCollapsibleSection />
      </View>
    </View>
  );
}

const designStyles = StyleSheet.create({
  sectionWrap: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginLeft: 6,
  },
  elevatedCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statGrid: {
    flexDirection: 'row',
    paddingTop: 14,
    paddingBottom: 2,
    borderTopWidth: 1,
    marginTop: 14,
  },
  statCellWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  legacyStatCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listRowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTranslucent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  housePanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dashboardCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 14,
  },
  dashboardCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
