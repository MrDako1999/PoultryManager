import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, Copy,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import PhoneInput from '@/components/PhoneInput';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import {
  ACCOUNT_ROLES as ALL_ROLES,
  MODULE_CAPABILITIES,
} from '@poultrymanager/shared';
import ScopeEditor from './ScopeEditor';
import PermissionEditor from './PermissionEditor';

const ACCOUNT_ROLES = ALL_ROLES.filter((r) => r !== 'owner');

const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
});

const ROLE_HELP = {
  manager: 'Full access to operations across the workspace.',
  veterinarian: 'Read batches, log weights and environment.',
  accountant: 'Read batches, full access to sales/expenses/feed orders.',
  ground_staff: 'Records daily logs for assigned farms.',
  viewer: 'Read-only access across all data.',
};

/**
 * Three-step team invite wizard. Mirrors the mobile InviteUserSheet
 * exactly so an owner switching platforms sees the same flow.
 *
 *   Page 1 - Person: name, email, phone, "Give app access" toggle.
 *   Page 2 - Access: role, scope (farm picker), advanced permissions.
 *   Page 3 - Done: success message + temp password (when invited).
 *
 * Page 2 is only rendered when grantAccess is on. With it off, the
 * wizard short-circuits to "Create" on page 1 and creates an HR-only
 * worker via POST /api/workers (no login, no page 3).
 *
 * The success state stays inside the same sheet rather than popping a
 * separate centered modal. The previous implementation closed the
 * sheet then opened a Dialog, which felt like an interruption of the
 * creation flow. Keeping it inline turns "create user" into a single
 * smooth wizard.
 */
export default function InviteUserDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userModules = Array.isArray(user?.modules) ? user.modules : [];

  const [step, setStep] = useState(1);
  const [grantAccess, setGrantAccess] = useState(true);
  const [accountRole, setAccountRole] = useState('viewer');
  const [farmAssignments, setFarmAssignments] = useState([]);
  const [permissions, setPermissions] = useState({ allow: [], deny: [] });
  const [createdSummary, setCreatedSummary] = useState(null);

  const {
    register,
    reset,
    control,
    trigger,
    getValues,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(personSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  });

  const formGuard = useFormGuard(isDirty);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(1);
      setGrantAccess(true);
      setAccountRole('viewer');
      setFarmAssignments([]);
      setPermissions({ allow: [], deny: [] });
      setCreatedSummary(null);
      reset({ firstName: '', lastName: '', email: '', phone: '' });
      formGuard.armGuard();
    } else {
      formGuard.resetGuard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tryClose = () => {
    // On the success step the form is no longer "dirty" in the
    // user-input sense — they've already saved. Close immediately so
    // they don't get the discard prompt on a finished record.
    if (step === 3 || !formGuard.isDirty) {
      onOpenChange(false);
      return;
    }
    formGuard.setConfirmOpen(true);
  };

  // Auto-show scope picker only when the picked role's capability list
  // contains a :assigned-suffixed action (i.e. it's a scoped role).
  const roleNeedsScope = useMemo(() => {
    for (const moduleId of userModules) {
      const caps = MODULE_CAPABILITIES[moduleId];
      const list = caps?.[accountRole] || [];
      if (list.some((a) => a.endsWith(':assigned'))) return true;
    }
    return false;
  }, [accountRole, userModules]);

  const inviteMutation = useMutation({
    mutationFn: async (payload) => {
      if (grantAccess) {
        const { data } = await api.post('/users', payload);
        return { ...data, kind: 'invited' };
      }
      const { data } = await api.post('/workers', payload);
      return { worker: data, kind: 'hr' };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      formGuard.resetGuard();

      if (res.kind === 'invited') {
        // Stay in the wizard, advance to the Done step. The temp
        // password is shown inline rather than via a separate centered
        // modal so the flow feels like a single sequence.
        setCreatedSummary({
          kind: 'invited',
          name: `${res.user.firstName} ${res.user.lastName}`,
          email: res.user.email,
          password: res.tempPassword,
        });
        setStep(3);
      } else {
        // HR-only: nothing secret to show, just confirm and close.
        toast({ title: t('settings.workerCreated', 'Worker added') });
        onOpenChange(false);
      }
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.createUserError', 'Failed to add team member'),
        variant: 'destructive',
      });
    },
  });

  const copyPassword = () => {
    if (!createdSummary?.password) return;
    navigator.clipboard.writeText(createdSummary.password);
    toast({ title: t('settings.copied', 'Copied') });
  };

  // Step 1 "Next" — validates the person fields. With grantAccess on,
  // moves to step 2 so the user can set role/scope/permissions BEFORE
  // any POST. With grantAccess off (HR-only) submits immediately.
  const onNext = async () => {
    const ok = await trigger(['firstName', 'lastName', 'email']);
    if (!ok) return;
    if (!grantAccess) {
      submitInvite();
    } else {
      setStep(2);
    }
  };

  // Hard-locked submission path. Pulls the latest values directly from
  // the form via getValues — no form auto-submit, no react-hook-form
  // handleSubmit wrapper, no chance of an Enter-key or button-pickup
  // race firing this prematurely. The ONLY caller is the explicit
  // "Create User" button on step 2 (and the HR-only branch of onNext).
  const submitInvite = () => {
    if (grantAccess && step !== 2) {
      // Defense-in-depth — should never fire, but if a stray code path
      // ever calls submitInvite while we're not on the access step we
      // refuse to create the user.
      return;
    }
    const data = getValues();
    if (grantAccess) {
      inviteMutation.mutate({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || '',
        accountRole,
        permissions,
        farmAssignments,
      });
    } else {
      inviteMutation.mutate({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || '',
        farmAssignments,
      });
    }
  };

  const isPending = inviteMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {step === 1
                ? t('settings.addUser', 'Add User')
                : step === 2
                  ? t('settings.accessTitle', 'Access')
                  : t('settings.userCreatedTitle', 'User created')}
            </SheetTitle>
            <SheetDescription>
              {step === 1
                ? t('settings.addUserPersonDesc', 'Who is this person?')
                : step === 2
                  ? t('settings.addUserAccessDesc', 'What can they do?')
                  : t('settings.userCreatedDesc', 'Share these credentials securely. They\'ll only be shown here once.')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {/*
              Intentionally NOT a <form>. The wizard advances via
              explicit button clicks (onNext / submitInvite). A real
              <form> + handleSubmit was firing on the Enter key and on
              one-click "button pickup" between step transitions, which
              created the user on step 2 before the owner had a chance
              to set role/scope/permissions.

              Inputs still wire through react-hook-form via register()
              for validation and dirty tracking — they just don't
              participate in any form submission.
            */}
            <div className="space-y-4 px-6 py-4">
              {step === 1 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="invite-firstName">{t('auth.firstName', 'First Name')}</Label>
                      <Input id="invite-firstName" {...register('firstName')} />
                      {errors.firstName && (
                        <p className="text-sm text-destructive">{errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-lastName">{t('auth.lastName', 'Last Name')}</Label>
                      <Input id="invite-lastName" {...register('lastName')} />
                      {errors.lastName && (
                        <p className="text-sm text-destructive">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-email">
                      {t('auth.email', 'Email')}
                      {!grantAccess ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('common.optional', 'optional')}
                        </span>
                      ) : null}
                    </Label>
                    <Input id="invite-email" type="email" {...register('email')} />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('auth.phone', 'Phone')}</Label>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <PhoneInput value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <Label htmlFor="invite-grant" className="text-sm font-medium">
                        {t('settings.giveAppAccess', 'Give app access')}
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(
                          'settings.giveAppAccessDesc',
                          'Create a login. Off = HR-only directory entry.'
                        )}
                      </p>
                    </div>
                    <Switch
                      id="invite-grant"
                      checked={grantAccess}
                      onCheckedChange={setGrantAccess}
                    />
                  </div>
                </>
              ) : step === 2 ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('settings.accountRole', 'Role')}</Label>
                    <Select value={accountRole} onValueChange={setAccountRole}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('settings.selectRole', 'Select role')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`settings.roles.${r}`, r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t(`settings.roleHelp.${accountRole}`, ROLE_HELP[accountRole] || '')}
                    </p>
                  </div>

                  {roleNeedsScope ? (
                    <div className="space-y-2">
                      <Label>{t('settings.assignedFarms', 'Assigned farms')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.assignedFarmsDesc',
                          'This role only sees data for farms you assign here.'
                        )}
                      </p>
                      <ScopeEditor value={farmAssignments} onChange={setFarmAssignments} />
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.unscopedRoleNote',
                          'This role sees all farms and houses by default. No farm assignment needed.'
                        )}
                      </p>
                    </div>
                  )}

                  <PermissionEditor
                    role={accountRole}
                    activeModules={userModules}
                    value={permissions}
                    onChange={setPermissions}
                  />

                  <p className="text-xs text-muted-foreground">
                    {t('settings.tempPasswordNote', 'A temporary password will be generated. Share it securely.')}
                  </p>
                </>
              ) : (
                createdSummary ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          {t('settings.userCreatedHeader', 'Account created')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(
                            'settings.userCreatedHelp',
                            'They can sign in immediately with the temporary password below. They\'ll be asked to change it on first login.'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {t('common.name', 'Name')}
                        </span>
                        <span className="text-sm font-medium">{createdSummary.name}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {t('auth.email', 'Email')}
                        </span>
                        <span className="text-sm font-medium">{createdSummary.email}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('settings.temporaryPassword', 'Temporary password')}
                      </Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 select-all rounded bg-muted px-3 py-2 font-mono text-sm">
                          {createdSummary.password}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={copyPassword}
                          aria-label={t('common.copy', 'Copy')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.tempPasswordWarning',
                          'This password will only be shown once. Make sure to copy it now.'
                        )}
                      </p>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </ScrollArea>

          <SheetFooter>
            {step === 3 ? (
              <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                {t('common.done', 'Done')}
              </Button>
            ) : (
              <>
                {step === 2 ? (
                  <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isPending}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('common.back', 'Back')}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={tryClose} disabled={isPending}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                )}
                {step === 1 ? (
                  <Button type="button" onClick={onNext} disabled={isPending}>
                    {grantAccess ? (
                      <>
                        {t('common.next', 'Next')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.create', 'Create')}
                      </>
                    ) : (
                      t('common.create', 'Create')
                    )}
                  </Button>
                ) : (
                  <Button type="button" onClick={submitInvite} disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('settings.createUser', 'Create User')}
                  </Button>
                )}
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={formGuard.confirmOpen}
        onOpenChange={formGuard.setConfirmOpen}
        onDiscard={() => onOpenChange(false)}
      />
    </>
  );
}
