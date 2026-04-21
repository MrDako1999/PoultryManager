import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserPlus, Loader2, Users, Copy } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import InviteUserDialog from './team/InviteUserDialog';
import TeamMemberSheet from './team/TeamMemberSheet';
import TeamMemberRow from './team/TeamMemberRow';

/**
 * Web Team settings shell. Mirrors the mobile Settings -> Team screen
 * exactly:
 *   - Member list with role/status/access/scope badges (TeamMemberRow).
 *   - "Add User" button opens the two-step InviteUserDialog wizard.
 *   - Kebab on each row routes to TeamMemberSheet (edit) or fires a
 *     mutation directly (reset password, deactivate/activate, remove).
 *   - "Show removed" toggle flips the list to ?includeDeleted=true for
 *     the audit view.
 */
export default function TeamSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members', { showRemoved }],
    queryFn: async () => {
      const url = showRemoved ? '/users?includeDeleted=true' : '/users';
      const { data } = await api.get(url);
      return data;
    },
  });

  // Workers are loaded once and cross-referenced by linkedUser so each
  // row can show the scope summary without per-row queries.
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data } = await api.get('/workers');
      return data;
    },
  });

  const workerByLinkedUser = useMemo(() => {
    const map = new Map();
    for (const w of workers) {
      const linkedId = typeof w.linkedUser === 'object' ? w.linkedUser?._id : w.linkedUser;
      if (linkedId) map.set(String(linkedId), w);
    }
    return map;
  }, [workers]);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: t('settings.userStatusUpdated', 'Status updated') });
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
        description: err.response?.data?.message || t('settings.resetPasswordError', 'Failed'),
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('settings.copied', 'Copied') });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>{t('settings.teamTitle', 'Team Members')}</CardTitle>
              <CardDescription>
                {t('settings.teamDesc', 'Manage who has access to your account')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-removed"
                  checked={showRemoved}
                  onCheckedChange={setShowRemoved}
                />
                <Label htmlFor="show-removed" className="cursor-pointer text-xs text-muted-foreground">
                  {t('settings.showRemoved', 'Show removed')}
                </Label>
              </div>
              <Button onClick={() => setInviteOpen(true)} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.addUser', 'Add User')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">
                {t('settings.noTeamMembers', 'No team members yet')}
              </h3>
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                {t(
                  'settings.noTeamMembersDesc',
                  'Add team members to give them access to your account with specific roles and permissions.'
                )}
              </p>
              <Button onClick={() => setInviteOpen(true)} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t('settings.addFirstUser', 'Add Your First Team Member')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <TeamMemberRow
                  key={member._id}
                  member={member}
                  worker={workerByLinkedUser.get(String(member._id))}
                  isRemoved={showRemoved && !!member.deletedAt}
                  onEdit={() => setEditing(member)}
                  onResetPassword={() => resetPasswordMutation.mutate(member._id)}
                  onToggleActive={() =>
                    toggleActiveMutation.mutate({
                      id: member._id,
                      isActive: !member.isActive,
                    })
                  }
                  onRemove={() => {
                    if (window.confirm(t(
                      'settings.removeUserDesc',
                      'This person will lose access immediately. Their authored records stay intact. This cannot be undone from the UI.'
                    ))) {
                      removeMutation.mutate(member._id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      <TeamMemberSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        member={editing}
        worker={editing ? workerByLinkedUser.get(String(editing._id)) : null}
        onTempPassword={setTempPasswordInfo}
      />

      <Dialog open={!!tempPasswordInfo} onOpenChange={() => setTempPasswordInfo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.tempPasswordTitle', 'Temporary password')}</DialogTitle>
            <DialogDescription>
              {t('settings.tempPasswordDesc', 'Share this securely with the team member.')}
            </DialogDescription>
          </DialogHeader>
          {tempPasswordInfo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('common.name', 'Name')}</Label>
                <p className="font-medium">{tempPasswordInfo.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('auth.email', 'Email')}</Label>
                <p className="font-medium">{tempPasswordInfo.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {t('settings.temporaryPassword', 'Temporary password')}
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
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
                {t(
                  'settings.tempPasswordWarning',
                  'This password will only be shown once. The user must change it on first login.'
                )}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTempPasswordInfo(null)}>
              {t('common.confirm', 'OK')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
