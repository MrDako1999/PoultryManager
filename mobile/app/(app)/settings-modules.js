import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Bird, Egg, Feather, Factory, ShoppingBag, Wrench, Check, Lock, Puzzle,
} from 'lucide-react-native';
import useAuthStore from '@/stores/authStore';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';

const MODULE_META = {
  broiler: { icon: Bird, color: '#059669', darkColor: '#34d399' },
  hatchery: { icon: Egg, color: '#d97706', darkColor: '#fbbf24' },
  freeRange: { icon: Feather, color: '#0284c7', darkColor: '#38bdf8' },
  eggProduction: { icon: Egg, color: '#ea580c', darkColor: '#fb923c' },
  slaughterhouse: { icon: Factory, color: '#dc2626', darkColor: '#f87171' },
  marketing: { icon: ShoppingBag, color: '#9333ea', darkColor: '#a78bfa' },
  equipment: { icon: Wrench, color: '#475569', darkColor: '#94a3b8' },
};

const ALL_MODULES = [
  'broiler', 'hatchery', 'freeRange', 'eggProduction', 'slaughterhouse', 'marketing', 'equipment',
];

export default function SettingsModulesScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const activeModules = user?.modules || [];
  const { dark, accentColor, mutedColor, textColor, borderColor, sectionBg } = useHeroSheetTokens();

  const activeCount = ALL_MODULES.filter((m) => activeModules.includes(m)).length;

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
      <Puzzle size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  const headerRight = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: '#ffffff',
          letterSpacing: 0.4,
        }}
      >
        {activeCount} {t('common.active', 'Active')}
      </Text>
    </View>
  );

  return (
    <HeroSheetScreen
      title={t('settings.modules', 'Modules')}
      subtitle={t('settings.modulesDesc', 'Active poultry modules on your account')}
      heroExtra={heroExtra}
      headerRight={headerRight}
    >
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
        {ALL_MODULES.map((moduleKey) => {
          const isActive = activeModules.includes(moduleKey);
          const meta = MODULE_META[moduleKey] || { icon: Wrench, color: '#475569', darkColor: '#94a3b8' };
          const Icon = meta.icon;
          const iconColor = dark ? meta.darkColor : meta.color;

          return (
            <View
              key={moduleKey}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 14,
                borderRadius: 16,
                backgroundColor: sectionBg,
                borderWidth: 1,
                borderColor: isActive
                  ? (dark ? 'rgba(148,210,165,0.30)' : 'hsl(148, 35%, 86%)')
                  : borderColor,
                opacity: isActive ? 1 : 0.6,
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
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  backgroundColor: isActive
                    ? (dark ? `${iconColor}26` : `${iconColor}1F`)
                    : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={20} color={isActive ? iconColor : mutedColor} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: textColor,
                  }}
                >
                  {t(`modules.${moduleKey}`, moduleKey)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                  }}
                  numberOfLines={2}
                >
                  {t(`modules.${moduleKey}Desc`, '')}
                </Text>
              </View>
              {isActive ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Check size={11} color={accentColor} strokeWidth={3} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-SemiBold',
                      color: accentColor,
                    }}
                  >
                    {t('common.active', 'Active')}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Lock size={10} color={mutedColor} strokeWidth={2.4} />
                  <Text style={{ fontSize: 11, fontFamily: 'Poppins-Medium', color: mutedColor }}>
                    {t('modules.comingSoon', 'Coming Soon')}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </HeroSheetScreen>
  );
}
