import { useTranslation } from 'react-i18next';
import {
  MoreVertical,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_BADGE_VARIANT = {
  owner: 'default',
  manager: 'default',
  veterinarian: 'success',
  accountant: 'warning',
  ground_staff: 'secondary',
  viewer: 'outline',
};

/**
 * Web team-member row. Mirrors the mobile row data 1:1:
 *   - avatar + name
 *   - role pill
 *   - active/deactivated badge (or "Removed" in audit view)
 *   - app-access vs HR-only pill
 *   - scope summary ("2 farms" / "All farms")
 *   - kebab: Edit, Reset Password, Deactivate/Activate, Remove
 */
export default function TeamMemberRow({
  member,
  worker,
  onEdit,
  onResetPassword,
  onToggleActive,
  onRemove,
  isRemoved = false,
}) {
  const { t } = useTranslation();

  const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
  const isUnscoped = ['owner', 'manager', 'accountant', 'viewer', 'veterinarian'].includes(member.accountRole);
  const farmsCount = Array.isArray(worker?.farmAssignments) ? worker.farmAssignments.length : 0;
  const scopeLabel = isUnscoped
    ? t('settings.scopeAllFarms', 'All farms')
    : farmsCount === 0
      ? t('settings.scopeNoFarms', 'No farms')
      : t('settings.scopeNFarms', '{{n}} farms', { n: farmsCount });

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-primary/10 text-xs text-primary">
          {initials || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{fullName}</p>
          <Badge variant={ROLE_BADGE_VARIANT[member.accountRole] || 'secondary'}>
            {t(`settings.roles.${member.accountRole}`, member.accountRole)}
          </Badge>
          {isRemoved ? (
            <Badge variant="destructive">{t('settings.removedBadge', 'Removed')}</Badge>
          ) : !member.isActive ? (
            <Badge variant="destructive">{t('common.inactive', 'Deactivated')}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t('common.active', 'Active')}</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {t('settings.appAccessBadge', 'App access')}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{member.email}</span>
          <span>·</span>
          <span>{scopeLabel}</span>
        </div>
      </div>

      {!isRemoved ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('common.edit', 'Edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onResetPassword}>
              <KeyRound className="mr-2 h-4 w-4" />
              {t('settings.resetPassword', 'Reset Password')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleActive}>
              {member.isActive ? (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  {t('settings.deactivate', 'Deactivate')}
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  {t('settings.activate', 'Activate')}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onRemove}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('settings.removeUser', 'Remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
