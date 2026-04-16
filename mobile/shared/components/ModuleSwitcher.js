import { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react-native';
import useModuleStore from '@/stores/moduleStore';
import useCapabilities from '@/hooks/useCapabilities';
import useThemeStore from '@/stores/themeStore';
import { MODULES } from '@/modules/registry';

export default function ModuleSwitcher({ compact = false }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const { visibleModules } = useCapabilities();
  const activeModuleId = useModuleStore((s) => s.activeModule);
  const setActiveModule = useModuleStore((s) => s.setActiveModule);
  const [open, setOpen] = useState(false);

  if (!visibleModules || visibleModules.length < 2) return null;

  const activeModule = activeModuleId ? MODULES[activeModuleId] : null;
  const ActiveIcon = activeModule?.icon;
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const iconColor = activeModule
    ? (resolvedTheme === 'dark' ? activeModule.color?.dark : activeModule.color?.light)
    : primaryColor;

  const handleSelect = async (id) => {
    setOpen(false);
    if (id !== activeModuleId) {
      await setActiveModule(id);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5 active:bg-accent/50 ${compact ? '' : 'bg-card'}`}
      >
        {ActiveIcon && <ActiveIcon size={14} color={iconColor} />}
        <Text className="text-xs font-medium text-foreground">
          {activeModule ? t(activeModule.labelKey, activeModuleId) : t('modules.none', 'Select module')}
        </Text>
        <ChevronDown size={12} color={iconColor} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50" onPress={() => setOpen(false)} />
        <View
          className="absolute left-0 right-0 bottom-0 bg-card rounded-t-2xl border-t border-border"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <View className="items-center pt-2 pb-2">
            <View className="h-1 w-10 rounded-full bg-muted" />
          </View>
          <View className="px-4 pt-2 pb-3 border-b border-border">
            <Text className="text-base font-semibold text-foreground">
              {t('modules.switcherTitle', 'Switch module')}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {t('modules.switcherSubtitle', 'Choose which module to view')}
            </Text>
          </View>

          <View className="py-2">
            {visibleModules.map((id) => {
              const mod = MODULES[id];
              if (!mod) return null;
              const Icon = mod.icon;
              const moduleIconColor = resolvedTheme === 'dark' ? mod.color?.dark : mod.color?.light;
              const isActive = id === activeModuleId;

              return (
                <Pressable
                  key={id}
                  onPress={() => handleSelect(id)}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-accent/50"
                >
                  <View className="h-10 w-10 rounded-xl bg-muted items-center justify-center">
                    {Icon && <Icon size={20} color={moduleIconColor} />}
                  </View>
                  <View className="flex-1">
                    <Text className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                      {t(mod.labelKey, id)}
                    </Text>
                  </View>
                  {isActive && <Check size={16} color={primaryColor} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}
