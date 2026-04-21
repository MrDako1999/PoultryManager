import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, Lock, RotateCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';

const REASON_LABELS = {
  paymentFailed: 'Payment failed',
  canceled: 'Subscription canceled',
  incomplete: 'Subscription incomplete',
  paused: 'Subscription paused',
  unknown: 'Subscription inactive',
  noState: 'Subscription inactive',
};

/**
 * Full-screen, non-dismissable billing lock for the web app. Two
 * variants per SUBSCRIPTION.md §"UX":
 *
 *   - Owner sees credit-card icon, status reason, plus three actions:
 *     Fix Billing (opens Stripe portal in new tab), Retry, Sign Out.
 *
 *   - Sub-user sees a generic lock icon, "No active subscription"
 *     copy, plus Retry and Sign Out only. No owner contact info — by
 *     design.
 *
 * Retry calls /auth/me directly via the auth store's refreshUser so
 * the payload (including workspace.subscription.policy) updates and
 * the gate flips automatically.
 */
export default function BillingLockScreen({ isOwner, reason }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);

  const [retrying, setRetrying] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const Icon = isOwner ? CreditCard : Lock;
  const reasonLabel = REASON_LABELS[reason] || REASON_LABELS.unknown;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshUser();
    } finally {
      setRetrying(false);
    }
  };

  const handleFixBilling = async () => {
    setOpeningPortal(true);
    try {
      const { data } = await api.get('/billing/portal-url');
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: t('billing.portalUnavailableTitle', 'Billing not yet available'),
          description: t(
            'billing.portalUnavailableDesc',
            'The billing portal will be enabled once Stripe is connected.'
          ),
        });
      }
    } catch {
      toast({
        title: t('billing.portalUnavailableTitle', 'Billing not yet available'),
        description: t(
          'billing.portalUnavailableDesc',
          'The billing portal will be enabled once Stripe is connected.'
        ),
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              isOwner ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            }`}
          >
            <Icon className="h-8 w-8" strokeWidth={2} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {isOwner
              ? t('billing.ownerTitle', 'Your subscription needs attention')
              : t('billing.subUserTitle', 'No active subscription')}
          </h1>

          {isOwner ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
              {t(`billing.reason.${reason || 'unknown'}`, reasonLabel)}
            </p>
          ) : null}

          <p className="text-sm text-muted-foreground">
            {isOwner
              ? t(
                  'billing.ownerBody',
                  'Your most recent payment didn\'t go through. To keep your team working, please update your payment method.'
                )
              : t(
                  'billing.subUserBody',
                  'This workspace doesn\'t have an active subscription right now, so the app is unavailable. Your work is saved and will resume the moment access is restored.'
                )}
          </p>

          <div className="mt-2 flex w-full flex-col gap-2">
            {isOwner ? (
              <Button onClick={handleFixBilling} disabled={openingPortal} className="gap-2">
                <CreditCard className="h-4 w-4" />
                {t('billing.fixBilling', 'Fix Billing')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleRetry} disabled={retrying} className="gap-2">
              <RotateCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
              {t('billing.retry', 'Retry')}
            </Button>
            <Button variant="ghost" onClick={handleSignOut} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              {t('auth.logout', 'Sign Out')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
