import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import useCapabilities from '@/hooks/useCapabilities';
import EmptyState from '@/components/ui/EmptyState';
import { Calculator } from 'lucide-react-native';
import { MODULES } from '@/modules/registry';

export default function AccountingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { visibleModules, can } = useCapabilities();

  const views = useMemo(() => {
    const out = [];
    for (const id of visibleModules) {
      const mod = MODULES[id];
      for (const view of mod?.accountingViews || []) {
        if (view.capability && !can(view.capability)) continue;
        out.push({ ...view, moduleId: id });
      }
    }
    return out;
  }, [visibleModules, can]);

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

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3">
        <Text className="text-xl font-bold text-foreground mb-3">
          {t('nav.accounting', 'Accounting')}
        </Text>

        {views.length > 1 && (
          <View className="flex-row rounded-lg border border-border bg-muted/30 p-0.5 mb-3">
            {views.map((view) => {
              const key = `${view.moduleId}:${view.id}`;
              const isActive = key === tabKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTabKey(key)}
                  className={`flex-1 py-2 rounded-md items-center ${isActive ? 'bg-card' : ''}`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {t(view.labelKey, view.id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View className="flex-1">
        {ActiveComponent ? (
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
