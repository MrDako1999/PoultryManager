import { useMemo, useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sun, Sunrise, Sunset, Moon } from 'lucide-react-native';
import useAuthStore from '@/stores/authStore';
import useCapabilities from '@/hooks/useCapabilities';
import useSettings from '@/hooks/useSettings';
import SyncIconButton from '@/components/SyncIconButton';
import ModuleSwitcher from '@/shared/components/ModuleSwitcher';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import { MODULES } from '@/modules/registry';
import { deltaSync } from '@/lib/syncEngine';

function getGreetingBucket(hour) {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

const BUCKET_TO_KEY = {
  morning: 'dashboard.greetingMorning',
  afternoon: 'dashboard.greetingAfternoon',
  evening: 'dashboard.greetingEvening',
  night: 'dashboard.greetingNight',
};

const BUCKET_TO_FALLBACK = {
  morning: 'Good morning, {{name}}',
  afternoon: 'Good afternoon, {{name}}',
  evening: 'Good evening, {{name}}',
  night: 'Working late, {{name}}',
};

const BUCKET_TO_ICON = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

// Owns the per-module quick-stats hook so its hook ordering can't bleed
// into DashboardScreen's. The dashboard mounts at most one of these and
// keys it by moduleId so switching modules cleanly remounts the subtree.
function ModuleQuickStats({ useHook, hookProps }) {
  const stats = useHook(hookProps);
  return <HeroQuickStats stats={stats} />;
}

function HeroQuickStats({ stats }) {
  if (!stats || stats.length === 0) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <View
            key={stat.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              paddingHorizontal: 11,
              paddingVertical: 6,
            }}
          >
            {Icon && <Icon size={13} color="#ffffff" strokeWidth={2.4} />}
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-SemiBold',
                color: '#ffffff',
                letterSpacing: -0.1,
              }}
              numberOfLines={1}
            >
              {stat.value}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.78)',
              }}
              numberOfLines={1}
            >
              {stat.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { visibleModules, can, role, activeModule } = useCapabilities();
  const accounting = useSettings('accounting');
  const [refreshing, setRefreshing] = useState(false);
  const { mutedColor, accentColor, dark } = useHeroSheetTokens();

  const RoleDashboard = useMemo(() => {
    const mod = activeModule ? MODULES[activeModule] : null;
    return mod?.roleDashboards?.[role] || null;
  }, [activeModule, role]);

  const widgets = useMemo(() => {
    const out = [];
    for (const id of visibleModules) {
      const mod = MODULES[id];
      for (const widget of mod?.dashboardWidgets || []) {
        if (widget.capability && !can(widget.capability)) continue;
        out.push({ ...widget, moduleId: id });
      }
    }
    out.sort((a, b) => (a.order || 0) - (b.order || 0));
    return out;
  }, [visibleModules, can]);

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString(i18n.language, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return new Date().toLocaleDateString();
    }
  }, [i18n.language]);

  const greetingBucket = useMemo(() => getGreetingBucket(new Date().getHours()), []);
  const greeting = useMemo(() => {
    const name = user?.firstName || (user?.email ? user.email.split('@')[0] : '');
    return t(BUCKET_TO_KEY[greetingBucket], BUCKET_TO_FALLBACK[greetingBucket], { name });
  }, [t, user?.firstName, user?.email, greetingBucket]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  // Active module's quick-stats hook is mounted inside <ModuleQuickStats /> so
  // its hook ordering is isolated from DashboardScreen's. Calling it directly
  // would mean hook count changes when activeModule resolves async, which
  // crashes React with "Rendered more hooks than during the previous render."
  const activeMod = activeModule ? MODULES[activeModule] : null;
  const useQuickStats = activeMod?.useDashboardQuickStats || null;
  const quickStatsNode = useQuickStats
    ? (
      <ModuleQuickStats
        key={activeModule}
        useHook={useQuickStats}
        hookProps={{ currency: accounting?.currency || 'AED', t }}
      />
    )
    : null;

  if (RoleDashboard) {
    return <RoleDashboard />;
  }

  const HeroIcon = BUCKET_TO_ICON[greetingBucket];

  const heroExtra = (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <HeroIcon size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  const headerRight = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ModuleSwitcher compact />
      <SyncIconButton />
    </View>
  );

  return (
    <HeroSheetScreen
      title={greeting}
      subtitle={todayLabel}
      showBack={false}
      heroExtra={heroExtra}
      headerRight={headerRight}
      heroBelow={quickStatsNode}
      scrollableHero
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
      {widgets.map((widget) => {
        const W = widget.component;
        if (!W) return null;
        return (
          <View
            key={`${widget.moduleId}:${widget.id}`}
            style={{ marginBottom: 4 }}
          >
            <W />
          </View>
        );
      })}

      {widgets.length === 0 && (
        <SheetSection title={t('dashboard.noWidgetsTitle', 'No widgets yet')}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              textAlign: 'center',
              lineHeight: 19,
              paddingVertical: 16,
            }}
          >
            {t('dashboard.noWidgets', 'No dashboard widgets available for your role.')}
          </Text>
        </SheetSection>
      )}
    </HeroSheetScreen>
  );
}
