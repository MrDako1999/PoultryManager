import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { KeyRound, Trash2, Loader2 } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

/**
 * View / edit an existing team member. Mirrors the mobile
 * TeamMemberSheet — same fields, same actions in the same order:
 *   - HR / Person fields (page 1 equivalent)
 *   - Role + Scope + Permissions (page 2 equivalent)
 *   - Reset Password + Remove buttons at the bottom
 */
export default function TeamMemberSheet({
  open,
  onOpenChange,
  member,
  worker,
  onTempPassword,
  onRemoved,
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userModules = Array.isArray(user?.modules) ? user.modules : [];

  const [accountRole, setAccountRole] = useState(member?.accountRole || 'viewer');
  const [farmAssignments, setFarmAssignments] = useState([]);
  const [permissions, setPermissions] = useState({ allow: [], deny: [] });
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: member?.firstName || '',
      lastName: member?.lastName || '',
      phone: member?.phone || '',
    },
  });

  const formGuard = useFormGuard(isDirty);

  useEffect(() => {
    if (!open || !member) return;
    setAccountRole(member.accountRole || 'viewer');
    setPermissions({
      allow: Array.isArray(member.permissions?.allow) ? member.permissions.allow : [],
      deny: Array.isArray(member.permissions?.deny) ? member.permissions.deny : [],
    });
    const farms = Array.isArray(worker?.farmAssignments)
      ? worker.farmAssignments.map((f) => (typeof f === 'object' ? f._id : f))
      : [];
    setFarmAssignments(farms.map(String));
    reset({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      phone: member.phone || '',
    });
    formGuard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?._id, worker?._id]);

  const tryClose = () => {
    if (formGuard.isDirty) formGuard.setConfirmOpen(true);
    else onOpenChange(false);
  };

  const roleNeedsScope = useMemo(() => {
    for (const moduleId of userModules) {
      const caps = MODULE_CAPABILITIES[moduleId];
      const list = caps?.[accountRole] || [];
      if (list.some((a) => a.endsWith(':assigned'))) return true;
    }
    return false;
  }, [accountRole, userModules]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => api.put(`/users/${member._id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      formGuard.resetGuard();
      onOpenChange(false);
      toast({ title: t('settings.userUpdated', 'Team member updated') });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.updateUserError', 'Failed to update'),
        variant: 'destructive',
      });
    },
  });

  const resetPwMutation = useMutation({
    mutationFn: async () => api.post(`/users/${member._id}/reset-password`),
    onSuccess: (res) => {
      onTempPassword?.({
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
        password: res.data.tempPassword,
      });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.resetPasswordError', 'Failed to reset password'),
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => api.delete(`/users/${member._id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setConfirmRemoveOpen(false);
      onOpenChange(false);
      onRemoved?.();
      toast({ title: t('settings.userRemoved', 'Team member removed') });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data) => {
    updateMutation.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || '',
      accountRole,
      permissions,
      farmAssignments,
    });
  };

  if (!member) return null;

  const isPending = updateMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {t('settings.editUser', 'Edit Team Member')}
            </SheetTitle>
            <SheetDescription>
              {member.email}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="team-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ts-firstName">{t('auth.firstName', 'First Name')}</Label>
                  <Input id="ts-firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ts-lastName">{t('auth.lastName', 'Last Name')}</Label>
                  <Input id="ts-lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
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

              <div className="space-y-2">
                <Label>{t('settings.accountRole', 'Role')}</Label>
                <Select value={accountRole} onValueChange={setAccountRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`settings.roles.${r}`, r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {roleNeedsScope ? (
                <div className="space-y-2">
                  <Label>{t('settings.assignedFarms', 'Assigned farms')}</Label>
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

              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-medium">
                  {t('settings.actions', 'Actions')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => resetPwMutation.mutate()}
                    disabled={resetPwMutation.isPending}
                  >
                    {resetPwMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    {t('settings.resetPassword', 'Reset Password')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmRemoveOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('settings.removeUser', 'Remove')}
                  </Button>
                </div>
              </div>
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose} disabled={isPending}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" form="team-edit-form" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save', 'Save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={formGuard.confirmOpen}
        onOpenChange={formGuard.setConfirmOpen}
        onDiscard={() => onOpenChange(false)}
      />

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.removeUserTitle', 'Remove team member?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'settings.removeUserDesc',
                'This person will lose access immediately. Their authored records (daily logs, sales, expenses, photos) stay intact and continue to show their name. This cannot be undone from the UI.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.removeUser', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
