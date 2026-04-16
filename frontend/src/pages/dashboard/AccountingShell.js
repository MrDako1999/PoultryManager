import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import useCapabilities from '@/hooks/useCapabilities';
import { MODULES } from '@/modules/registry';

// Minimal slot host — filled out in Phase 5. Placeholder renders each
// module's registered accounting tabs inline with a shadcn Tabs strip.
export default function AccountingShell() {
  const { t } = useTranslation();
  const { visibleModules, can } = useCapabilities();

  const tabs = useMemo(() => {
    const out = [];
    for (const id of visibleModules) {
      const mod = MODULES[id];
      for (const tab of mod?.accountingTabs || []) {
        if (tab.capability && !can(tab.capability)) continue;
        out.push({ ...tab, moduleId: id });
      }
    }
    return out;
  }, [visibleModules, can]);

  if (tabs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4 inline-flex">
            <Calculator className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {t('accounting.noViews', 'No accounting views available')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {t('accounting.noViewsDesc',
              'Your account has no modules with accounting views, or you lack permission to view them.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const defaultTab = tabs[0].id;

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      {tabs.length > 1 && (
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={`${tab.moduleId}:${tab.id}`} value={tab.id}>
              {t(tab.labelKey, tab.id)}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      {tabs.map((tab) => {
        const Component = tab.component;
        return (
          <TabsContent key={`${tab.moduleId}:${tab.id}`} value={tab.id} className="mt-0">
            {Component ? <Component /> : null}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
