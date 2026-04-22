import { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  Search, ChevronLeft, ChevronRight, ContactRound, Pencil, Trash2,
  X, Building2, Phone, Briefcase,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SyncIconButton from '@/components/SyncIconButton';
import QuickAddFAB from '@/components/QuickAddFAB';
import { SkeletonRow } from '@/components/skeletons';
import { useToast } from '@/components/ui/Toast';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import ContactSheet from '@/shared/sheets/ContactSheet';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';
const SWIPE_ACTION_WIDTH = 76;

export default function ContactsListScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, borderColor, sectionBorder, screenBg, heroGradient,
  } = tokens;

  const { toast } = useToast();
  const { can } = useCapabilities();
  const canCreate = can('contact:create');
  const canUpdate = can('contact:update');
  const canDelete = can('contact:delete');

  const { remove } = useOfflineMutation('contacts');

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [contactSheet, setContactSheet] = useState({ open: false, data: null });
  const [contactToDelete, setContactToDelete] = useState(null);

  const [contacts, contactsLoading] = useLocalQuery('contacts');

  const filteredContacts = useMemo(() => {
    let list = contacts;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        return fullName.includes(q)
          || (c.email || '').toLowerCase().includes(q)
          || (c.phone || '').toLowerCase().includes(q)
          || (c.jobTitle || '').toLowerCase().includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim();
      return aName.localeCompare(bName, i18n.language || NUMERIC_LOCALE);
    });
  }, [contacts, searchQuery, i18n.language]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setContactSheet({ open: true, data: null });
  };

  const openEdit = (contact) => setContactSheet({ open: true, data: contact });
  const requestDelete = (contact) => setContactToDelete(contact);

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    try {
      await remove(contactToDelete._id);
      toast({ title: t('contacts.contactDeleted', 'Contact removed') });
    } catch (e) {
      console.error(e);
      toast({
        title: t('contacts.deleteError', 'Failed to remove contact'),
        variant: 'destructive',
      });
    } finally {
      setContactToDelete(null);
    }
  };

  const isInitialLoading = contactsLoading && contacts.length === 0;
  const isEmptyClean = !isInitialLoading && contacts.length === 0;
  const isFilteredEmpty = !isInitialLoading && contacts.length > 0 && filteredContacts.length === 0;

  const fabBottomInset = insets.bottom + 16;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BrandHeader
        title={t('nav.contacts', 'Contacts')}
        subtitle={t('contacts.subtitle', 'People in your network')}
        gradient={heroGradient}
        topInset={insets.top}
        isRTL={isRTL}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
      >
        <View
          style={{
            backgroundColor: screenBg,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: borderColor,
          }}
        >
          <SheetInput
            icon={Search}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('contacts.searchPlaceholder', 'Search contacts...')}
            autoCapitalize="none"
            autoCorrect={false}
            dense
            suffix={
              searchQuery ? (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={10}
                  style={styles.clearBtn}
                >
                  <X size={14} color={mutedColor} />
                </Pressable>
              ) : null
            }
          />
        </View>

        <View style={{ paddingTop: 18 }}>
          {isInitialLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            </View>
          ) : isEmptyClean ? (
            <EmptyState
              icon={ContactRound}
              title={t('contacts.noContacts', 'No contacts yet')}
              description={t('contacts.noContactsDesc', 'Add your first contact to start building your directory.')}
              actionLabel={canCreate ? t('contacts.addFirstContact', 'Add Your First Contact') : undefined}
              onAction={canCreate ? openCreate : undefined}
            />
          ) : isFilteredEmpty ? (
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                alignItems: 'center',
                paddingVertical: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  textAlign: 'center',
                }}
              >
                {t('common.noResults', 'No results found')}
              </Text>
            </View>
          ) : (
            <SheetSection padded={false}>
              {filteredContacts.map((contact, idx) => (
                <View
                  key={contact._id}
                  style={idx > 0 ? {
                    borderTopWidth: 1,
                    borderTopColor: sectionBorder,
                  } : null}
                >
                  <ContactRow
                    contact={contact}
                    tokens={tokens}
                    isRTL={isRTL}
                    t={t}
                    onPress={() => router.push(`/(app)/contact/${contact._id}`)}
                    onEdit={canUpdate ? () => openEdit(contact) : undefined}
                    onDelete={canDelete ? () => requestDelete(contact) : undefined}
                  />
                </View>
              ))}
            </SheetSection>
          )}
        </View>
      </ScrollView>

      {!contactSheet.open && canCreate && (
        <QuickAddFAB
          items={[]}
          directAction={openCreate}
          bottomInset={fabBottomInset}
        />
      )}

      <ContactSheet
        open={contactSheet.open}
        onClose={() => setContactSheet({ open: false, data: null })}
        editData={contactSheet.data}
        canDelete={canDelete}
        onDelete={contactSheet.data ? () => requestDelete(contactSheet.data) : undefined}
      />

      <ConfirmDialog
        open={!!contactToDelete}
        onOpenChange={(o) => { if (!o) setContactToDelete(null); }}
        title={t('contacts.deleteContactTitle', 'Delete Contact')}
        description={t(
          'contacts.deleteContactWarning',
          'This will permanently delete this contact and cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function BrandHeader({ title, subtitle, gradient, topInset, isRTL }) {
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };
  return (
    <LinearGradient
      colors={gradient}
      start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
      end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={{
        paddingTop: topInset + 14,
        paddingBottom: 22,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={[
          headerStyles.row,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={headerStyles.backBtn}
          accessibilityRole="button"
        >
          <BackIcon size={20} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Poppins-Bold',
              color: '#ffffff',
              letterSpacing: -0.4,
              lineHeight: 30,
              textAlign: textAlignStart(isRTL),
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.78)',
                marginTop: 4,
                textAlign: textAlignStart(isRTL),
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <SyncIconButton />
      </View>
    </LinearGradient>
  );
}

function ContactRow({
  contact, tokens, isRTL, t,
  onPress, onEdit, onDelete,
}) {
  const { mutedColor, textColor, accentColor, dark, sectionBg } = tokens;
  const swipeRef = useRef(null);
  // Flat row inside a SheetSection — DL §9. Press feedback is just a
  // background tint; row separation comes from the parent's sectionBorder
  // line. Padding lives on a plain inner View so NativeWind's css-interop
  // can't strip it.
  const pressedBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase() || '?';
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || t('common.unnamed', 'Unnamed');
  const bizCount = (contact.businesses || []).length;

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => onEdit?.(), 150);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => onDelete?.(), 150);
  };

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row' }}>
      {onEdit ? (
        <Pressable
          onPress={handleEdit}
          style={({ pressed }) => [
            cardStyles.swipeAction,
            { backgroundColor: '#f59e0b', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Pencil size={20} color="#ffffff" strokeWidth={2.2} />
          <Text style={cardStyles.swipeActionLabel}>
            {t('common.edit', 'Edit')}
          </Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [
            cardStyles.swipeAction,
            { backgroundColor: '#dc2626', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Trash2 size={20} color="#ffffff" strokeWidth={2.2} />
          <Text style={cardStyles.swipeActionLabel}>
            {t('common.delete', 'Delete')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const swipeEnabled = !!(onEdit || onDelete);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      enabled={swipeEnabled}
      renderRightActions={swipeEnabled ? renderRightActions : undefined}
      containerStyle={{ backgroundColor: sectionBg }}
    >
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onPress}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : 'transparent',
        })}
      >
        <View style={cardStyles.rowInner}>
          <View
            style={[
              cardStyles.row,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
          <View
            style={[
              cardStyles.avatar,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Bold',
                color: accentColor,
              }}
            >
              {initials}
            </Text>
          </View>

          <View style={cardStyles.textCol}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {fullName}
            </Text>
            <View
              style={[
                cardStyles.metaRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              {contact.jobTitle ? (
                <View
                  style={[
                    cardStyles.metaPiece,
                    { flexDirection: rowDirection(isRTL) },
                  ]}
                >
                  <Briefcase size={11} color={mutedColor} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                      maxWidth: 110,
                    }}
                    numberOfLines={1}
                  >
                    {contact.jobTitle}
                  </Text>
                </View>
              ) : null}
              {contact.phone ? (
                <View
                  style={[
                    cardStyles.metaPiece,
                    { flexDirection: rowDirection(isRTL) },
                  ]}
                >
                  <Phone size={11} color={mutedColor} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                      maxWidth: 130,
                    }}
                    numberOfLines={1}
                  >
                    {contact.phone}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {bizCount > 0 ? (
            <View
              style={[
                cardStyles.bizBadge,
                {
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'hsl(148, 18%, 96%)',
                  borderColor: dark ? 'rgba(255,255,255,0.10)' : 'hsl(148, 14%, 88%)',
                  flexDirection: rowDirection(isRTL),
                },
              ]}
            >
              <Building2 size={11} color={mutedColor} strokeWidth={2.2} />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {bizCount}
              </Text>
            </View>
          ) : null}
        </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const headerStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

const styles = StyleSheet.create({
  clearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
});

const cardStyles = StyleSheet.create({
  // Padding lives here on a plain View, NOT on the Pressable. NativeWind's
  // css-interop strips layout-bearing styles from a Pressable's functional
  // `style` form (DL §9 trap rule).
  rowInner: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  row: {
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaPiece: {
    alignItems: 'center',
    gap: 4,
  },
  bizBadge: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    marginTop: 4,
  },
});
