import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Pencil, Trash2, Home,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import useSettings from '@/hooks/useSettings';
import { useIsRTL } from '@/stores/localeStore';
import { SkeletonDetailPage } from '@/components/skeletons';
import WorkerSheet from '@/shared/sheets/WorkerSheet';

// Western digits everywhere (DL §12.4) — never i18n.language for numerics.
const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function WorkerScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const { remove } = useOfflineMutation('workers');
  const [worker, workerLoading] = useLocalRecord('workers', id);
  const [houses] = useLocalQuery('houses');
  const [farms] = useLocalQuery('farms');

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const houseById = useMemo(() => {
    const m = {};
    houses.forEach((h) => { m[h._id] = h; });
    return m;
  }, [houses]);

  const farmById = useMemo(() => {
    const m = {};
    farms.forEach((f) => { m[f._id] = f; });
    return m;
  }, [farms]);

  const assignedHouses = useMemo(() => {
    const ids = (worker?.houseAssignments || []).map((h) => (typeof h === 'object' ? h._id : h));
    return ids.map((hid) => houseById[hid]).filter(Boolean);
  }, [worker, houseById]);

  const assignmentsByFarm = useMemo(() => {
    const map = new Map();
    assignedHouses.forEach((h) => {
      const fid = String(typeof h.farm === 'object' ? h.farm?._id : h.farm || '');
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid).push(h);
    });
    return [...map.entries()];
  }, [assignedHouses]);

  if (workerLoading || !worker) {
    return (
      <HeroSheetScreen
        title={t('common.loading', 'Loading...')}
        heroExtra={<AvatarTile initials="" />}
      >
        <SkeletonDetailPage />
      </HeroSheetScreen>
    );
  }

  const initials = `${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}`.toUpperCase();
  const canEdit = can('worker:update');
  const canDelete = can('worker:delete');

  const heroTitle = `${worker.firstName || ''} ${worker.lastName || ''}`.trim()
    || t('common.unnamed', 'Unnamed');
  const heroSubtitle = worker.role
    ? t(`workers.workerRoles.${worker.role}`, worker.role)
    : '';

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    setEditOpen(true);
  };

  const openDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!worker?._id || deleting) return;
    setDeleting(true);
    try {
      await remove(worker._id);
      toast({ title: t('workers.workerDeleted', 'Worker deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e) {
      console.error('[WorkerDetail] delete failed', e);
      toast({
        title: t('workers.deleteError', 'Failed to delete worker'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const headerRight = (canEdit || canDelete) ? (
    <View style={[heroStyles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {canEdit ? (
        <Pressable
          onPress={openEdit}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.edit', 'Edit')}
        >
          <Pencil size={18} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
      ) : null}
      {canDelete ? (
        <Pressable
          onPress={openDelete}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete', 'Delete')}
        >
          <Trash2 size={18} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  ) : null;

  const hasPersonal = worker.role || worker.compensation > 0 || worker.phone;
  const hasUaeId = worker.emiratesIdNumber || worker.emiratesIdExpiry;
  const hasPassport = worker.passportNumber || worker.passportCountry || worker.passportExpiry;

  return (
    <>
      <HeroSheetScreen
        scrollableHero
        title={heroTitle}
        subtitle={heroSubtitle}
        heroExtra={<AvatarTile initials={initials || '?'} />}
        headerRight={headerRight}
      >
        {/* ─── PERSONAL INFO ─── */}
        {hasPersonal ? (
          <SheetSection title={t('workers.personalSection', 'Personal Information')}>
            <View style={{ gap: 10 }}>
              {worker.role ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.role', 'Role')}
                  value={t(`workers.workerRoles.${worker.role}`, worker.role)}
                />
              ) : null}
              {worker.compensation > 0 ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.compensation', 'Monthly Salary')}
                  value={`${currency} ${fmt(worker.compensation)}`}
                />
              ) : null}
              {worker.phone ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.phone', 'Phone')}
                  value={worker.phone}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── UAE RESIDENCY ─── */}
        {hasUaeId ? (
          <SheetSection title={t('workers.uaeResidencySection', 'UAE Residency')}>
            <View style={{ gap: 10 }}>
              {worker.emiratesIdNumber ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.emiratesIdNumber', 'Emirates ID Number')}
                  value={worker.emiratesIdNumber}
                />
              ) : null}
              {worker.emiratesIdExpiry ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.emiratesIdExpiry', 'EID Expiry')}
                  value={fmtDate(worker.emiratesIdExpiry)}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── PASSPORT ─── */}
        {hasPassport ? (
          <SheetSection title={t('workers.passportSection', 'Passport')}>
            <View style={{ gap: 10 }}>
              {worker.passportNumber ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.passportNumber', 'Passport Number')}
                  value={worker.passportNumber}
                />
              ) : null}
              {worker.passportCountry ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.passportCountry', 'Passport Country')}
                  value={worker.passportCountry}
                />
              ) : null}
              {worker.passportExpiry ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('workers.passportExpiry', 'Passport Expiry')}
                  value={fmtDate(worker.passportExpiry)}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── ASSIGNED HOUSES ─── */}
        {assignmentsByFarm.length > 0 ? (
          <SheetSection
            title={t('workers.assignedHouses', 'Assigned Houses')}
            padded={false}
          >
            <View style={{ padding: 12, gap: 16 }}>
              {assignmentsByFarm.map(([farmId, list]) => (
                <View key={farmId} style={{ gap: 10 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-SemiBold',
                      color: tokens.mutedColor,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginHorizontal: 4,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    numberOfLines={1}
                  >
                    {farmById[farmId]?.farmName || t('farms.unknownFarm', 'Farm')}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {list.map((house) => (
                      <HouseCard
                        key={house._id}
                        tokens={tokens}
                        isRTL={isRTL}
                        name={house.name}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── FOOTER META ─── */}
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: tokens.mutedColor,
            textAlign: 'center',
            marginHorizontal: 16,
            marginBottom: 8,
            marginTop: 4,
          }}
        >
          {`${t('common.created', 'Created')} ${fmtDate(worker.createdAt)}`}
        </Text>

        {/* ─── BOTTOM CTA STRIP ─── */}
        {canEdit ? (
          <View
            style={[
              ctaStyles.row,
              {
                marginHorizontal: 16,
                gap: 10,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <CtaButton
                variant="primary"
                icon={Pencil}
                label={t('workers.editWorker', 'Edit Worker')}
                onPress={openEdit}
                isRTL={isRTL}
                tokens={tokens}
              />
            </View>
          </View>
        ) : null}
      </HeroSheetScreen>

      <WorkerSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editData={worker}
        onDelete={() => setConfirmDeleteOpen(true)}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('workers.deleteTitle', 'Delete Worker')}
        description={t(
          'workers.deleteWarning',
          'This will permanently delete this worker and their associated contact record. This action cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </>
  );
}

/* ───────────────────── Sub-components ───────────────────── */

function AvatarTile({ initials }) {
  return (
    <View style={heroStyles.avatarTile}>
      <Text style={heroStyles.avatarText}>{initials}</Text>
    </View>
  );
}

// Key/value row used inside detail sections.
function KvRow({ tokens, isRTL, label, value, bold, negative, highlight }) {
  const { textColor, mutedColor, errorColor, accentColor } = tokens;
  return (
    <View
      style={[
        kvStyles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: bold ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: mutedColor,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontFamily: bold ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: negative ? errorColor : highlight ? accentColor : textColor,
          fontVariant: ['tabular-nums'],
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// Static elevated card for an assigned house (no per-house route exists).
function HouseCard({ tokens, isRTL, name }) {
  const {
    elevatedCardBg, elevatedCardBorder, accentColor, textColor, dark,
  } = tokens;

  return (
    <View
      style={[
        houseCardStyles.card,
        { backgroundColor: elevatedCardBg, borderColor: elevatedCardBorder },
      ]}
    >
      <View style={[houseCardStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View
          style={[
            houseCardStyles.iconTile,
            { backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)' },
          ]}
        >
          <Home size={18} color={accentColor} strokeWidth={2.2} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
      </View>
    </View>
  );
}

// Shared CTA button. STATIC style array per DL §9 trap rule.
function CtaButton({ variant, icon: Icon, label, onPress, isRTL, tokens }) {
  const { dark, accentColor } = tokens;
  const [pressed, setPressed] = useState(false);

  const filled = variant === 'primary';

  const idleBg = filled
    ? accentColor
    : (dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)');
  const pressedBg = filled
    ? (dark ? 'hsl(148, 55%, 48%)' : 'hsl(148, 60%, 24%)')
    : (dark ? 'rgba(148,210,165,0.26)' : 'hsl(148, 35%, 86%)');
  const borderColor = filled ? idleBg : accentColor;
  const fg = filled ? '#f5f8f5' : accentColor;

  return (
    <Pressable
      onPressIn={() => {
        setPressed(true);
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      android_ripple={{
        color: filled
          ? 'rgba(255,255,255,0.18)'
          : (dark ? 'rgba(148,210,165,0.18)' : 'rgba(20,83,45,0.12)'),
        borderless: false,
      }}
      style={[
        ctaButtonStyles.btn,
        {
          backgroundColor: pressed ? pressedBg : idleBg,
          borderColor,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          ctaButtonStyles.inner,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Icon size={18} color={fg} strokeWidth={2.4} />
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: fg,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/* ───────────────────── StyleSheets ───────────────────── */

const heroStyles = StyleSheet.create({
  avatarTile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  avatarText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: 'hsl(148, 60%, 22%)',
    letterSpacing: 0.2,
  },
  actionsRow: {
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const kvStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    minHeight: 22,
  },
});

const houseCardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const ctaStyles = StyleSheet.create({
  row: {
    marginTop: 4,
  },
});

const ctaButtonStyles = StyleSheet.create({
  btn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
