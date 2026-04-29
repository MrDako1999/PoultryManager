// Shared shell for all the slaughterhouse role-home screens. Mirrors
// broiler's WorkerHome shape: PageTitle + a single primary CTA + a
// list of items the role needs to act on. Roles plug their own
// title / CTA / item list in via props so we keep one consistent
// landing experience across the operational workforce.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageTitle from '@/components/ui/page-title';
import { ChevronRight } from 'lucide-react';
import useAuthStore from '@/stores/authStore';

export default function RoleHomeShell({
  title,
  subtitle,
  primaryAction,        // { label, onClick, icon: Icon }
  items,                // Array<{ key, primary, secondary, onClick, icon: Icon }>
  emptyState,           // { icon: Icon, title, description, cta }
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const Empty = emptyState?.icon;
  const Primary = primaryAction?.icon;

  return (
    <div className="space-y-4">
      <PageTitle
        title={title || t('dashboard.welcome', { name: user?.firstName || '' })}
        subtitle={subtitle}
        actions={primaryAction ? (
          <Button size="sm" className="gap-1.5" onClick={primaryAction.onClick}>
            {Primary ? <Primary className="h-3.5 w-3.5" /> : null}
            {primaryAction.label}
          </Button>
        ) : null}
      />

      {(!items || items.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            {Empty ? (
              <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
                <Empty className="h-8 w-8 text-muted-foreground" />
              </div>
            ) : null}
            {emptyState?.title ? (
              <h3 className="mb-1 text-lg font-semibold">{emptyState.title}</h3>
            ) : null}
            {emptyState?.description ? (
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                {emptyState.description}
              </p>
            ) : null}
            {emptyState?.cta ? (
              <Button size="sm" className="gap-1.5" onClick={emptyState.cta.onClick}>
                {emptyState.cta.icon ? <emptyState.cta.icon className="h-3.5 w-3.5" /> : null}
                {emptyState.cta.label}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={it.onClick}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  {Icon ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.primary}</p>
                    {it.secondary ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{it.secondary}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
