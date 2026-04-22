import { useState, useMemo, useRef } from 'react';
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
  Search, ChevronLeft, ChevronRight, Warehouse, Pencil, Trash2, X, Bird, Layers, Home,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SyncIconButton from '@/components/SyncIconButton';
import QuickAddFAB from '@/components/QuickAddFAB';
import { SkeletonRow } from '@/components/skeletons';
import { useToast } from '@/components/ui/Toast';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import FarmSheet from '@/shared/sheets/FarmSheet';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';
const SWIPE_ACTION_WIDTH = 76;

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

export default function FarmsListScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, borderColor, sectionBorder, screenBg, heroGradient,
  } = tokens;

  const { toast } = useToast();
  const { can } = useCapabilities();
  const canCreate = can('farm:create');
  const canUpdate = can('farm:update');
  const canDelete = can('farm:delete');

  const { remove } = useOfflineMutation('farms');

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [farmSheet, setFarmSheet] = useState({ open: false, data: null });
  const [farmToDelete, setFarmToDelete] = useState(null);

  const [farms, farmsLoading] = useLocalQuery('farms');
  const [batches] = useLocalQuery('batches');
  const [houses] = useLocalQuery('houses');

  const farmStats = useMemo(() => {
    const map = {};
    farms.forEach((f) => {
      map[f._id] = { capacity: 0, batchCount: 0, raised: 0 };
    });
    houses.forEach((h) => {
      const farmId = typeof h.farm === 'object' ? h.farm?._id : h.farm;
      const stats = map[farmId];
      if (!stats) return;
      stats.capacity += h.capacity || 0;
    });
    batches.forEach((b) => {
      const farmId = typeof b.farm === 'object' ? b.farm?._id : b.farm;
      const stats = map[farmId];
      if (!stats) return;
      stats.batchCount += 1;
      (b.houses || []).forEach((h) => { stats.raised += h.quantity || 0; });
    });
    return map;
  }, [farms, batches, houses]);

  const filteredFarms = useMemo(() => {
    let list = farms;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((f) =>
        f.farmName?.toLowerCase().includes(q)
        || f.nickname?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      (a.farmName || '').localeCompare(b.farmName || '', i18n.language || NUMERIC_LOCALE)
    );
  }, [farms, searchQuery, i18n.language]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFarmSheet({ open: true, data: null });
  };

  const openEdit = (farm) => {
    setFarmSheet({ open: true, data: farm });
  };

  const requestDelete = (farm) => {
    setFarmToDelete(farm);
  };

  const confirmDelete = async () => {
    if (!farmToDelete) return;
    try {
      await remove(farmToDelete._id);
      toast({ title: t('farms.farmDeleted', 'Farm removed') });
    } catch (e) {
      console.error(e);
      toast({
        title: t('farms.deleteError', 'Failed to remove farm'),
        variant: 'destructive',
      });
    } finally {
      setFarmToDelete(null);
    }
  };

  const isInitialLoading = farmsLoading && farms.length === 0;
  const isEmptyClean = !isInitialLoading && farms.length === 0;
  const isFilteredEmpty = !isInitialLoading && farms.length > 0 && filteredFarms.length === 0;

  // Standard FAB inset for stack screens (no tab bar to clear).
  const fabBottomInset = insets.bottom + 16;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BrandHeader
        title={t('nav.farms', 'Farms')}
        subtitle={t('farms.subtitle', 'Manage your farm locations and details')}
        gradient={heroGradient}
        topInset={insets.top}
        isRTL={isRTL}
        accentColor={accentColor}
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
          <SheetInput
            icon={Search}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('farms.searchPlaceholder', 'Search farms...')}
            autoCapitalize="none"
            autoCorrect={false}
            dense
            suffix={
              searchQuery ? (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={10}
                  style={styles.clearBtn}
                >
                  <X size={14} color={mutedColor} />
                </Pressable>
              ) : null
            }
          />
        </View>

        <View style={{ paddingTop: 18 }}>
          {isInitialLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
            </View>
          ) : isEmptyClean ? (
            <EmptyState
              icon={Warehouse}
              title={t('farms.noFarms', 'No farms yet')}
              description={t('farms.noFarmsDesc', 'Register your first farm to start managing your poultry operations.')}
              actionLabel={canCreate ? t('farms.addFirstFarm', 'Add Your First Farm') : undefined}
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
            // Flat list inside ONE section card with hairline gray dividers
            // between rows — the SourcesListView pattern. Reads consistently
            // in both themes because dividers render explicitly (no reliance
            // on shadows that get clipped in dark mode).
            <SheetSection padded={false}>
              {filteredFarms.map((farm, idx) => (
                <View
                  key={farm._id}
                  style={idx > 0 ? {
                    borderTopWidth: 1,
                    // sectionBorder over borderColor on purpose: in dark
                    // mode borderColor only differs ~6% L from sectionBg
                    // (barely visible), while sectionBorder is tuned to
                    // 12% L brighter — the difference between "is there a
                    // line?" and "yep, that's a line."
                    borderTopColor: sectionBorder,
                  } : null}
                >
                  <FarmRow
                    farm={farm}
                    stats={farmStats[farm._id] || { capacity: 0, batchCount: 0, raised: 0 }}
                    tokens={tokens}
                    isRTL={isRTL}
                    t={t}
                    onPress={() => router.push(`/(app)/farm/${farm._id}`)}
                    onEdit={canUpdate ? () => openEdit(farm) : undefined}
                    onDelete={canDelete ? () => requestDelete(farm) : undefined}
                  />
                </View>
              ))}
            </SheetSection>
          )}
        </View>
      </ScrollView>

      {!farmSheet.open && canCreate && (
        <QuickAddFAB
          items={[]}
          directAction={openCreate}
          bottomInset={fabBottomInset}
        />
      )}

      <FarmSheet
        open={farmSheet.open}
        onClose={() => setFarmSheet({ open: false, data: null })}
        editData={farmSheet.data}
        canDelete={canDelete}
        onDelete={farmSheet.data ? () => requestDelete(farmSheet.data) : undefined}
      />

      <ConfirmDialog
        open={!!farmToDelete}
        onOpenChange={(o) => { if (!o) setFarmToDelete(null); }}
        title={t('farms.deleteFarmTitle', 'Delete Farm')}
        description={t(
          'farms.deleteFarmWarning',
          'This will permanently delete this farm and cannot be undone.'
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
          styles.headerRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={styles.backBtn}
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
              textAlign: textAlignStart(isRTL),
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
                textAlign: textAlignStart(isRTL),
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

function FarmRow({
  farm, stats, tokens, isRTL, t,
  onPress, onEdit, onDelete,
}) {
  const {
    mutedColor, textColor, accentColor, dark, sectionBg,
  } = tokens;
  const swipeRef = useRef(null);

  // Flat row inside a SheetSection — no card border, no shadow, no scale.
  // Press feedback is just a subtle background tint. The visual separation
  // between rows comes from the explicit hairline divider in the parent.
  const pressedBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const initials = (farm.nickname || farm.farmName || '?')[0].toUpperCase();

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
        {/* CRITICAL — DL §9: padding lives on a plain inner View, NEVER
            on the Pressable. NativeWind's css-interop silently strips
            layout-bearing styles (incl. padding) from a Pressable's
            functional `style={({pressed}) => ...}` even when referenced
            via a StyleSheet ref. Hoisting padding here makes spacing
            actually render. */}
        <View style={cardStyles.rowInner}>
          <View
            style={[
              cardStyles.headerRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
          <View
            style={[
              cardStyles.avatarTile,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: accentColor,
              }}
            >
              {initials}
            </Text>
          </View>
          <View style={cardStyles.headerTextCol}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {farm.farmName}
            </Text>
            {farm.nickname ? (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  marginTop: 2,
                  textAlign: textAlignStart(isRTL),
                  letterSpacing: 0.4,
                }}
                numberOfLines={1}
              >
                {farm.nickname}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={[
            cardStyles.statsRow,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <StatCell
            icon={Home}
            label={t('farms.capacity', 'Capacity')}
            value={fmtInt(stats.capacity)}
            tokens={tokens}
            isRTL={isRTL}
          />
          <StatDivider tokens={tokens} />
          <StatCell
            icon={Layers}
            label={t('farms.batches', 'Batches')}
            value={fmtInt(stats.batchCount)}
            tokens={tokens}
            isRTL={isRTL}
          />
          <StatDivider tokens={tokens} />
          <StatCell
            icon={Bird}
            label={t('farms.raised', 'Raised')}
            value={fmtInt(stats.raised)}
            tokens={tokens}
            isRTL={isRTL}
          />
        </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function StatCell({ icon: Icon, label, value, tokens, isRTL }) {
  const { mutedColor, textColor } = tokens;
  return (
    <View style={cardStyles.statCell}>
      <View
        style={[
          cardStyles.statLabelRow,
          { flexDirection: rowDirection(isRTL) },
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
            textAlign: textAlignStart(isRTL),
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
          color: textColor,
          fontVariant: ['tabular-nums'],
          textAlign: textAlignStart(isRTL),
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

const styles = StyleSheet.create({
  headerRow: {
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
  clearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
});

const cardStyles = StyleSheet.create({
  // Inner padding wrapper. Padding LIVES HERE on a plain View, NOT on
  // the Pressable, because NativeWind's css-interop strips layout-bearing
  // styles from a Pressable's functional `style` form (DL §9 trap rule).
  // Vertical padding is intentionally generous (20pt) so each row feels
  // like its own breathable block, not a cramped strip.
  rowInner: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  // header (avatar + name + nickname). marginBottom dropped — let the
  // stats row's own marginTop own the gap so we don't double-space.
  headerRow: {
    alignItems: 'center',
    gap: 14,
  },
  // 44pt is the design language hero avatar size; gives the row better
  // visual weight than the previous 40pt and matches BatchAvatar default.
  avatarTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  // Stats sit below the header separated by whitespace (marginTop: 18)
  // — NOT by an inner hairline. The previous inner hairline competed
  // visually with the inter-row divider and made the rhythm look broken.
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
