import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Pencil, Trash2, ChevronRight, ChevronLeft,
  Mail, Phone, Briefcase, Building2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import { useIsRTL } from '@/stores/localeStore';
import { SkeletonDetailPage } from '@/components/skeletons';
import WhatsappIcon from '@/components/icons/WhatsappIcon';
import ContactSheet from '@/shared/sheets/ContactSheet';

// WhatsApp's deep-link API only accepts digits — strip everything else
// (spaces, parentheses, dashes, leading "+") so wa.me/<digits> resolves.
const sanitizePhoneForWa = (raw) => (raw || '').replace(/[^\d]/g, '');

// `tel:` is permissive about formatting but we still drop whitespace so the
// dialer pre-fills cleanly across iOS and Android.
const sanitizePhoneForTel = (raw) => (raw || '').replace(/\s+/g, '');

// Western digits everywhere (DL §12.4) — never i18n.language for numerics.
const NUMERIC_LOCALE = 'en-US';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function ContactScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const { remove } = useOfflineMutation('contacts');
  const [contact, contactLoading] = useLocalRecord('contacts', id);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (contactLoading || !contact) {
    return (
      <HeroSheetScreen
        title={t('common.loading', 'Loading...')}
        heroExtra={<AvatarTile initials="" />}
      >
        <SkeletonDetailPage />
      </HeroSheetScreen>
    );
  }

  const businesses = contact.businesses || [];
  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();

  const canEdit = can('contact:update');
  const canDelete = can('contact:delete');

  const heroTitle = `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
    || t('common.unnamed', 'Unnamed');
  const heroSubtitle = contact.jobTitle || '';

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    setEditOpen(true);
  };

  const openDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!contact?._id || deleting) return;
    setDeleting(true);
    try {
      await remove(contact._id);
      toast({ title: t('contacts.contactDeleted', 'Contact deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e) {
      console.error('[ContactDetail] delete failed', e);
      toast({
        title: t('contacts.deleteError', 'Failed to delete contact'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCall = () => {
    const tel = sanitizePhoneForTel(contact.phone);
    if (!tel) return;
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(`tel:${tel}`).catch(() => {
      toast({
        title: t('contacts.callUnavailable', 'Cannot start a call on this device'),
        variant: 'destructive',
      });
    });
  };

  const handleWhatsapp = () => {
    const digits = sanitizePhoneForWa(contact.phone);
    if (!digits) return;
    Haptics.selectionAsync().catch(() => {});
    // Default greeting per requirement — keep it lowercase to match the
    // casual one-tap intent ("hi" feels right; "Hello," would feel formal).
    const message = encodeURIComponent(t('contacts.whatsappDefaultMessage', 'hi'));
    // wa.me works whether or not WhatsApp is installed: the OS hands it to
    // the app when present and falls back to the web bridge otherwise.
    Linking.openURL(`https://wa.me/${digits}?text=${message}`).catch(() => {
      toast({
        title: t('contacts.whatsappUnavailable', 'WhatsApp is not available'),
        variant: 'destructive',
      });
    });
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

  const hasContactInfo = contact.email || contact.phone || contact.jobTitle;

  return (
    <>
      <HeroSheetScreen
        scrollableHero
        title={heroTitle}
        subtitle={heroSubtitle}
        heroExtra={<AvatarTile initials={initials || '?'} />}
        headerRight={headerRight}
      >
        {/* ─── CONTACT INFO ─── */}
        {hasContactInfo ? (
          <SheetSection
            title={t('contacts.contactInfoSection', 'Contact Info')}
          >
            <View style={{ gap: 14 }}>
              {contact.email ? (
                <KvLineRow tokens={tokens} isRTL={isRTL} icon={Mail} value={contact.email} />
              ) : null}
              {contact.phone ? (
                <KvLineRow
                  tokens={tokens}
                  isRTL={isRTL}
                  icon={Phone}
                  value={contact.phone}
                  actions={(
                    <>
                      <PhoneActionButton
                        tokens={tokens}
                        onPress={handleCall}
                        accessibilityLabel={t('contacts.callContact', 'Call')}
                      >
                        <Phone size={18} color={tokens.accentColor} strokeWidth={2.4} />
                      </PhoneActionButton>
                      <PhoneActionButton
                        tokens={tokens}
                        onPress={handleWhatsapp}
                        accessibilityLabel={t('contacts.messageOnWhatsapp', 'Message on WhatsApp')}
                      >
                        <WhatsappIcon size={20} color={tokens.accentColor} />
                      </PhoneActionButton>
                    </>
                  )}
                />
              ) : null}
              {contact.jobTitle ? (
                <KvLineRow tokens={tokens} isRTL={isRTL} icon={Briefcase} value={contact.jobTitle} />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── ASSOCIATED BUSINESSES ─── */}
        {businesses.length > 0 ? (
          <SheetSection
            title={t('contacts.associatedBusinesses', 'Associated Businesses')}
            padded={false}
          >
            <View style={{ padding: 12, gap: 10 }}>
              {businesses.map((biz) => {
                const bizId = typeof biz === 'object' ? biz._id : biz;
                const bizName = typeof biz === 'object' ? biz.companyName : biz;
                return (
                  <LinkedRow
                    key={bizId}
                    tokens={tokens}
                    isRTL={isRTL}
                    icon={Building2}
                    label={bizName}
                    onPress={() => router.push(`/(app)/business/${bizId}`)}
                  />
                );
              })}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── NOTES ─── */}
        {contact.notes ? (
          <SheetSection title={t('contacts.notes', 'Notes')}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: tokens.textColor,
                lineHeight: 20,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {contact.notes}
            </Text>
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
          {`${t('common.created', 'Created')} ${fmtDate(contact.createdAt)}`}
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
                label={t('contacts.editContact', 'Edit Contact')}
                onPress={openEdit}
                isRTL={isRTL}
                tokens={tokens}
              />
            </View>
          </View>
        ) : null}
      </HeroSheetScreen>

      <ContactSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editData={contact}
        onDelete={() => setConfirmDeleteOpen(true)}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('contacts.deleteContactTitle', 'Delete Contact')}
        description={t(
          'contacts.deleteContactWarning',
          'This will permanently delete this contact and cannot be undone.'
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

// User-identity hero avatar (DL §7.a). Translucent white circle with the
// initials in primary green.
function AvatarTile({ initials }) {
  return (
    <View style={heroStyles.avatarTile}>
      <Text style={heroStyles.avatarText}>{initials}</Text>
    </View>
  );
}

// Icon-led row used inside Contact Info: small icon tile + value text, with
// an optional trailing `actions` slot for one-tap shortcuts (call, WhatsApp,
// etc.). Actions render in a single row so they stay visually anchored to
// the value they act on.
function KvLineRow({ tokens, isRTL, icon: Icon, value, actions }) {
  const { textColor, iconColor, dark } = tokens;
  return (
    <View
      style={[
        kvLineStyles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <View
        style={[
          kvLineStyles.iconTile,
          { backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 95%)' },
        ]}
      >
        <Icon size={16} color={iconColor} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontFamily: 'Poppins-Regular',
          color: textColor,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {value}
      </Text>
      {actions ? (
        <View
          style={[
            kvLineStyles.actions,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}

// Compact circular action button used inside KvLineRow. Soft tonal fill
// (matching the row icon-tile chrome) so the actions read as siblings of
// the value rather than a competing primary element. 36pt hits Apple's
// minimum tap target without dwarfing the row.
function PhoneActionButton({ tokens, onPress, accessibilityLabel, children }) {
  const { dark } = tokens;
  const idleBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';
  const pressedBg = dark ? 'rgba(148,210,165,0.28)' : 'hsl(148, 35%, 86%)';

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      // Keep hitSlop modest (4pt) so the two adjacent buttons can't share
      // a tap. Effective hit area is still 44pt — Apple's minimum.
      hitSlop={4}
      android_ripple={{
        color: dark ? 'rgba(148,210,165,0.18)' : 'rgba(20,83,45,0.12)',
        borderless: true,
        radius: 22,
      }}
      style={({ pressed }) => [
        phoneActionStyles.btn,
        { backgroundColor: pressed ? pressedBg : idleBg },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

// Tappable linked card. Mirrors PartyRow's chrome (elevated card surface
// + accent icon tile + bold label + mirrored chevron). Layout in
// StyleSheet per DL §9.
function LinkedRow({ tokens, isRTL, icon: Icon = Building2, label, sublabel, onPress }) {
  const {
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg, accentColor,
    textColor, mutedColor, dark,
  } = tokens;
  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        linkedRowStyles.card,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={[linkedRowStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View
          style={[
            linkedRowStyles.iconTile,
            { backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)' },
          ]}
        >
          <Icon size={18} color={accentColor} strokeWidth={2.2} />
        </View>
        <View style={linkedRowStyles.textCol}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
        <ForwardArrow size={18} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
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

const kvLineStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    alignItems: 'center',
    // 20pt visible gap + tightened hitSlop on each button leaves a real
    // ~12pt dead zone between the two tap targets so a thumb pad can't
    // straddle both at once. Tap-target safety > visual density.
    gap: 20,
    marginStart: 8,
  },
});

const phoneActionStyles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const linkedRowStyles = StyleSheet.create({
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
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
