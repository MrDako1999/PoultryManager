import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, Building2, Pencil, Trash2,
  X, Activity, Scale, Tag, RotateCcw,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useSettings from '@/hooks/useSettings';
import useCapabilities from '@/hooks/useCapabilities';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BottomPickerSheet from '@/components/BottomPickerSheet';
import SyncIconButton from '@/components/SyncIconButton';
import QuickAddFAB from '@/components/QuickAddFAB';
import { SkeletonRow } from '@/components/skeletons';
import { useToast } from '@/components/ui/Toast';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';

const NUMERIC_LOCALE = 'en-US';
const SWIPE_ACTION_WIDTH = 76;
const BUSINESS_TYPES = ['TRADER', 'SUPPLIER'];

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtAbbrev = (val) => {
  const n = Number(val || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString(NUMERIC_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toLocaleString(NUMERIC_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
  }
  return fmt(n);
};

export default function BusinessesListScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, borderColor, sectionBorder, screenBg, heroGradient, errorColor,
  } = tokens;

  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const { toast } = useToast();
  const { can } = useCapabilities();
  const canCreate = can('business:create');
  const canUpdate = can('business:update');
  const canDelete = can('business:delete');

  const { remove } = useOfflineMutation('businesses');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bizSheet, setBizSheet] = useState({ open: false, data: null });
  const [bizToDelete, setBizToDelete] = useState(null);

  const typePickerRef = useRef(null);

  const [businesses, businessesLoading] = useLocalQuery('businesses');
  const [saleOrders] = useLocalQuery('saleOrders');
  const [expenses] = useLocalQuery('expenses');

  const businessStats = useMemo(() => {
    const map = {};
    businesses.forEach((b) => {
      map[b._id] = { transactions: 0, salesTotal: 0, expensesTotal: 0, balance: 0 };
    });
    saleOrders.forEach((s) => {
      const custId = typeof s.customer === 'object' ? s.customer?._id : s.customer;
      const stats = map[custId];
      if (!stats) return;
      stats.transactions += 1;
      stats.salesTotal += s.totals?.grandTotal || 0;
    });
    expenses.forEach((e) => {
      const compId = typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany;
      const stats = map[compId];
      if (!stats) return;
      stats.transactions += 1;
      stats.expensesTotal += e.totalAmount || 0;
    });
    Object.values(map).forEach((s) => { s.balance = s.salesTotal - s.expensesTotal; });
    return map;
  }, [businesses, saleOrders, expenses]);

  const typeOptions = useMemo(
    () => BUSINESS_TYPES.map((value) => ({
      value,
      label: t(`businesses.${value.toLowerCase()}`, value),
    })),
    [t]
  );

  const filteredBusinesses = useMemo(() => {
    let list = businesses;
    if (typeFilter.length > 0) {
      const set = new Set(typeFilter);
      list = list.filter((b) => set.has(b.businessType || 'TRADER'));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        b.companyName?.toLowerCase().includes(q)
        || b.businessType?.toLowerCase().includes(q)
        || b.tradeLicenseNumber?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      (a.companyName || '').localeCompare(b.companyName || '', i18n.language || NUMERIC_LOCALE)
    );
  }, [businesses, searchQuery, typeFilter, i18n.language]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBizSheet({ open: true, data: null });
  };

  const openEdit = (biz) => setBizSheet({ open: true, data: biz });
  const requestDelete = (biz) => setBizToDelete(biz);

  const confirmDelete = async () => {
    if (!bizToDelete) return;
    try {
      await remove(bizToDelete._id);
      toast({ title: t('businesses.businessDeleted', 'Business removed') });
    } catch (e) {
      console.error(e);
      toast({
        title: t('businesses.deleteError', 'Failed to remove business'),
        variant: 'destructive',
      });
    } finally {
      setBizToDelete(null);
    }
  };

  const isInitialLoading = businessesLoading && businesses.length === 0;
  const isEmptyClean = !isInitialLoading && businesses.length === 0;
  const isFilteredEmpty = !isInitialLoading && businesses.length > 0 && filteredBusinesses.length === 0;

  const fabBottomInset = insets.bottom + 16;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BrandHeader
        title={t('nav.businesses', 'Businesses')}
        subtitle={t('businesses.subtitle', 'Manage suppliers and trading partners')}
        gradient={heroGradient}
        topInset={insets.top}
        isRTL={isRTL}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
      >
        <View
          style={{
            backgroundColor: screenBg,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: borderColor,
          }}
        >
          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilterCount={typeFilter.length}
            onOpenTypePicker={() => typePickerRef.current?.open()}
            onClearTypeFilter={() => setTypeFilter([])}
            isRTL={isRTL}
            tokens={tokens}
            t={t}
          />
        </View>

        <View style={{ paddingTop: 18 }}>
          {isInitialLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
            </View>
          ) : isEmptyClean ? (
            <EmptyState
              icon={Building2}
              title={t('businesses.noBusinesses', 'No businesses yet')}
              description={t(
                'businesses.noBusinessesDesc',
                'Add your first business to start tracking suppliers and traders.'
              )}
              actionLabel={canCreate ? t('businesses.addFirstBusiness', 'Add Your First Business') : undefined}
              onAction={canCreate ? openCreate : undefined}
            />
          ) : isFilteredEmpty ? (
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                alignItems: 'center',
                paddingVertical: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  textAlign: 'center',
                }}
              >
                {t('common.noResults', 'No results found')}
              </Text>
            </View>
          ) : (
            <SheetSection padded={false}>
              {filteredBusinesses.map((biz, idx) => (
                <View
                  key={biz._id}
                  style={idx > 0 ? {
                    borderTopWidth: 1,
                    borderTopColor: sectionBorder,
                  } : null}
                >
                  <BusinessRow
                    business={biz}
                    stats={businessStats[biz._id] || { transactions: 0, balance: 0 }}
                    currency={currency}
                    tokens={tokens}
                    isRTL={isRTL}
                    t={t}
                    onPress={() => router.push(`/(app)/business/${biz._id}`)}
                    onEdit={canUpdate ? () => openEdit(biz) : undefined}
                    onDelete={canDelete ? () => requestDelete(biz) : undefined}
                    errorColor={errorColor}
                    accentColor={accentColor}
                  />
                </View>
              ))}
            </SheetSection>
          )}
        </View>
      </ScrollView>

      {!bizSheet.open && canCreate && (
        <QuickAddFAB
          items={[]}
          directAction={openCreate}
          bottomInset={fabBottomInset}
        />
      )}

      <BottomPickerSheet
        ref={typePickerRef}
        icon={Tag}
        title={t('businesses.filterByType', 'Filter by type')}
        subtitle={t('businesses.filterByTypeDesc', 'Show only suppliers or traders')}
        searchable={false}
        options={typeOptions}
        value={typeFilter}
        onValueChange={(val) => setTypeFilter(val || [])}
        multiple
      />

      <QuickAddBusinessSheet
        open={bizSheet.open}
        onClose={() => setBizSheet({ open: false, data: null })}
        editData={bizSheet.data}
        canDelete={canDelete}
        onDelete={bizSheet.data ? () => requestDelete(bizSheet.data) : undefined}
      />

      <ConfirmDialog
        open={!!bizToDelete}
        onOpenChange={(o) => { if (!o) setBizToDelete(null); }}
        title={t('businesses.deleteBusinessTitle', 'Delete Business')}
        description={t(
          'businesses.deleteBusinessWarning',
          'This will permanently delete this business and cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function BrandHeader({ title, subtitle, gradient, topInset, isRTL }) {
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };
  return (
    <LinearGradient
      colors={gradient}
      start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
      end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={{
        paddingTop: topInset + 14,
        paddingBottom: 22,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={[
          headerStyles.row,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={headerStyles.backBtn}
          accessibilityRole="button"
        >
          <BackIcon size={20} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Poppins-Bold',
              color: '#ffffff',
              letterSpacing: -0.4,
              lineHeight: 30,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.78)',
                marginTop: 4,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <SyncIconButton />
      </View>
    </LinearGradient>
  );
}

function Toolbar({
  searchQuery, onSearchChange,
  typeFilterCount, onOpenTypePicker, onClearTypeFilter,
  isRTL, tokens, t,
}) {
  const { mutedColor, accentColor, dark } = tokens;
  const anyFilterActive = !!searchQuery || typeFilterCount > 0;

  const onResetAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (searchQuery) onSearchChange('');
    if (typeFilterCount > 0) onClearTypeFilter();
  }, [searchQuery, onSearchChange, typeFilterCount, onClearTypeFilter]);

  return (
    <View style={{ gap: 12 }}>
      <SheetInput
        icon={Search}
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder={t('businesses.searchPlaceholder', 'Search businesses...')}
        autoCapitalize="none"
        autoCorrect={false}
        dense
        suffix={
          searchQuery ? (
            <Pressable
              onPress={() => onSearchChange('')}
              hitSlop={10}
              style={toolbarStyles.clearBtn}
            >
              <X size={14} color={mutedColor} />
            </Pressable>
          ) : null
        }
      />

      <View
        style={[
          toolbarStyles.triggerRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <FilterTrigger
          icon={Tag}
          label={t('businesses.typeFilter', 'Type')}
          active={typeFilterCount > 0}
          countBadge={typeFilterCount > 0 ? typeFilterCount : null}
          onPress={onOpenTypePicker}
          isRTL={isRTL}
          tokens={tokens}
        />
        {anyFilterActive ? (
          <Pressable
            onPress={onResetAll}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderless: false,
            }}
            style={[
              toolbarStyles.resetChip,
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
                toolbarStyles.resetChipInner,
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
      </View>
    </View>
  );
}

function FilterTrigger({ icon: Icon, label, active, countBadge, onPress, isRTL, tokens }) {
  const { mutedColor, textColor, accentColor, inputBg, inputBorderIdle, dark } = tokens;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={[
        toolbarStyles.trigger,
        {
          backgroundColor: active
            ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
            : inputBg,
          borderColor: active ? accentColor : inputBorderIdle,
        },
      ]}
    >
      <View
        style={[
          toolbarStyles.triggerInner,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            toolbarStyles.triggerIconTile,
            {
              backgroundColor: active
                ? (dark ? 'rgba(148,210,165,0.22)' : 'hsl(148, 38%, 88%)')
                : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)'),
            },
          ]}
        >
          <Icon
            size={15}
            color={active ? accentColor : mutedColor}
            strokeWidth={2.2}
          />
        </View>
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: active ? 'Poppins-SemiBold' : 'Poppins-Medium',
            color: active ? accentColor : textColor,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {countBadge != null ? (
          <View style={[toolbarStyles.countBadge, { backgroundColor: accentColor }]}>
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
          <ChevronDown size={14} color={active ? accentColor : mutedColor} strokeWidth={2.4} />
        )}
      </View>
    </Pressable>
  );
}

function BusinessRow({
  business, stats, currency, tokens, isRTL, t,
  onPress, onEdit, onDelete, errorColor, accentColor,
}) {
  const { mutedColor, textColor, dark, sectionBg } = tokens;
  const swipeRef = useRef(null);
  // Flat row inside a SheetSection — DL §9. Press feedback is just a
  // background tint; row separation comes from the parent's sectionBorder
  // line. Padding lives on a plain inner View (NOT the Pressable) so
  // NativeWind's css-interop can't strip it.
  const pressedBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const businessType = business.businessType || 'TRADER';
  const typeLabel = t(`businesses.${businessType.toLowerCase()}`, businessType);

  const balance = stats.balance || 0;
  const balanceColor = balance > 0 ? accentColor : balance < 0 ? errorColor : textColor;

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => onEdit?.(), 150);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => onDelete?.(), 150);
  };

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row' }}>
      {onEdit ? (
        <Pressable
          onPress={handleEdit}
          style={({ pressed }) => [
            cardStyles.swipeAction,
            { backgroundColor: '#f59e0b', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Pencil size={20} color="#ffffff" strokeWidth={2.2} />
          <Text style={cardStyles.swipeActionLabel}>
            {t('common.edit', 'Edit')}
          </Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [
            cardStyles.swipeAction,
            { backgroundColor: '#dc2626', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Trash2 size={20} color="#ffffff" strokeWidth={2.2} />
          <Text style={cardStyles.swipeActionLabel}>
            {t('common.delete', 'Delete')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const swipeEnabled = !!(onEdit || onDelete);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      enabled={swipeEnabled}
      renderRightActions={swipeEnabled ? renderRightActions : undefined}
      containerStyle={{ backgroundColor: sectionBg }}
    >
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onPress}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : 'transparent',
        })}
      >
        <View style={cardStyles.rowInner}>
          <View
            style={[
              cardStyles.headerRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
          <View
            style={[
              cardStyles.iconTile,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)',
              },
            ]}
          >
            <Building2 size={20} color={accentColor} strokeWidth={2} />
          </View>
          <View style={cardStyles.headerTextCol}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {business.companyName}
            </Text>
            <View
              style={[
                cardStyles.subRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View
                style={[
                  cardStyles.typePill,
                  {
                    backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'hsl(148, 18%, 96%)',
                    borderColor: dark ? 'rgba(255,255,255,0.10)' : 'hsl(148, 14%, 88%)',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Poppins-SemiBold',
                    color: mutedColor,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  {typeLabel}
                </Text>
              </View>
              {business.tradeLicenseNumber ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                    flex: 1,
                    minWidth: 0,
                  }}
                  numberOfLines={1}
                >
                  {`TL: ${business.tradeLicenseNumber}`}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View
          style={[
            cardStyles.statsRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <StatCell
            icon={Activity}
            label={t('businesses.transactionsCount', 'Transactions')}
            value={String(stats.transactions || 0)}
            valueColor={textColor}
            tokens={tokens}
            isRTL={isRTL}
          />
          <StatDivider tokens={tokens} />
          <StatCell
            icon={Scale}
            label={t('businesses.balance', 'Balance')}
            value={`${currency} ${fmtAbbrev(balance)}`}
            valueColor={balanceColor}
            tokens={tokens}
            isRTL={isRTL}
          />
        </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function StatCell({ icon: Icon, label, value, valueColor, tokens, isRTL }) {
  const { mutedColor, textColor } = tokens;
  return (
    <View style={cardStyles.statCell}>
      <View
        style={[
          cardStyles.statLabelRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Icon size={11} color={mutedColor} strokeWidth={2.2} />
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          fontFamily: 'Poppins-SemiBold',
          color: valueColor || textColor,
          fontVariant: ['tabular-nums'],
          textAlign: isRTL ? 'right' : 'left',
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function StatDivider({ tokens }) {
  const { dark } = tokens;
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        marginHorizontal: 8,
        alignSelf: 'stretch',
      }}
    />
  );
}

const headerStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

const cardStyles = StyleSheet.create({
  // Padding lives here on a plain View, NOT on the Pressable. NativeWind's
  // css-interop strips layout-bearing styles from a Pressable's functional
  // `style` form (DL §9 trap rule). Generous vertical padding (20pt) gives
  // each row real breathing room.
  rowInner: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  // header (icon + name + sub row). marginBottom dropped — let the stats
  // row's marginTop own the gap so we don't double-space.
  headerRow: {
    alignItems: 'center',
    gap: 14,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  subRow: {
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  // Stats sit below the header separated by whitespace (marginTop: 18) —
  // NOT by an inner hairline. The previous inner hairline competed with
  // the inter-row sectionBorder divider and broke the visual rhythm.
  statsRow: {
    marginTop: 18,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  statLabelRow: {
    alignItems: 'center',
    gap: 4,
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    marginTop: 4,
  },
});

const toolbarStyles = StyleSheet.create({
  triggerRow: {
    alignItems: 'stretch',
    gap: 10,
  },
  trigger: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    paddingStart: 8,
    paddingEnd: 12,
  },
  triggerInner: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  triggerIconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetChip: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  resetChipInner: {
    alignItems: 'center',
    gap: 6,
  },
});
