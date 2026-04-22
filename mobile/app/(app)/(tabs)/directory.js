import { useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Warehouse, Building2, ContactRound, Users, Wheat, FolderOpen,
  ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import QuickAddFAB from '@/components/QuickAddFAB';
import FarmSheet from '@/shared/sheets/FarmSheet';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ContactSheet from '@/shared/sheets/ContactSheet';
import WorkerSheet from '@/shared/sheets/WorkerSheet';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';
const fmtCount = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * Per-entity color palette mirrors `MODULE_META` in settings-modules.js so
 * the directory's icon tiles feel like the same product as the rest of the
 * app. Each entity gets a light-mode and a dark-mode hex.
 */
function useCategoryMeta(t) {
  return useMemo(
    () => [
      {
        key: 'farms',
        icon: Warehouse,
        label: t('nav.farms', 'Farms'),
        route: '/(app)/farms-list',
        color: '#059669',
        darkColor: '#34d399',
      },
      {
        key: 'businesses',
        icon: Building2,
        label: t('nav.businesses', 'Businesses'),
        route: '/(app)/businesses-list',
        color: '#0284c7',
        darkColor: '#38bdf8',
      },
      {
        key: 'contacts',
        icon: ContactRound,
        label: t('nav.contacts', 'Contacts'),
        route: '/(app)/contacts-list',
        color: '#9333ea',
        darkColor: '#a78bfa',
      },
      {
        key: 'workers',
        icon: Users,
        label: t('nav.workers', 'Workers'),
        route: '/(app)/workers-list',
        color: '#d97706',
        darkColor: '#fbbf24',
      },
      {
        key: 'feed',
        icon: Wheat,
        label: t('nav.feedCatalogue', 'Feed Catalogue'),
        route: '/(app)/feed-catalogue',
        color: '#ea580c',
        darkColor: '#fb923c',
      },
    ],
    [t]
  );
}

export default function DirectoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const [refreshing, setRefreshing] = useState(false);

  const tokens = useHeroSheetTokens();
  const { accentColor, dark } = tokens;

  const [farms, farmsLoading] = useLocalQuery('farms');
  const [businesses, businessesLoading] = useLocalQuery('businesses');
  const [contacts, contactsLoading] = useLocalQuery('contacts');
  const [workers, workersLoading] = useLocalQuery('workers');
  const [feedItems, feedLoading] = useLocalQuery('feedItems');

  // Quick-add sheet state. One slot per entity — the FAB menu opens the
  // matching one. Mirrors the per-list FAB flow (FarmsList opens FarmSheet,
  // BusinessesList opens QuickAddBusinessSheet, etc.).
  const [openSheet, setOpenSheet] = useState(null); // 'farm' | 'business' | 'contact' | 'worker' | null
  const closeSheet = () => setOpenSheet(null);

  const counts = {
    farms: farms.length,
    businesses: businesses.length,
    contacts: contacts.length,
    workers: workers.length,
    feed: feedItems.length,
  };

  const totalRecords =
    counts.farms + counts.businesses + counts.contacts + counts.workers + counts.feed;

  const anyLoading =
    farmsLoading || businessesLoading || contactsLoading || workersLoading || feedLoading;

  const categories = useCategoryMeta(t);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  // QuickAddFAB lays itself out at `bottom: bottomInset + 16` from the
  // screen edge. On a tabs-landing screen we add the tab bar's content
  // height (49pt on iOS) so the FAB sits 16pt above the tab bar's TOP
  // edge — same FAB-to-bottom-chrome gap as BatchDetail's FAB has to the
  // home indicator. (BatchesList uses +84 for a more conservative offset;
  // we want the tighter rhythm here so the FAB feels anchored to the tab
  // bar rather than floating in the middle of the page.)
  const TAB_BAR_HEIGHT = 49;
  const fabBottomInset = insets.bottom + TAB_BAR_HEIGHT;

  const fabItems = [
    {
      key: 'farm',
      icon: Warehouse,
      label: t('directory.addFarm', 'Add Farm'),
      onPress: () => setOpenSheet('farm'),
    },
    {
      key: 'business',
      icon: Building2,
      label: t('directory.addBusiness', 'Add Business'),
      onPress: () => setOpenSheet('business'),
    },
    {
      key: 'contact',
      icon: ContactRound,
      label: t('directory.addContact', 'Add Contact'),
      onPress: () => setOpenSheet('contact'),
    },
    {
      key: 'worker',
      icon: Users,
      label: t('directory.addWorker', 'Add Worker'),
      onPress: () => setOpenSheet('worker'),
    },
  ];

  const heroExtra = (
    <View style={styles.heroIconTile}>
      <FolderOpen size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  const headerRight = (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>
        {t('directory.totalRecords', '{{count}} Records', { count: fmtCount(totalRecords) })}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <HeroSheetScreen
        title={t('nav.directory', 'Directory')}
        subtitle={t('directory.subtitle', 'People, places, and feed registered to your account')}
        showBack={false}
        heroExtra={heroExtra}
        headerRight={headerRight}
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
        <SheetSection title={t('directory.categoriesTitle', 'Categories')} padded={false}>
          <View style={styles.list}>
            {categories.map((cat) => (
              <CategoryRow
                key={cat.key}
                meta={cat}
                count={counts[cat.key]}
                loading={anyLoading}
                tokens={tokens}
                t={t}
                isRTL={isRTL}
              />
            ))}
          </View>
        </SheetSection>
      </HeroSheetScreen>

      {openSheet === null && (
        <QuickAddFAB items={fabItems} bottomInset={fabBottomInset} />
      )}

      <FarmSheet open={openSheet === 'farm'} onClose={closeSheet} />
      <QuickAddBusinessSheet open={openSheet === 'business'} onClose={closeSheet} />
      <ContactSheet open={openSheet === 'contact'} onClose={closeSheet} />
      <WorkerSheet open={openSheet === 'worker'} onClose={closeSheet} />
    </View>
  );
}

/**
 * Tappable elevated row for a directory category.
 *
 * STRICT §9 layout: every layout-bearing property (flexDirection, width,
 * borderWidth, padding) lives in `styles` (StyleSheet.create) and is applied
 * to plain inner `<View>` elements. The Pressable's functional `style` is
 * reserved for press-state visual deltas only (background, border colour,
 * scale, opacity, light-mode shadow). Putting layout in the functional style
 * triggers NativeWind's css-interop layer, which silently strips the layout
 * properties and collapses the row to content width — that was the bug in
 * the previous iteration.
 */
function CategoryRow({ meta, count, loading, tokens, t, isRTL }) {
  const {
    dark, accentColor, mutedColor, textColor,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;

  const Icon = meta.icon;
  const iconColor = dark ? meta.darkColor : meta.color;
  const iconTileBg = dark ? `${iconColor}26` : `${iconColor}1F`;

  // Direction-aware navigation glyph per §12.
  const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;

  const countText = loading ? '—' : fmtCount(count);
  const subline = loading
    ? t('common.loading', 'Loading…')
    : t('directory.recordCount', '{{count}} records', { count: countText });

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={() => router.push(meta.route)}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          opacity: pressed ? 0.96 : 1,
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
      <View style={[styles.rowInner, { flexDirection: rowDirection(isRTL) }]}>
        <View style={[styles.iconTile, { backgroundColor: iconTileBg }]}>
          <Icon size={22} color={iconColor} strokeWidth={2} />
        </View>

        <View style={styles.textCol}>
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
            {meta.label}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              marginTop: 2,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {subline}
          </Text>
        </View>

        <View style={[styles.trailing, { flexDirection: rowDirection(isRTL) }]}>
          <View
            style={[
              styles.countChip,
              {
                backgroundColor: dark
                  ? 'rgba(255,255,255,0.06)'
                  : 'hsl(148, 18%, 96%)',
                borderColor: dark
                  ? 'rgba(255,255,255,0.10)'
                  : 'hsl(148, 14%, 88%)',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Bold',
                color: textColor,
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {countText}
            </Text>
          </View>
          <ForwardChevron size={18} color={mutedColor} strokeWidth={2.2} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroIconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    letterSpacing: 0.4,
  },

  // List of category rows. Lives inside a `padded={false}` SheetSection,
  // so we own all the inner padding and gap.
  list: {
    padding: 8,
    gap: 10,
  },
  // Card-row outer. Layout (border, padding, radius) is static — the
  // Pressable's functional style only mutates colours / scale / shadow.
  row: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  // Plain View inside the Pressable owns the row direction so RTL flips
  // the icon tile to the trailing side automatically (§9 trap escape).
  rowInner: {
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
  },
  trailing: {
    alignItems: 'center',
    gap: 8,
  },
  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
});
