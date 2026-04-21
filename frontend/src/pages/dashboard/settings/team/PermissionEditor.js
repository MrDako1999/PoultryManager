import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  MODULE_CATALOG,
  MODULE_CAPABILITIES,
  actionsForRole,
  actionMatches,
  parseAction,
} from '@poultrymanager/shared';

/**
 * Per-module permission editor.
 *
 * Layout:
 *   [Module] (collapsible)
 *     Entity (e.g. "Batches")
 *       [✓ read] [✓ create] [☐ update] [☐ delete]    ← verbs as toggle pills
 *     Entity (e.g. "Sources")
 *       [✓ read] ...
 *
 * Each pill represents one capability action (entity:verb[:scope]).
 * State model collapses allow + deny into a single boolean per row:
 *
 *   - "Granted" = action is allowed for this user, either by role
 *     default or via permissions.allow[].
 *   - "Denied"  = action is blocked, either implicitly (not in role
 *     defaults and not in allow[]) or explicitly (in deny[]).
 *
 * Toggling:
 *   - On a role-default action: turning OFF adds it to deny[]; turning
 *     ON removes it from deny[].
 *   - On a non-default action: turning ON adds it to allow[]; turning
 *     OFF removes it from allow[].
 */

const ENTITY_LABEL_KEYS = {
  batch: 'permissions.entities.batch',
  source: 'permissions.entities.source',
  feedOrder: 'permissions.entities.feedOrder',
  feedItem: 'permissions.entities.feedItem',
  saleOrder: 'permissions.entities.saleOrder',
  expense: 'permissions.entities.expense',
  dailyLog: 'permissions.entities.dailyLog',
  house: 'permissions.entities.house',
  farm: 'permissions.entities.farm',
  worker: 'permissions.entities.worker',
  contact: 'permissions.entities.contact',
  business: 'permissions.entities.business',
  transfer: 'permissions.entities.transfer',
  media: 'permissions.entities.media',
  settings: 'permissions.entities.settings',
};

const ENTITY_LABEL_FALLBACK = {
  batch: 'Batches',
  source: 'Sources',
  feedOrder: 'Feed Orders',
  feedItem: 'Feed Catalogue',
  saleOrder: 'Sales',
  expense: 'Expenses',
  dailyLog: 'Daily Logs',
  house: 'Houses',
  farm: 'Farms',
  worker: 'Workers',
  contact: 'Contacts',
  business: 'Businesses',
  transfer: 'Transfers',
  media: 'Media',
  settings: 'Settings',
};

// Order entities deliberately so the most-frequently-tweaked groups
// surface at the top (operational > directory > admin). Anything not
// in this list lands at the bottom in declaration order.
const ENTITY_ORDER = [
  'batch', 'house', 'farm', 'dailyLog',
  'source', 'feedOrder', 'saleOrder', 'expense',
  'worker', 'contact', 'business', 'transfer', 'feedItem',
  'media', 'settings',
];

const VERB_LABEL_KEYS = {
  read: 'permissions.verbs.read',
  create: 'permissions.verbs.create',
  update: 'permissions.verbs.update',
  delete: 'permissions.verbs.delete',
  approve: 'permissions.verbs.approve',
};

const VERB_LABEL_FALLBACK = {
  read: 'Read',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
};

const VERB_ORDER = ['read', 'create', 'update', 'delete', 'approve'];

export default function PermissionEditor({
  role,
  activeModules = [],
  value = { allow: [], deny: [] },
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [openModules, setOpenModules] = useState(() => new Set());

  const allow = useMemo(() => new Set(value.allow || []), [value.allow]);
  const deny = useMemo(() => new Set(value.deny || []), [value.deny]);

  // For each active module, collect all known actions (role's per-module
  // caps + the user's existing allow/deny entries that target this
  // module, so an owner can see and toggle off any extras they granted
  // earlier). Then group by entity.
  const sections = useMemo(() => {
    return activeModules
      .map((moduleId) => {
        const meta = MODULE_CATALOG[moduleId];
        if (!meta) return null;
        const moduleActions = MODULE_CAPABILITIES[moduleId]?.[role] || [];

        // Pull in any allow/deny entries that look like they target an
        // entity in this module (entities that appear in moduleActions).
        const moduleEntities = new Set(
          moduleActions
            .map((a) => parseAction(a)?.entity)
            .filter((e) => !!e && e !== '*')
        );
        const extras = [...allow, ...deny].filter((a) => {
          const e = parseAction(a)?.entity;
          return e && moduleEntities.has(e);
        });

        const allActions = [...new Set([...moduleActions, ...extras])];
        const entities = groupByEntity(allActions);
        if (entities.length === 0) return null;

        return { moduleId, label: meta.labelKey, entities };
      })
      .filter(Boolean);
  }, [activeModules, role, allow, deny]);

  // Cross-module role defaults — same renderer as the per-module
  // sections, separated under "Account" so owners can still tweak
  // settings:* and similar global actions.
  const coreActions = useMemo(() => actionsForRole(role), [role]);
  const coreSection = useMemo(() => {
    if (coreActions.length === 0) return null;
    return { entities: groupByEntity(coreActions) };
  }, [coreActions]);

  const isGrantedByRole = (action) => {
    for (const granted of coreActions) if (actionMatches(granted, action)) return true;
    for (const section of sections) {
      for (const entity of section.entities) {
        for (const a of entity.actions) {
          if (a === action) {
            // it's listed for this section — but is it actually granted?
            const moduleActions = MODULE_CAPABILITIES[section.moduleId]?.[role] || [];
            for (const granted of moduleActions) {
              if (actionMatches(granted, action)) return true;
            }
          }
        }
      }
    }
    return false;
  };

  const isCurrentlyAllowed = (action) => {
    if (deny.has(action)) return false;
    if (allow.has(action)) return true;
    return isGrantedByRole(action);
  };

  const toggleAction = (action) => {
    if (disabled) return;
    const grantedByRole = isGrantedByRole(action);
    const currentlyOn = isCurrentlyAllowed(action);
    const nextAllow = new Set(allow);
    const nextDeny = new Set(deny);

    if (currentlyOn) {
      // Turn OFF.
      nextAllow.delete(action);
      if (grantedByRole) nextDeny.add(action);
    } else {
      // Turn ON.
      nextDeny.delete(action);
      if (!grantedByRole) nextAllow.add(action);
    }
    onChange({ allow: [...nextAllow], deny: [...nextDeny] });
  };

  const toggleModule = (moduleId) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const [coreOpen, setCoreOpen] = useState(false);

  if (sections.length === 0 && !coreSection) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">
          {t('settings.advancedPermissions', 'Advanced permissions')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            'settings.advancedPermissionsDesc',
            'Fine-tune what this role can do. Defaults are shown — toggle off to revoke or on to grant extras.'
          )}
        </p>
      </div>

      <div className="space-y-2">
        {sections.map((section) => (
          <ModuleAccordion
            key={section.moduleId}
            label={t(section.label, section.moduleId)}
            open={openModules.has(section.moduleId)}
            onToggle={() => toggleModule(section.moduleId)}
            entities={section.entities}
            isCurrentlyAllowed={isCurrentlyAllowed}
            isGrantedByRole={isGrantedByRole}
            toggleAction={toggleAction}
            disabled={disabled}
            t={t}
          />
        ))}

        {coreSection ? (
          <ModuleAccordion
            label={t('permissions.coreSection', 'Account')}
            open={coreOpen}
            onToggle={() => setCoreOpen((v) => !v)}
            entities={coreSection.entities}
            isCurrentlyAllowed={isCurrentlyAllowed}
            isGrantedByRole={isGrantedByRole}
            toggleAction={toggleAction}
            disabled={disabled}
            t={t}
          />
        ) : null}
      </div>
    </div>
  );
}

function ModuleAccordion({
  label,
  open,
  onToggle,
  entities,
  isCurrentlyAllowed,
  isGrantedByRole,
  toggleAction,
  disabled,
  t,
}) {
  const grantedCount = useMemo(() => {
    let total = 0;
    let on = 0;
    for (const ent of entities) {
      for (const a of ent.actions) {
        total += 1;
        if (isCurrentlyAllowed(a)) on += 1;
      }
    }
    return { total, on };
  }, [entities, isCurrentlyAllowed]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {grantedCount.on}/{grantedCount.total}
        </Badge>
      </button>

      {open ? (
        <div className="divide-y border-t">
          {entities.map((ent) => (
            <EntityRow
              key={ent.entity}
              ent={ent}
              isCurrentlyAllowed={isCurrentlyAllowed}
              isGrantedByRole={isGrantedByRole}
              toggleAction={toggleAction}
              disabled={disabled}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EntityRow({ ent, isCurrentlyAllowed, isGrantedByRole, toggleAction, disabled, t }) {
  const label = t(ENTITY_LABEL_KEYS[ent.entity] || ent.entity, ENTITY_LABEL_FALLBACK[ent.entity] || ent.entity);

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {ent.entity}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ent.byVerb.map((row) => (
          <VerbToggle
            key={row.action}
            row={row}
            isCurrentlyAllowed={isCurrentlyAllowed}
            isGrantedByRole={isGrantedByRole}
            toggleAction={toggleAction}
            disabled={disabled}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function VerbToggle({ row, isCurrentlyAllowed, isGrantedByRole, toggleAction, disabled, t }) {
  const on = isCurrentlyAllowed(row.action);
  const isDefault = isGrantedByRole(row.action);
  const label = t(VERB_LABEL_KEYS[row.verb] || row.verb, VERB_LABEL_FALLBACK[row.verb] || row.verb);
  const scopeBadge = row.scope ? `:${row.scope}` : '';

  return (
    <button
      type="button"
      onClick={() => toggleAction(row.action)}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        on
          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-input bg-background text-muted-foreground hover:bg-accent',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-2 w-2 rounded-full',
          on ? 'bg-primary' : 'bg-muted-foreground/40',
        ].join(' ')}
      />
      {label}{scopeBadge}
      {isDefault && !on ? (
        <span className="text-[9px] uppercase tracking-wider opacity-70">
          {t('permissions.denied', 'denied')}
        </span>
      ) : null}
    </button>
  );
}

// CRUD verbs that always render as toggles for any entity that appears
// in the role's matrix, even when the role doesn't grant them by
// default. Owners can flip them on to add to permissions.allow[],
// which is the whole point of "Advanced permissions" — granting writes
// to an otherwise read-only role.
const ALWAYS_SHOWN_VERBS = ['read', 'create', 'update', 'delete'];

// Pure helper: turn a list of action strings into entity -> verb groups,
// sorted by ENTITY_ORDER and VERB_ORDER.
//
// For every entity that appears (even just once, even just with read),
// we expand the row to the full CRUD set so the owner can toggle ON
// any verb the role doesn't have by default. Scoped variants (e.g.
// :assigned, :own, :WEIGHT) come along for the ride as extra pills.
//
// Wildcards (`batch:*`) also expand to CRUD.
function groupByEntity(actions) {
  const map = new Map();

  // Pass 1 — collect every action by entity, expanding wildcards.
  for (const action of actions) {
    const parsed = parseAction(action);
    if (!parsed) continue;
    const { entity, verb, scope } = parsed;
    if (!entity || entity === '*') continue;

    if (!map.has(entity)) map.set(entity, new Map());
    const verbs = map.get(entity);

    if (verb === '*') {
      for (const v of ALWAYS_SHOWN_VERBS) {
        const expanded = `${entity}:${v}`;
        if (!verbs.has(expanded)) {
          verbs.set(expanded, { action: expanded, verb: v, scope: null });
        }
      }
    } else {
      const fullAction = scope ? `${entity}:${verb}:${scope}` : `${entity}:${verb}`;
      if (!verbs.has(fullAction)) {
        verbs.set(fullAction, { action: fullAction, verb, scope: scope || null });
      }
    }
  }

  // Pass 2 — for every entity that exists, ensure all CRUD verbs are
  // present so owners can grant writes even when the role is read-only.
  for (const verbs of map.values()) {
    for (const v of ALWAYS_SHOWN_VERBS) {
      // Only add a base verb when no equivalent (scoped or unscoped)
      // is already in the row. We check the "starts with verb:" pattern
      // so an entity that already has e.g. `read:assigned` doesn't get
      // an extra unscoped `read` pill added on top.
      const hasUnscoped = [...verbs.values()].some(
        (r) => r.verb === v && !r.scope
      );
      if (!hasUnscoped) {
        // Determine the entity from any existing row.
        const sample = verbs.values().next().value;
        if (!sample) continue;
        const entity = parseAction(sample.action)?.entity;
        if (!entity) continue;
        const action = `${entity}:${v}`;
        if (!verbs.has(action)) {
          verbs.set(action, { action, verb: v, scope: null });
        }
      }
    }
  }

  const entities = [];
  for (const [entity, verbs] of map.entries()) {
    const byVerb = [...verbs.values()].sort((a, b) => {
      const ai = VERB_ORDER.indexOf(a.verb);
      const bi = VERB_ORDER.indexOf(b.verb);
      const aSort = ai === -1 ? 99 : ai;
      const bSort = bi === -1 ? 99 : bi;
      if (aSort !== bSort) return aSort - bSort;
      return (a.scope || '').localeCompare(b.scope || '');
    });
    entities.push({
      entity,
      actions: byVerb.map((r) => r.action),
      byVerb,
    });
  }

  entities.sort((a, b) => {
    const ai = ENTITY_ORDER.indexOf(a.entity);
    const bi = ENTITY_ORDER.indexOf(b.entity);
    const aSort = ai === -1 ? 99 : ai;
    const bSort = bi === -1 ? 99 : bi;
    if (aSort !== bSort) return aSort - bSort;
    return a.entity.localeCompare(b.entity);
  });

  return entities;
}
