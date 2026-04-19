import { useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  Search, ChevronDown, X, RotateCcw, Calendar,
  Layers, BarChart3,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useSettings from '@/hooks/useSettings';
import SheetInput from '@/components/SheetInput';
import BottomPickerSheet from '@/components/BottomPickerSheet';
import DateRangePicker from '@/components/ui/DateRangePicker';
import BatchKpiCard from '@/modules/broiler/components/BatchKpiCard';
import { KpiCardSkeleton } from '@/components/skeletons';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * AccountingHero — KPI card (currency + total + Entries / Average stats).
 * Renders skeleton while initial data loads. This piece is meant to scroll
 * away when the user starts browsing the list, so it's a standalone
 * component decoupled from the toolbar.
 */
export function AccountingHero({
  HeaderIcon,
  heroTitle,
  count = 0,
  total = 0,
  allCount = 0,
  search,
  filters = [],
  dateRange,
  loading = false,
  // Optional extra stat cells inserted BEFORE the default Entries/Average
  // pair. Each entry follows the BatchKpiCard `stats[i]` shape:
  // { icon, label, value }. Used by BroilerSalesView to surface the
  // total birds sold alongside revenue.
  extraStats = [],
}) {
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const dateRangeActive = !!(dateRange?.from || dateRange?.to);
  const activeFilterCount = useMemo(() => {
    let n = 0;
    filters.forEach((f) => { n += (f.values?.length || 0); });
    if (dateRangeActive) n += 1;
    return n;
  }, [filters, dateRangeActive]);
  const hasAnyFilter = !!(search || activeFilterCount > 0);

  if (loading && allCount === 0) {
    return (
      <View style={styles.heroWrap}>
        <KpiCardSkeleton statsCount={2} eyebrowWidth="35%" />
      </View>
    );
  }

  return (
    <View style={styles.heroWrap}>
      <BatchKpiCard
        title={heroTitle}
        icon={HeaderIcon}
        headlinePrefix={currency}
        headline={fmt(total)}
        subline={hasAnyFilter
          ? t('accounting.showingOf', '{{shown}} of {{total}}', {
              shown: fmtInt(count), total: fmtInt(allCount),
            })
          : null}
        stats={[
          ...extraStats,
          {
            icon: Layers,
            label: t('batches.entries', 'Entries'),
            value: fmtInt(count),
          },
          {
            icon: BarChart3,
            label: t('accounting.average', 'Average'),
            value: count > 0 ? fmt(total / count) : '—',
          },
        ]}
      />
    </View>
  );
}

/**
 * AccountingToolbar — search + horizontal pill row + reset chip + sheets.
 *
 * Owns its own bottom-sheet refs and the date picker open state. Designed
 * to be used as a sticky header inside a ScrollView (the parent passes
 * `stickyHeaderIndices` to make it pin). The component sets its own
 * `screenBg` background so the rows underneath don't bleed through when
 * pinned.
 */
export function AccountingToolbar({
  search,
  setSearch,
  dateRange,
  setDateRange,
  filters = [],
  onResetAll,
  // Optional element rendered on the trailing edge of the search row,
  // sharing the row with the SheetInput. Used by the list views to inject
  // their collapse-all toggle so it sits inline with search instead of
  // floating in a separate row beneath the toolbar.
  searchTrailing = null,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { accentColor, dark, mutedColor, screenBg, borderColor } = tokens;

  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const sheetRefs = useRef({});

  const dateRangeActive = !!(dateRange?.from || dateRange?.to);
  const activeFilterCount = useMemo(() => {
    let n = 0;
    filters.forEach((f) => { n += (f.values?.length || 0); });
    if (dateRangeActive) n += 1;
    return n;
  }, [filters, dateRangeActive]);
  const hasAnyFilter = !!(search || activeFilterCount > 0);

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onResetAll?.();
  };

  const handleOpenDate = () => {
    Haptics.selectionAsync().catch(() => {});
    setDateSheetOpen(true);
  };

  return (
    <View
      style={[
        styles.toolbarOuter,
        {
          backgroundColor: screenBg,
          borderBottomColor: borderColor,
        },
      ]}
    >
      <View style={styles.toolbarInner}>
        <View
          style={[
            styles.searchRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <SheetInput
              icon={Search}
              value={search}
              onChangeText={setSearch}
              placeholder={t('common.search', 'Search...')}
              autoCapitalize="none"
              autoCorrect={false}
              dense
              suffix={
                search ? (
                  <Pressable
                    onPress={() => setSearch?.('')}
                    hitSlop={10}
                    style={styles.clearBtn}
                  >
                    <X size={14} color={mutedColor} />
                  </Pressable>
                ) : null
              }
            />
          </View>
          {hasAnyFilter ? (
            <Pressable
              onPress={handleReset}
              android_ripple={{
                color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderless: false,
              }}
              style={[
                styles.resetChip,
                {
                  backgroundColor: dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)',
                  borderColor: accentColor,
                },
              ]}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('common.resetAll', 'Reset all')}
            >
              <View
                style={[
                  styles.resetChipInner,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <RotateCcw size={14} color={accentColor} strokeWidth={2.4} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-SemiBold',
                    color: accentColor,
                    letterSpacing: 0.1,
                  }}
                  numberOfLines={1}
                >
                  {t('common.reset', 'Reset')}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {searchTrailing}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.pillRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <FilterTrigger
            icon={Calendar}
            label={t('common.dateRange', 'Date')}
            active={dateRangeActive}
            onPress={handleOpenDate}
            isRTL={isRTL}
            tokens={tokens}
          />

          {filters.map((filter) => (
            <FilterTrigger
              key={filter.key}
              icon={filter.icon}
              label={filter.label}
              active={(filter.values?.length || 0) > 0}
              countBadge={filter.values?.length > 0 ? filter.values.length : null}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                sheetRefs.current[filter.key]?.open();
              }}
              isRTL={isRTL}
              tokens={tokens}
            />
          ))}
        </ScrollView>
      </View>

      <DateRangePicker
        open={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={dateRange}
        onChange={setDateRange}
      />

      {filters.map((filter) => (
        <BottomPickerSheet
          key={filter.key}
          ref={(node) => { sheetRefs.current[filter.key] = node; }}
          icon={filter.icon}
          title={filter.label}
          subtitle={t('accounting.filterByDesc', 'Pick one or more')}
          searchPlaceholder={filter.searchPlaceholder
            || t('common.search', 'Search...')}
          searchFields={['label', 'description']}
          options={filter.options || []}
          value={filter.values}
          onValueChange={(val) => filter.onChange?.(val || [])}
          multiple
          forceSearchable={(filter.options || []).length > 5}
        />
      ))}
    </View>
  );
}

/**
 * Filter trigger pill — content-sized variant of the BatchesList recipe.
 * Layout in StyleSheet (DL §9 trap). Functional Pressable style only
 * carries the press-state visual delta.
 */
function FilterTrigger({
  icon: Icon, label, active, countBadge, onPress, isRTL, tokens,
}) {
  const {
    mutedColor, textColor, accentColor, iconColor,
    inputBg, sectionBorder, dark,
  } = tokens;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={[
        styles.trigger,
        {
          backgroundColor: active
            ? (dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 96%)')
            : inputBg,
          borderColor: active ? accentColor : sectionBorder,
        },
      ]}
    >
      <View
        style={[
          styles.triggerInner,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            styles.triggerIconTile,
            {
              backgroundColor: active
                ? (dark ? 'rgba(148,210,165,0.22)' : 'hsl(148, 38%, 88%)')
                : (dark ? 'rgba(255,255,255,0.08)' : 'hsl(148, 18%, 94%)'),
            },
          ]}
        >
          {Icon ? (
            <Icon
              size={14}
              color={active ? accentColor : iconColor}
              strokeWidth={2.2}
            />
          ) : null}
        </View>
        <Text
          style={{
            fontSize: 13,
            fontFamily: active ? 'Poppins-SemiBold' : 'Poppins-Medium',
            color: active ? accentColor : textColor,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {countBadge != null ? (
          <View style={[styles.countBadge, { backgroundColor: accentColor }]}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Bold',
                color: '#ffffff',
              }}
            >
              {countBadge}
            </Text>
          </View>
        ) : (
          <ChevronDown
            size={13}
            color={active ? accentColor : mutedColor}
            strokeWidth={2.4}
          />
        )}
      </View>
    </Pressable>
  );
}

/**
 * Default export — legacy combined hero + toolbar shell. Kept for
 * back-compat but new callers should compose `AccountingHero` and
 * `AccountingToolbar` separately so the toolbar can be made sticky inside
 * the parent ScrollView.
 */
export default function AccountingFilterBar(props) {
  return (
    <View>
      <AccountingHero {...props} />
      <AccountingToolbar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    paddingTop: 16,
  },
  toolbarOuter: {
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarInner: {
    marginHorizontal: 16,
    gap: 12,
  },
  searchRow: {
    alignItems: 'center',
    gap: 10,
  },
  pillRow: {
    alignItems: 'center',
    gap: 8,
    paddingEnd: 4,
  },
  trigger: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingStart: 6,
    paddingEnd: 12,
  },
  triggerInner: {
    alignItems: 'center',
    gap: 8,
  },
  triggerIconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compact 44pt chip sharing the search row with the input + collapse
  // toggle. Lives inline with search so when filters are active the user
  // can clear them without scrolling the pill row to find a Reset button.
  resetChip: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  resetChipInner: {
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
});
