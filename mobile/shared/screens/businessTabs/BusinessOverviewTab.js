import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Scale, ShoppingCart, Receipt, ArrowLeftRight, Wallet,
  Hash, MapPin, Warehouse, ContactRound,
  ChevronRight, ChevronLeft,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useSettings from '@/hooks/useSettings';
import { deltaSync } from '@/lib/syncEngine';
import SheetSection from '@/components/SheetSection';
import LocationActions from '@/components/LocationActions';
import BatchKpiCard from '@/modules/broiler/components/BatchKpiCard';
import { rowDirection, textAlignStart, textAlignEnd } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtDate = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

/**
 * IdRow — small badge chip for trade license / TRN identifiers.
 * Lives inside the Business Info section. Static layout (DL §9 trap).
 */
function IdRow({ icon: Icon, label, value, isRTL, tokens, isLast }) {
  const { mutedColor, textColor, borderColor } = tokens;
  return (
    <View
      style={[
        styles.kvRow,
        {
          flexDirection: rowDirection(isRTL),
          borderBottomColor: borderColor,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View
        style={[
          styles.kvLabelCol,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Icon size={14} color={mutedColor} strokeWidth={2.2} />
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontFamily: 'Poppins-SemiBold',
          color: textColor,
          textAlign: textAlignEnd(isRTL),
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * LinkedItemRow — clickable row inside the Linked Farms / Associated
 * Contacts sections. Mirrors the icon-tile + label + sublabel + chevron
 * recipe from ExpenseDetail.LinkedRow but renders flat inside the parent
 * SheetSection (no nested card surface) so multiple rows stack with a
 * shared hairline divider.
 *
 * Static layout in StyleSheet (§9 trap rule). Press-state visuals are
 * applied via the functional Pressable style only.
 */
function LinkedItemRow({
  icon: Icon, label, sublabel, onPress, isRTL, tokens, isLast,
}) {
  const {
    accentColor, textColor, mutedColor, borderColor, dark,
  } = tokens;
  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;
  const tileBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
          : 'transparent',
      })}
    >
      <View
        style={[
          styles.linkedRow,
          {
            flexDirection: rowDirection(isRTL),
            borderBottomColor: borderColor,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={[styles.linkedTile, { backgroundColor: tileBg }]}>
          <Icon size={16} color={accentColor} strokeWidth={2.4} />
        </View>
        <View style={styles.linkedTextCol}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              letterSpacing: -0.1,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
        <ForwardArrow size={18} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

export default function BusinessOverviewTab({
  biz,
  totals,
  isTrader,
  contacts,
  linkedFarms,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, screenBg, errorColor,
  } = tokens;

  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const balanceLabel = totals.balance > 0
    ? (isTrader
        ? t('businesses.theyOweYou', 'They owe you')
        : t('businesses.youOweThem', 'You owe them'))
    : totals.balance < 0
      ? t('businesses.detail.settled', 'Settled')
      : t('businesses.allSquare', 'All square');

  const balanceColor = totals.balance > 0
    ? errorColor
    : totals.balance < 0
      ? accentColor
      : textColor;

  const balanceStats = isTrader
    ? [
        {
          icon: ShoppingCart,
          label: t('businesses.salesShort', 'Sales'),
          value: fmt(totals.totalSales),
        },
        {
          icon: Receipt,
          label: t('businesses.expensesShort', 'Expenses'),
          value: fmt(totals.totalExpenses),
        },
        {
          icon: ArrowLeftRight,
          label: t('businesses.transfersShort', 'Transfers'),
          value: fmt(totals.totalTransfers),
        },
      ]
    : [
        {
          icon: Wallet,
          label: t('businesses.purchasesShort', 'Purchases'),
          value: fmt(totals.totalPurchases),
        },
        {
          icon: ArrowLeftRight,
          label: t('businesses.transfersShort', 'Transfers'),
          value: fmt(totals.totalTransfers),
        },
      ];

  const showInfo = !!(biz.tradeLicenseNumber || biz.trnNumber);
  const showAddress = !!(biz.address?.formattedAddress
    || (biz.address?.lat != null && biz.address?.lng != null));

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance KPI hero — currency prefix, big number, "they owe you /
            settled" subline, conditional stat strip. */}
        <BatchKpiCard
          title={t('businesses.balanceSummary', 'Balance Summary')}
          icon={Scale}
          headlinePrefix={currency}
          headline={fmt(Math.abs(totals.balance))}
          headlineColor={balanceColor}
          subline={balanceLabel}
          stats={balanceStats}
        />

        {/* Business Info — only renders if at least one identifier exists. */}
        {showInfo ? (
          <SheetSection
            title={t('businesses.businessInfoSection', 'Business Info')}
            icon={Hash}
            padded={false}
          >
            {biz.tradeLicenseNumber ? (
              <IdRow
                icon={Hash}
                label={t('businesses.tradeLicenseNumber', 'Trade License')}
                value={biz.tradeLicenseNumber}
                isRTL={isRTL}
                tokens={tokens}
                isLast={!biz.trnNumber}
              />
            ) : null}
            {biz.trnNumber ? (
              <IdRow
                icon={Hash}
                label={t('businesses.trnNumber', 'TRN')}
                value={biz.trnNumber}
                isRTL={isRTL}
                tokens={tokens}
                isLast
              />
            ) : null}
          </SheetSection>
        ) : null}

        {/* Address — header row with the formatted address followed by a
            stack of full-width navigate / share rows from LocationActions.
            Uses `padded={false}` so the inner rows reach edge-to-edge and
            sit flush with their hairline dividers (mirrors Linked Farms /
            Associated Contacts on this same tab). */}
        {showAddress ? (
          <SheetSection
            title={t('businesses.addressSection', 'Address')}
            icon={MapPin}
            padded={false}
          >
            {biz.address?.formattedAddress ? (
              <View
                style={[
                  styles.addressHeader,
                  { borderBottomColor: tokens.borderColor },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: textColor,
                    lineHeight: 20,
                    textAlign: textAlignStart(isRTL),
                  }}
                >
                  {biz.address.formattedAddress}
                </Text>
              </View>
            ) : null}
            <LocationActions
              name={biz.companyName}
              lat={biz.address?.lat}
              lng={biz.address?.lng}
              address={biz.address?.formattedAddress}
            />
          </SheetSection>
        ) : null}

        {/* Linked Farms — clickable rows that drill into Farm Detail. */}
        {linkedFarms.length > 0 ? (
          <SheetSection
            title={`${t('businesses.detail.linkedFarms', 'Linked Farms')}  ·  ${linkedFarms.length}`}
            icon={Warehouse}
            padded={false}
          >
            {linkedFarms.map((farm, i) => (
              <LinkedItemRow
                key={farm._id}
                icon={Warehouse}
                label={farm.farmName}
                sublabel={farm.farmType
                  ? t(`farms.farmTypes.${farm.farmType}`, farm.farmType)
                  : null}
                onPress={() => router.push(`/(app)/farm/${farm._id}`)}
                isRTL={isRTL}
                tokens={tokens}
                isLast={i === linkedFarms.length - 1}
              />
            ))}
          </SheetSection>
        ) : null}

        {/* Associated Contacts — clickable rows that drill into Contact Detail. */}
        {contacts.length > 0 ? (
          <SheetSection
            title={`${t('businesses.associatedContacts', 'Associated Contacts')}  ·  ${contacts.length}`}
            icon={ContactRound}
            padded={false}
          >
            {contacts.map((contact, i) => {
              const name = `${contact.firstName || ''} ${contact.lastName || ''}`
                .trim() || contact.email || t('common.unknown', 'Unknown');
              return (
                <LinkedItemRow
                  key={contact._id}
                  icon={ContactRound}
                  label={name}
                  sublabel={contact.email || contact.phone || null}
                  onPress={() => router.push(`/(app)/contact/${contact._id}`)}
                  isRTL={isRTL}
                  tokens={tokens}
                  isLast={i === contacts.length - 1}
                />
              );
            })}
          </SheetSection>
        ) : null}

        {/* Footer meta */}
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 8,
            letterSpacing: 0.2,
          }}
        >
          {t('common.created', 'Created')} {fmtDate(biz.createdAt)}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kvRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 12,
  },
  kvLabelCol: {
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  linkedRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 12,
  },
  linkedTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedTextCol: {
    flex: 1,
    minWidth: 0,
  },
  addressHeader: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
