import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import PasswordInput from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { stopPeriodicSync, clearAll } from '@/lib/syncEngine';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function SecuritySettings() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => api.put('/settings/password', data),
    onSuccess: () => {
      reset();
      toast({ title: t('settings.passwordUpdated') });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.passwordUpdateError'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data) =>
    mutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.securityTitle')}</CardTitle>
          <CardDescription>{t('settings.securityDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
              <PasswordInput id="currentPassword" {...register('currentPassword')} />
              {errors.currentPassword && (
                <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
              <PasswordInput id="newPassword" {...register('newPassword')} />
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('settings.confirmNewPassword')}</Label>
              <PasswordInput id="confirmPassword" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}

// "Danger zone" card. Keeps account-destruction in the same page as password
// change, which is the same convention every other SaaS uses (Stripe,
// Notion, Linear). Two-step confirm: (1) click the button, (2) type your
// email in the confirm dialog. Only a copy-paste of the user's own email
// arms the destructive button — protects against accidental clicks.
function DeleteAccountCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const isOwner = !!user && !user.createdBy;
  const email = user?.email || '';
  const workspaceName = user?.workspace?.ownerName || user?.workspace?.businessName || '';

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const matches = typed.trim().toLowerCase() === email.toLowerCase() && email.length > 0;

  const mutation = useMutation({
    mutationFn: () => api.delete('/auth/me'),
    onSuccess: async () => {
      // Mirror the existing logout flow: stop background sync, clear the
      // local cache, blow away module + auth state, then send the user to
      // the marketing landing. We don't call /auth/logout because the
      // backend already cleared the cookie when it processed the delete.
      try {
        stopPeriodicSync();
        await clearAll();
      } catch {
        // Sync cleanup is best-effort — the auth state reset is what
        // actually matters for getting the user out of the dashboard.
      }
      useAuthStore.setState({ user: null });
      try { await refreshUser?.(); } catch {}
      toast({ title: t('settings.deleteAccountSuccess') });
      navigate('/', { replace: true });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.deleteAccountError'),
        variant: 'destructive',
      });
    },
  });

  const description = isOwner
    ? t('settings.deleteAccountOwnerDesc')
    : t('settings.deleteAccountSubuserDesc');

  const confirmWarning = isOwner
    ? t('settings.deleteAccountConfirmOwnerWarning')
    : t('settings.deleteAccountConfirmSubuserWarning', { workspace: workspaceName || '—' });

  return (
    <>
      <Card className="border-destructive/40 bg-destructive/[0.02] dark:bg-destructive/[0.04]">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-destructive">
                {t('settings.deleteAccountTitle')}
              </CardTitle>
              <CardDescription className="mt-1.5 leading-relaxed">
                {description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => { setTyped(''); setOpen(true); }}
            disabled={mutation.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('settings.deleteAccountButton')}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteAccountConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {confirmWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-account-email-confirm">
              {t('settings.deleteAccountConfirmInputLabel')}
            </Label>
            <Input
              id="delete-account-email-confirm"
              type="email"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('settings.deleteAccountConfirmInputPlaceholder')}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.deleteAccountConfirmInputHelp', { email })}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Don't auto-close the dialog from AlertDialogAction's
                // built-in onSelect — wait for the API to finish first.
                e.preventDefault();
                if (!matches || mutation.isPending) return;
                mutation.mutate();
              }}
              disabled={!matches || mutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.deleteAccountConfirmCta')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
