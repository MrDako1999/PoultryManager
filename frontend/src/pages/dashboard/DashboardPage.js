import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            {t('dashboard.welcome', { name: user?.firstName || '' })}
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
