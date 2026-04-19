import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, Platform,
  LayoutAnimation, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wheat, Pencil,
  Trash2, X, Tag, RotateCcw,
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
import { router } from 'expo-router';
import { deltaSync } from '@/lib/syncEngine';
import { FEED_TYPES, FEED_TYPE_ICONS } from '@/lib/constants';
import FeedItemSheet from '@/shared/sheets/FeedItemSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NUMERIC_LOCALE = 'en-US';
const SWIPE_ACTION_WIDTH = 76;
const CARD_GAP = 14;

const fmtMoney = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

export default function FeedCatalogueScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, borderColor, screenBg, heroGradient,
  } = tokens;

  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const { toast } = useToast();
  const { can } = useCapabilities();
  const canCreate = can('feedItem:create');
  const canUpdate = can('feedItem:update');
  const canDelete = can('feedItem:delete');

  const { remove } = useOfflineMutation('feedItems');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [feedSheet, setFeedSheet] = useState({ open: false, data: null });
  const [feedToDelete, setFeedToDelete] = useState(null);

  const typePickerRef = useRef(null);

  const [feedItems, feedLoading] = useLocalQuery('feedItems');
  const [businesses] = useLocalQuery('businesses');

  const businessNameById = useMemo(() => {
    const map = {};
    businesses.forEach((b) => { map[b._id] = b.companyName; });
    return map;
  }, [businesses]);

  const resolveCompanyName = useCallback((item) => {
    if (item.feedCompany && typeof item.feedCompany === 'object') {
      return item.feedCompany.companyName || t('feed.unknownCompany', 'Unknown Company');
    }
    if (typeof item.feedCompany === 'string') {
      return businessNameById[item.feedCompany] || t('feed.unknownCompany', 'Unknown Company');
    }
    return t('feed.unknownCompany', 'Unknown Company');
  }, [businessNameById, t]);

  const typeOptions = useMemo(
    () => FEED_TYPES.map((value) => ({
      value,
      label: t(`feed.feedTypes.${value}`, value),
    })),
    [t]
  );

  const filteredItems = useMemo(() => {
    let list = feedItems;
    if (typeFilter.length > 0) {
      const set = new Set(typeFilter);
      list = list.filter((it) => set.has(it.feedType));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((it) => {
        if (it.feedDescription?.toLowerCase().includes(q)) return true;
        const company = resolveCompanyName(it);
        return company.toLowerCase().includes(q);
      });
    }
    return list;
  }, [feedItems, searchQuery, typeFilter, resolveCompanyName]);

  const groupedByCompany = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      const companyName = resolveCompanyName(item);
      if (!groups[companyName]) {
        groups[companyName] = { companyName, items: [] };
      }
      groups[companyName].items.push(item);
    });
    return Object.values(groups)
      .map((g) => {
        g.items.sort((a, b) =>
          (a.feedDescription || '').localeCompare(b.feedDescription || '', i18n.language || NUMERIC_LOCALE)
        );
        return g;
      })
      .sort((a, b) =>
        a.companyName.localeCompare(b.companyName, i18n.language || NUMERIC_LOCALE)
      );
  }, [filteredItems, resolveCompanyName, i18n.language]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFeedSheet({ open: true, data: null });
  };

  const openEdit = (item) => setFeedSheet({ open: true, data: item });
  const requestDelete = (item) => setFeedToDelete(item);

  const confirmDelete = async () => {
    if (!feedToDelete) return;
    try {
      await remove(feedToDelete._id);
      toast({ title: t('feed.feedItemDeleted', 'Feed item removed') });
    } catch (e) {
      console.error(e);
      toast({
        title: t('feed.deleteError', 'Failed to remove feed item'),
        variant: 'destructive',
      });
    } finally {
      setFeedToDelete(null);
    }
  };

  const isInitialLoading = feedLoading && feedItems.length === 0;
  const isEmptyClean = !isInitialLoading && feedItems.length === 0;
  const isFilteredEmpty = !isInitialLoading && feedItems.length > 0 && filteredItems.length === 0;

  const fabBottomInset = insets.bottom + 16;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BrandHeader
        title={t('nav.feedCatalogue', 'Feed Catalogue')}
        subtitle={t('feed.subtitle', 'Manage your feed items')}
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
              {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            </View>
          ) : isEmptyClean ? (
            <EmptyState
              icon={Wheat}
              title={t('feed.noFeedItems', 'No feed items yet')}
              description={t('feed.noFeedItemsDesc', 'Add your first feed item to start tracking your catalogue.')}
              actionLabel={canCreate ? t('feed.addFirstFeedItem', 'Add Your First Feed Item') : undefined}
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
            groupedByCompany.map((group) => (
              <CompanyGroupSection
                key={group.companyName}
                group={group}
                isRTL={isRTL}
                tokens={tokens}
                t={t}
                currency={currency}
                onOpenItem={(item) => router.push(`/(app)/feed-item/${item._id}`)}
                onEditItem={canUpdate ? openEdit : undefined}
                onDeleteItem={canDelete ? requestDelete : undefined}
              />
            ))
          )}
        </View>
      </ScrollView>

      {!feedSheet.open && canCreate && (
        <QuickAddFAB
          items={[]}
          directAction={openCreate}
          bottomInset={fabBottomInset}
        />
      )}

      <BottomPickerSheet
        ref={typePickerRef}
        icon={Tag}
        title={t('feed.filterByType', 'Filter by feed type')}
        subtitle={t('feed.filterByTypeDesc', 'Show only the selected feed types')}
        searchable={false}
        options={typeOptions}
        value={typeFilter}
        onValueChange={(val) => setTypeFilter(val || [])}
        multiple
      />

      <FeedItemSheet
        open={feedSheet.open}
        onClose={() => setFeedSheet({ open: false, data: null })}
        editData={feedSheet.data}
        canDelete={canDelete}
        onDelete={feedSheet.data ? () => requestDelete(feedSheet.data) : undefined}
      />

      <ConfirmDialog
        open={!!feedToDelete}
        onOpenChange={(o) => { if (!o) setFeedToDelete(null); }}
        title={t('feed.deleteFeedItemTitle', 'Delete Feed Item')}
        description={t(
          'feed.deleteFeedItemWarning',
          'This will permanently delete this feed item and cannot be undone.'
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
        placeholder={t('feed.searchPlaceholder', 'Search feed items...')}
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
          label={t('feed.feedType', 'Feed Type')}
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

function CompanyGroupSection({
  group, isRTL, tokens, t, currency, onOpenItem, onEditItem, onDeleteItem,
}) {
  const { mutedColor } = tokens;
  const [open, setOpen] = useState(true);

  const toggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  }, []);

  const Chevron = open ? ChevronUp : (isRTL ? ChevronLeft : ChevronRight);

  return (
    <View style={{ marginBottom: open ? 0 : 16 }}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        style={[
          sectionStyles.eyebrow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {group.companyName}
        </Text>
        <View
          style={[
            sectionStyles.eyebrowTrailing,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-SemiBold',
              color: mutedColor,
              letterSpacing: 0.4,
              fontVariant: ['tabular-nums'],
            }}
          >
            {`${fmtInt(group.items.length)} ${
              group.items.length === 1
                ? t('feed.itemSingular', 'item')
                : t('feed.itemPlural', 'items')
            }`}
          </Text>
          <Chevron size={14} color={mutedColor} strokeWidth={2.4} />
        </View>
      </Pressable>

      {open ? (
        <SheetSection padded={false}>
          <View style={{ padding: 8 }}>
            {group.items.map((item, idx) => {
              const isLast = idx === group.items.length - 1;
              return (
                <FeedItemRow
                  key={item._id}
                  item={item}
                  tokens={tokens}
                  isRTL={isRTL}
                  t={t}
                  currency={currency}
                  bottomGap={isLast ? 0 : CARD_GAP}
                  onOpen={onOpenItem ? () => onOpenItem(item) : undefined}
                  onEdit={onEditItem ? () => onEditItem(item) : undefined}
                  onDelete={onDeleteItem ? () => onDeleteItem(item) : undefined}
                />
              );
            })}
          </View>
        </SheetSection>
      ) : null}
    </View>
  );
}

function FeedItemRow({
  item, tokens, isRTL, t, currency, bottomGap = 0,
  onOpen, onEdit, onDelete,
}) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const swipeRef = useRef(null);

  const FeedTypeIcon = FEED_TYPE_ICONS[item.feedType] || Wheat;
  const isInactive = item.isActive === false;

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
      containerStyle={bottomGap ? { marginBottom: bottomGap } : undefined}
    >
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onOpen}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => [
          cardStyles.card,
          {
            backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
            borderColor: pressed ? accentColor : elevatedCardBorder,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            opacity: pressed ? 0.95 : isInactive ? 0.55 : 1,
            ...(dark
              ? {}
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: pressed ? 0.04 : 0.07,
                  shadowRadius: pressed ? 6 : 10,
                  elevation: pressed ? 1 : 2,
                }),
          },
        ]}
      >
        <View
          style={[
            cardStyles.row,
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
            <FeedTypeIcon size={20} color={accentColor} strokeWidth={2} />
          </View>

          <View style={cardStyles.textCol}>
            <View
              style={[
                cardStyles.titleRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  letterSpacing: -0.1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {item.feedDescription}
              </Text>
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
                  {t(`feed.feedTypes.${item.feedType}`, item.feedType)}
                </Text>
              </View>
            </View>
            <View
              style={[
                cardStyles.metaRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: accentColor,
                  fontVariant: ['tabular-nums'],
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {`${currency} ${fmtMoney(item.grandTotal || item.pricePerQty || 0)}`}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {`/ ${fmtInt(item.quantitySize || 0)}${item.quantityUnit || 'KG'}`}
              </Text>
              {isInactive ? (
                <View
                  style={[
                    cardStyles.inactivePill,
                    {
                      backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'hsl(0, 0%, 93%)',
                      borderColor: dark ? 'rgba(255,255,255,0.10)' : 'hsl(0, 0%, 85%)',
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
                    {t('feed.inactiveLabel', 'Inactive')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const sectionStyles = StyleSheet.create({
  eyebrow: {
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 22,
    marginBottom: 10,
  },
  eyebrowTrailing: {
    alignItems: 'center',
    gap: 6,
  },
});

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
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    alignItems: 'center',
    gap: 8,
  },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  inactivePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
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
