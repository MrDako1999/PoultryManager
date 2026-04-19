import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bird, Layers, Skull, Home, ChevronRight, TrendingUp,
} from 'lucide-react-native';
import useSettings from '@/hooks/useSettings';
import { SkeletonDashboardKpiHero } from '@/components/skeletons';
import SheetSection from '@/components/SheetSection';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import useBroilerDashboardStats from './useBroilerDashboardStats';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (val) => Number(val || 0).toLocaleString();

const SCOPES = ['active', 'allTime', 'thisMonth'];

function mortalityToneColor(pct, tokens) {
  if (pct >= 5) return tokens.errorColor;
  if (pct >= 2) return tokens.dark ? '#fbbf24' : '#d97706';
  return tokens.accentColor;
}

function ScopeSegmented({ value, onChange, options }) {
  const { dark, accentColor, mutedColor, sectionBg, borderColor } = useHeroSheetTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: sectionBg,
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor,
        ...(dark
          ? {}
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }),
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange?.(opt.value);
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: active
                ? (dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)')
                : 'transparent',
              borderWidth: 1,
              borderColor: active ? accentColor : 'transparent',
            }}
            hitSlop={4}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Medium',
                color: active ? accentColor : mutedColor,
              }}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatCell({ icon: Icon, label, value, valueColor }) {
  const { mutedColor, textColor } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {Icon && <Icon size={11} color={mutedColor} strokeWidth={2.4} />}
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
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
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function StatDivider() {
  const { borderColor } = useHeroSheetTokens();
  return <View style={{ width: 1, backgroundColor: borderColor, marginHorizontal: 8 }} />;
}

export default function BroilerKpiHero() {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const { mutedColor, textColor, accentColor, errorColor, borderColor, dark } = tokens;
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [scope, setScope] = useState('active');
  const { flockStats, financials, isLoading } = useBroilerDashboardStats(scope);

  if (isLoading) {
    return <SkeletonDashboardKpiHero />;
  }

  const goBatches = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(app)/(tabs)/batches');
  };

  const scopeOptions = SCOPES.map((value) => ({
    value,
    label:
      value === 'active' ? t('dashboard.scopeActive', 'Active')
      : value === 'allTime' ? t('dashboard.scopeAllTime', 'All-time')
      : t('dashboard.scopeThisMonth', 'This Month'),
  }));

  const flockHeadlineIsLive = scope === 'active';
  const hasFlock = flockStats.initial > 0;
  const profitColor = financials.netProfit < 0 ? errorColor : accentColor;
  const mortalityColor = mortalityToneColor(flockStats.mortalityPct, tokens);

  return (
    <View>
      {/* Scope segmented control sits ABOVE the sections, like a global filter */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <ScopeSegmented value={scope} onChange={setScope} options={scopeOptions} />
      </View>

      {/* Flock card */}
      <SheetSection
        title={t('dashboard.flockSummary', 'Flock')}
        icon={Bird}
      >
        <Pressable
          onPress={goBatches}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text
                  style={{
                    fontSize: 30,
                    fontFamily: 'Poppins-Bold',
                    color: textColor,
                    letterSpacing: -0.8,
                    lineHeight: 36,
                  }}
                >
                  {flockHeadlineIsLive ? fmtInt(flockStats.liveBirds) : fmtInt(flockStats.initial)}
                </Text>
                {hasFlock && flockHeadlineIsLive && (
                  <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor }}>
                    / {fmtInt(flockStats.initial)} {t('dashboard.birds', 'birds')}
                  </Text>
                )}
                {hasFlock && !flockHeadlineIsLive && (
                  <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor }}>
                    {t('farms.birdsRaised', 'birds raised')}
                  </Text>
                )}
              </View>
            </View>
            <ChevronRight size={18} color={mutedColor} />
          </View>

          {hasFlock && (
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                overflow: 'hidden',
                marginTop: 12,
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: accentColor,
                  width: `${flockStats.survivalPct}%`,
                }}
              />
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: borderColor,
            }}
          >
            <StatCell
              icon={Layers}
              label={
                flockHeadlineIsLive
                  ? t('dashboard.activeBatches', 'Active Batches')
                  : t('farms.cyclesRun', 'Cycles')
              }
              value={fmtInt(flockStats.cycleCount)}
            />
            <StatDivider />
            <StatCell
              icon={Skull}
              label={t('dashboard.mortalityRate', 'Mortality')}
              value={`${flockStats.mortalityPct.toFixed(2)}%`}
              valueColor={mortalityColor}
            />
            <StatDivider />
            <StatCell
              icon={Home}
              label={t('dashboard.totalHouses', 'Houses')}
              value={fmtInt(flockStats.houseCount)}
            />
          </View>
        </Pressable>
      </SheetSection>

      {/* Net Profit card */}
      <SheetSection
        title={t('batches.netProfit', 'Net Profit')}
        icon={TrendingUp}
      >
        <Text
          style={{
            fontSize: 30,
            fontFamily: 'Poppins-Bold',
            color: profitColor,
            letterSpacing: -0.8,
            lineHeight: 36,
          }}
        >
          {currency} {fmt(financials.netProfit)}
        </Text>
        {financials.marginPct != null && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              marginTop: 2,
            }}
          >
            {t('batches.margin', 'Margin {{pct}}%', { pct: financials.marginPct.toFixed(1) })}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: borderColor,
          }}
        >
          <StatCell
            label={t('batches.totalRevenue', 'Revenue')}
            value={fmt(financials.totalRevenue)}
          />
          <StatDivider />
          <StatCell
            label={t('batches.expenses', 'Expenses')}
            value={fmt(financials.totalExpenses)}
          />
          <StatDivider />
          <StatCell
            label={t('batches.profitPerBird', 'Profit / Bird')}
            value={financials.profitPerBird != null ? fmt(financials.profitPerBird) : '—'}
            valueColor={
              financials.profitPerBird != null && financials.profitPerBird < 0
                ? errorColor
                : textColor
            }
          />
        </View>
      </SheetSection>
    </View>
  );
}
