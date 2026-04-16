import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  UserPlus,
  MoreVertical,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Loader2,
  Users,
  Copy,
  Trash2,
} from 'lucide-react';
import PhoneInput from '@/components/PhoneInput';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';
import { ACCOUNT_ROLES as ALL_ROLES } from '@poultrymanager/shared';

// Exclude 'owner' from the assignable-role list — owners are created via
// registration, not the team settings flow.
const ACCOUNT_ROLES = ALL_ROLES.filter((r) => r !== 'owner');

const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  accountRole: z.string().min(1, 'Role is required'),
});

const ROLE_COLORS = {
  owner: 'default',
  manager: 'default',
  veterinarian: 'success',
  accountant: 'warning',
  ground_staff: 'secondary',
  viewer: 'outline',
};

export default function TeamSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      accountRole: 'viewer',
    },
  });

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const selectedRole = watch('accountRole');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingUser(null);
    resetGuard();
    reset();
  };

  const tryClose = () => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      closeSheet();
      setTempPasswordInfo({
        name: `${res.data.user.firstName} ${res.data.user.lastName}`,
        email: res.data.user.email,
        password: res.data.tempPassword,
      });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.createUserError'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      closeSheet();
      toast({ title: t('settings.userUpdated') });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.updateUserError'),
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: t('settings.userStatusUpdated') });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id) => api.post(`/users/${id}/reset-password`),
    onSuccess: (res, id) => {
      const member = teamMembers.find((m) => m._id === id);
      setTempPasswordInfo({
        name: member ? `${member.firstName} ${member.lastName}` : '',
        email: member?.email || '',
        password: res.data.tempPassword,
      });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.resetPasswordError'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: t('settings.userRemoved') });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message,
        variant: 'destructive',
      });
    },
  });

  const openCreateSheet = () => {
    resetGuard();
    setEditingUser(null);
    reset({ firstName: '', lastName: '', email: '', phone: '', accountRole: 'viewer' });
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = (member) => {
    resetGuard();
    setEditingUser(member);
    reset({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone || '',
      accountRole: member.accountRole,
    });
    setSheetOpen(true);
    armGuard();
  };

  const onSubmit = (data) => {
    if (editingUser) {
      const { email, ...updateData } = data;
      updateMutation.mutate({ id: editingUser._id, data: updateData });
    } else {
      createMutation.mutate(data);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('settings.copied') });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('settings.teamTitle')}</CardTitle>
              <CardDescription>{t('settings.teamDesc')}</CardDescription>
            </div>
            <Button onClick={openCreateSheet} size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.addUser')}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('settings.noTeamMembers')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('settings.noTeamMembersDesc')}
              </p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t('settings.addFirstUser')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {`${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <Badge variant={ROLE_COLORS[member.accountRole] || 'secondary'}>
                        {t(`settings.roles.${member.accountRole}`)}
                      </Badge>
                      {!member.isActive && (
                        <Badge variant="destructive">{t('common.inactive')}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditSheet(member)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => resetPasswordMutation.mutate(member._id)}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        {t('settings.resetPassword')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: member._id,
                            isActive: !member.isActive,
                          })
                        }
                      >
                        {member.isActive ? (
                          <>
                            <UserX className="mr-2 h-4 w-4" />
                            {t('settings.deactivate')}
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            {t('settings.activate')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(member._id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('settings.removeUser')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingUser ? t('settings.editUser') : t('settings.addUser')}
            </SheetTitle>
            <SheetDescription>
              {editingUser ? t('settings.editUserDesc') : t('settings.addUserDesc')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="team-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sub-firstName">{t('auth.firstName')}</Label>
                  <Input id="sub-firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub-lastName">{t('auth.lastName')}</Label>
                  <Input id="sub-lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub-email">{t('auth.email')}</Label>
                <Input
                  id="sub-email"
                  type="email"
                  {...register('email')}
                  disabled={!!editingUser}
                  className={editingUser ? 'opacity-60' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('auth.phone')}</Label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('settings.accountRole')}</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(val) => {
                    setValue('accountRole', val, { shouldValidate: true, shouldDirty: true });
                    markDirty();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('settings.selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`settings.roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.accountRole && (
                  <p className="text-sm text-destructive">{errors.accountRole.message}</p>
                )}
              </div>

              {!editingUser && (
                <p className="text-xs text-muted-foreground">
                  {t('settings.tempPasswordNote')}
                </p>
              )}
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="team-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUser ? t('common.save') : t('settings.createUser')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={closeSheet}
      />

      {/* Temporary Password Dialog */}
      <Dialog open={!!tempPasswordInfo} onOpenChange={() => setTempPasswordInfo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.tempPasswordTitle')}</DialogTitle>
            <DialogDescription>{t('settings.tempPasswordDesc')}</DialogDescription>
          </DialogHeader>
          {tempPasswordInfo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('common.name')}</Label>
                <p className="font-medium">{tempPasswordInfo.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('auth.email')}</Label>
                <p className="font-medium">{tempPasswordInfo.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('settings.temporaryPassword')}</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                    {tempPasswordInfo.password}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(tempPasswordInfo.password)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.tempPasswordWarning')}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTempPasswordInfo(null)}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
