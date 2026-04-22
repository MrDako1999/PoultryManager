import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Calculator, BadgePercent, Landmark } from 'lucide-react-native';
import useCapabilities from '@/hooks/useCapabilities';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import EmptyState from '@/components/ui/EmptyState';
import ComingSoonView from '@/components/views/ComingSoonView';
import Tabs from '@/components/ui/Tabs';
import SyncIconButton from '@/components/SyncIconButton';
import { MODULES } from '@/modules/registry';
import { rowDirection, textAlignStart } from '@/lib/rtl';

// Global accounting tabs that aren't owned by any single module — currently
// VAT and Corporate Tax placeholders, mirroring the frontend sidebar's
// `accountingTabs` global entries. Each renders a Coming Soon view until
// the real reports ship.
const GLOBAL_VIEWS = [
  {
    id: 'vat',
    moduleId: '_global',
    labelKey: 'nav.vat',
    icon: BadgePercent,
    placeholder: true,
  },
  {
    id: 'corporateTax',
    moduleId: '_global',
    labelKey: 'nav.corporateTax',
    icon: Landmark,
    placeholder: true,
  },
];

export default function AccountingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const { screenBg, heroGradient } = useHeroSheetTokens();
  const { visibleModules, can } = useCapabilities();

  const views = useMemo(() => {
    const out = [];
    // Module-contributed views first (Sales, Expenses, etc.).
    for (const id of visibleModules) {
      const mod = MODULES[id];
      for (const view of mod?.accountingViews || []) {
        if (view.capability && !can(view.capability)) continue;
        out.push({ ...view, moduleId: id });
      }
    }
    // Global placeholder tabs appended only when the user has at least one
    // module-contributed accounting view (matches the frontend sidebar's
    // `hasAccountingAccess` gate — VAT/Corporate Tax shouldn't appear for a
    // user who can't see any accounting at all).
    if (out.length > 0) {
      out.push(...GLOBAL_VIEWS);
    }
    return out;
  }, [visibleModules, can]);

  const visibleTabs = useMemo(
    () => views.map((v) => ({
      key: `${v.moduleId}:${v.id}`,
      label: t(v.labelKey, v.id),
    })),
    [views, t]
  );

  const [tabKey, setTabKey] = useState(null);

  useEffect(() => {
    if (!tabKey && views.length > 0) {
      setTabKey(`${views[0].moduleId}:${views[0].id}`);
    }
    if (tabKey && !views.some((v) => `${v.moduleId}:${v.id}` === tabKey)) {
      setTabKey(views[0] ? `${views[0].moduleId}:${views[0].id}` : null);
    }
  }, [views, tabKey]);

  const activeView = views.find((v) => `${v.moduleId}:${v.id}` === tabKey);
  const ActiveComponent = activeView?.component;
  const isPlaceholder = !!activeView?.placeholder;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BrandHeader
        title={t('nav.accounting', 'Accounting')}
        subtitle={t(
          'accounting.subtitle',
          'Track revenue and expenses across your operations'
        )}
        gradient={heroGradient}
        topInset={insets.top}
        isRTL={isRTL}
      />

      {visibleTabs.length > 1 ? (
        <Tabs
          tabs={visibleTabs}
          value={tabKey}
          onChange={setTabKey}
        />
      ) : null}

      <View style={{ flex: 1 }}>
        {isPlaceholder ? (
          <ComingSoonView
            icon={activeView.icon}
            title={t(activeView.labelKey, activeView.id)}
          />
        ) : ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <EmptyState
            icon={Calculator}
            title={t('accounting.noViews', 'No accounting views available')}
            description={t(
              'accounting.noViewsDesc',
              'Your account does not have any modules with accounting views, or you lack permission to view them.'
            )}
          />
        )}
      </View>
    </View>
  );
}

function BrandHeader({ title, subtitle, gradient, topInset, isRTL }) {
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
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
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

const headerStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
