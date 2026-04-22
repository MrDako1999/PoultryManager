import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ContactRound, XCircle, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import SheetInput from '@/components/SheetInput';
import PhoneInput from '@/components/PhoneInput';
import Select from '@/components/ui/Select';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField } from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { useToast } from '@/components/ui/Toast';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import { rowDirection } from '@/lib/rtl';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  jobTitle: z.string().optional(),
  email: z.string().optional().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    'Invalid email'
  ),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

const defaultValues = {
  firstName: '', lastName: '', jobTitle: '',
  email: '', phone: '', notes: '',
};

export default function ContactSheet({
  open,
  onClose,
  onCreated,
  editData = null,
  onDelete,
  canDelete = false,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { accentColor, mutedColor, dark } = tokens;
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const { create, update } = useOfflineMutation('contacts');
  const isEditing = !!editData?._id;

  const [businesses] = useLocalQuery('businesses');
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [bizSheetOpen, setBizSheetOpen] = useState(false);

  const businessOptions = useMemo(() =>
    (businesses || []).map((b) => ({
      value: b._id,
      label: b.companyName || 'Business',
    })),
    [businesses]
  );

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    if (editData) {
      reset({
        firstName: editData.firstName || '',
        lastName: editData.lastName || '',
        jobTitle: editData.jobTitle || '',
        email: editData.email || '',
        phone: editData.phone || '',
        notes: editData.notes || '',
      });
      setSelectedBusinesses(
        Array.isArray(editData.businesses)
          ? editData.businesses.map((b) => (typeof b === 'object' ? b._id : b)).filter(Boolean)
          : []
      );
    } else {
      reset(defaultValues);
      setSelectedBusinesses([]);
    }
  }, [open, editData, reset]);

  const toggleBusiness = (bizId) => {
    setSelectedBusinesses((prev) =>
      prev.includes(bizId) ? prev.filter((id) => id !== bizId) : [...prev, bizId]
    );
  };

  const removeBusiness = (bizId) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedBusinesses((prev) => prev.filter((id) => id !== bizId));
  };

  const handleBizCreated = (newBiz) => {
    setSelectedBusinesses((prev) => [...prev, newBiz._id]);
    setBizSheetOpen(false);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName || '',
        jobTitle: data.jobTitle || '',
        email: data.email || '',
        phone: data.phone || '',
        notes: data.notes || '',
        businesses: selectedBusinesses,
      };
      if (isEditing) {
        await update(editData._id, payload);
        onCreated?.({ _id: editData._id, ...payload });
        toast({ title: t('contacts.contactUpdated', 'Contact updated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload);
        onCreated?.({ _id: tempId, ...payload });
        toast({ title: t('contacts.contactCreated', 'Contact created') });
      }
      onClose();
    } catch (err) {
      console.error('[ContactSheet] save failed', err);
      toast({
        variant: 'destructive',
        title: isEditing
          ? t('contacts.updateError', 'Failed to update contact')
          : t('contacts.createError', 'Failed to create contact'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEditing
        ? t('contacts.editContact', 'Edit Contact')
        : t('contacts.addContact', 'Add Contact')
      }
      subtitle={isEditing
        ? t('contacts.editContactDesc', 'Update this contact\'s details')
        : t('contacts.addContactDesc', 'Add a person to your directory')
      }
      icon={ContactRound}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
      loading={saving}
      disabled={saving}
      deleteLabel={isEditing && canDelete && onDelete ? t('contacts.deleteContact', 'Delete Contact') : undefined}
      onDelete={isEditing && canDelete && onDelete
        ? () => { onClose(); onDelete(); }
        : undefined
      }
    >
      <FormSection title={t('contacts.personalSection', 'Personal Information')}>
        <View style={{ flexDirection: rowDirection(isRTL), gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('contacts.firstName', 'First Name')} required error={errors.firstName?.message}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('contacts.firstName', 'First Name')}
                    autoCapitalize="words"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('contacts.lastName', 'Last Name')}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('contacts.lastName', 'Last Name')}
                    autoCapitalize="words"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
        </View>

        <FormField label={t('contacts.jobTitle', 'Job Title')}>
          <Controller
            control={control}
            name="jobTitle"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('contacts.jobTitle', 'Job Title')}
                autoCapitalize="words"
              />
            )}
          />
        </FormField>

        <FormField label={t('contacts.email', 'Email')} error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          />
        </FormField>

        <FormField label={t('contacts.phone', 'Phone Number')}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <PhoneInput value={value} onChange={onChange} />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection
        title={t('contacts.associatedBusinesses', 'Associated Businesses')}
        headerRight={
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setBizSheetOpen(true);
            }}
            hitSlop={6}
            style={{
              flexDirection: rowDirection(isRTL),
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 4,
              paddingVertical: 2,
            }}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.addNewBusiness', 'Add New Business')}
          >
            <Plus size={11} color={accentColor} strokeWidth={2.4} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: accentColor,
              }}
            >
              {t('contacts.addNewBusiness', 'Add New')}
            </Text>
          </Pressable>
        }
      >
        {selectedBusinesses.length > 0 ? (
          <View
            style={[
              styles.chipRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            {selectedBusinesses.map((id) => {
              const biz = businessOptions.find((b) => b.value === id);
              return (
                <View
                  key={id}
                  style={[
                    styles.chip,
                    {
                      flexDirection: rowDirection(isRTL),
                      backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
                      borderColor: dark ? 'rgba(148,210,165,0.30)' : 'hsl(148, 35%, 80%)',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Medium',
                      color: accentColor,
                      maxWidth: 140,
                    }}
                    numberOfLines={1}
                  >
                    {biz?.label || 'Business'}
                  </Text>
                  <Pressable onPress={() => removeBusiness(id)} hitSlop={6}>
                    <XCircle size={14} color={mutedColor} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <Select
          value=""
          onValueChange={(bizId) => { if (bizId) toggleBusiness(bizId); }}
          options={businessOptions.filter((b) => !selectedBusinesses.includes(b.value))}
          placeholder={t('contacts.selectBusinesses', 'Link a business...')}
          label={t('contacts.associatedBusinesses', 'Associated Businesses')}
        />
      </FormSection>

      <FormSection title={t('contacts.notesSection', 'Notes')}>
        <FormField>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('contacts.notesPlaceholder', 'Notes about this contact...')}
                multiline
                numberOfLines={4}
                style={{ height: 96, alignItems: 'flex-start', paddingTop: 14 }}
              />
            )}
          />
        </FormField>
      </FormSection>

      <QuickAddBusinessSheet
        open={bizSheetOpen}
        onClose={() => setBizSheetOpen(false)}
        onCreated={handleBizCreated}
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
