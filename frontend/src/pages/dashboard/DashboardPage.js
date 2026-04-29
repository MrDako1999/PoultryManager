import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PageTitle from '@/components/ui/page-title';
import useAuthStore from '@/stores/authStore';
import useCapabilities from '@/hooks/useCapabilities';
import { MODULES } from '@/modules/registry';

// Generic dashboard shell. Composition:
//   1. If the active module provides a full-screen `roleDashboards[role]`
//      override (e.g. broiler -> WorkerHome for ground_staff), render it
//      unopposed and skip everything else.
//   2. Otherwise render a header (greeting + actions) plus a stack of
//      module-contributed `dashboardWidgets[]` filtered by capability and
//      sorted by `order`.
export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { visibleModules, activeModule, role, can } = useCapabilities();

  const RoleDashboard = useMemo(() => {
    const mod = activeModule ? MODULES[activeModule] : null;
    return mod?.roleDashboards?.[role] || null;
  }, [activeModule, role]);

  // Scope widgets to the active module so the picker actually swaps the
  // dashboard. Falls back to visibleModules when no active module is set
  // (single-module accounts where the switcher never appears).
  const widgets = useMemo(() => {
    const out = [];
    const moduleIds = activeModule
      ? [activeModule].filter((id) => visibleModules.includes(id))
      : visibleModules;
    for (const id of moduleIds) {
      const mod = MODULES[id];
      for (const widget of mod?.dashboardWidgets || []) {
        if (widget.capability && !can(widget.capability)) continue;
        out.push({ ...widget, moduleId: id });
      }
    }
    out.sort((a, b) => (a.order || 0) - (b.order || 0));
    return out;
  }, [activeModule, visibleModules, can]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (RoleDashboard) {
    return <RoleDashboard />;
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={t('dashboard.welcome', { name: user?.firstName || '' })}
        subtitle={today}
        actions={
          <>
            {can('batch:create') && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/dashboard/batches', { state: { openNew: true } })}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('dashboard.newBatch')}
              </Button>
            )}
            {can('batch:read') && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/dashboard/batches')}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {t('dashboard.viewBatches')}
              </Button>
            )}
          </>
        }
      />

      {widgets.map((widget) => {
        const W = widget.component;
        if (!W) return null;
        return (
          <div key={`${widget.moduleId}:${widget.id}`}>
            <W />
          </div>
        );
      })}

      {widgets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t('dashboard.noWidgets', 'No dashboard widgets available for your role.')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
