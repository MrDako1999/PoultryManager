import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Warehouse, ExternalLink } from 'lucide-react-native';
import { router } from 'expo-router';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import FarmLocationPicker from '@/components/FarmLocationPicker';
import HouseConfigurator from '@/components/HouseConfigurator';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField, SummaryCard, SummaryRow } from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';

const FARM_TYPES = ['hatchery', 'broiler', 'free_range', 'layer_eggs', 'slaughterhouse'];
const QUICK_ADD_VALUE = '__quick_add__';
const NUMERIC_LOCALE = 'en-US';

const farmSchema = z.object({
  farmName: z.string().min(1, 'Farm name is required'),
  farmType: z.enum(FARM_TYPES),
  nickname: z.string()
    .optional()
    .refine((val) => !val || (val.length >= 3 && val.length <= 8), {
      message: 'Nickname must be 3-8 characters',
    }),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

const defaultValues = {
  farmName: '',
  farmType: 'broiler',
  nickname: '',
  tradeLicenseNumber: '',
  trnNumber: '',
};

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

export default function FarmSheet({ open, onClose, editData, onDelete, canDelete = false }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { accentColor } = tokens;

  const [businesses] = useLocalQuery('businesses');
  const [allHouses] = useLocalQuery('houses');
  const [allFarms] = useLocalQuery('farms');

  const farmsMutation = useOfflineMutation('farms');
  const housesMutation = useOfflineMutation('houses');

  const [saving, setSaving] = useState(false);
  const [linkedBusinessId, setLinkedBusinessId] = useState(null);
  const [location, setLocation] = useState({ lat: null, lng: null, placeName: '' });
  const [housesState, setHousesState] = useState([]);
  const [existingHouseIds, setExistingHouseIds] = useState([]);
  const [quickAddBizOpen, setQuickAddBizOpen] = useState(false);

  const {
    control, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm({
    resolver: zodResolver(farmSchema),
    defaultValues,
  });

  const watchedFarmName = watch('farmName');

  useEffect(() => {
    if (!open) return;
    if (editData) {
      const businessId = typeof editData.business === 'object'
        ? editData.business?._id
        : editData.business;
      const businessObj = businesses.find((b) => b._id === businessId);
      setLinkedBusinessId(businessId || null);
      setLocation(editData.location || { lat: null, lng: null, placeName: '' });
      reset({
        farmName: editData.farmName || '',
        farmType: editData.farmType || 'broiler',
        nickname: editData.nickname || '',
        tradeLicenseNumber: businessObj?.tradeLicenseNumber || editData.business?.tradeLicenseNumber || '',
        trnNumber: businessObj?.trnNumber || editData.business?.trnNumber || '',
      });
      const farmHouses = allHouses
        .filter((h) => {
          const fid = typeof h.farm === 'object' ? h.farm?._id : h.farm;
          return fid === editData._id;
        })
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((h) => ({ _id: h._id, name: h.name, capacity: h.capacity || 0 }));
      setHousesState(farmHouses);
      setExistingHouseIds(farmHouses.map((h) => h._id));
    } else {
      setLinkedBusinessId(null);
      setLocation({ lat: null, lng: null, placeName: '' });
      reset(defaultValues);
      setHousesState([]);
      setExistingHouseIds([]);
    }
  }, [open, editData?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedBusinessIds = useMemo(
    () => new Set(
      allFarms
        .filter((f) => !editData || f._id !== editData._id)
        .map((f) => (typeof f.business === 'object' ? f.business?._id : f.business))
        .filter(Boolean)
    ),
    [allFarms, editData]
  );

  const businessOptions = useMemo(() => {
    const options = businesses
      .filter((b) => !usedBusinessIds.has(b._id))
      .map((b) => ({
        value: b._id,
        label: b.companyName,
        description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
      }));
    options.unshift({
      value: QUICK_ADD_VALUE,
      label: t('farms.addNewBusiness', 'Add new business…'),
      description: t('farms.addNewBusinessHint', 'Quickly create a business and link it'),
    });
    return options;
  }, [businesses, usedBusinessIds, t]);

  const farmTypeOptions = useMemo(
    () => FARM_TYPES.map((value) => ({
      value,
      label: t(`farms.farmTypes.${value}`, value),
    })),
    [t]
  );

  const handleBusinessChange = (businessId) => {
    if (businessId === QUICK_ADD_VALUE) {
      setQuickAddBizOpen(true);
      return;
    }
    if (!businessId) {
      setLinkedBusinessId(null);
      setValue('tradeLicenseNumber', '', { shouldDirty: true });
      setValue('trnNumber', '', { shouldDirty: true });
      return;
    }
    setLinkedBusinessId(businessId);
    const biz = businesses.find((b) => b._id === businessId);
    if (biz) {
      setValue('tradeLicenseNumber', biz.tradeLicenseNumber || '', { shouldDirty: true });
      setValue('trnNumber', biz.trnNumber || '', { shouldDirty: true });
    }
  };

  const handleBizCreated = (newBiz) => {
    setLinkedBusinessId(newBiz._id);
    setValue('tradeLicenseNumber', newBiz.tradeLicenseNumber || '', { shouldDirty: true });
    setValue('trnNumber', newBiz.trnNumber || '', { shouldDirty: true });
    setQuickAddBizOpen(false);
  };

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const farmPayload = {
        farmName: formData.farmName,
        farmType: formData.farmType,
        nickname: formData.nickname?.toUpperCase() || '',
        business: linkedBusinessId || null,
        location: (location?.lat != null && location?.lng != null)
          ? { lat: location.lat, lng: location.lng, placeName: location.placeName || '' }
          : null,
      };

      let farmId = editData?._id;
      if (editData?._id) {
        await farmsMutation.update(editData._id, farmPayload);
      } else {
        farmId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await farmsMutation.create(farmId, farmPayload);
      }

      const keptIds = new Set(
        housesState.filter((h) => h._id).map((h) => h._id)
      );
      const removedIds = existingHouseIds.filter((id) => !keptIds.has(id));

      await Promise.all(
        housesState.map(async (house, idx) => {
          const housePayload = {
            farm: farmId,
            name: house.name || `House ${idx + 1}`,
            capacity: house.capacity || 0,
            sortOrder: idx,
          };
          if (house._id) {
            await housesMutation.update(house._id, housePayload);
          } else {
            const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${idx}`;
            await housesMutation.create(tempId, housePayload);
          }
        })
      );

      await Promise.all(removedIds.map((id) => housesMutation.remove(id)));

      toast({
        title: editData
          ? t('farms.farmUpdated', 'Farm updated successfully')
          : t('farms.farmCreated', 'Farm registered successfully'),
      });
      onClose();
    } catch (err) {
      console.error('[FarmSheet] save failed', err);
      toast({
        variant: 'destructive',
        title: editData
          ? t('farms.updateError', 'Failed to update farm')
          : t('farms.createError', 'Failed to register farm'),
      });
    } finally {
      setSaving(false);
    }
  };

  const tradeLicenseLocked = !!linkedBusinessId;
  const totalCapacity = housesState.reduce((s, h) => s + (Number(h.capacity) || 0), 0);

  const editLinkedBiz = () => {
    if (!linkedBusinessId) return;
    onClose();
    router.push(`/(app)/business/${linkedBusinessId}`);
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={editData ? t('farms.editFarm', 'Edit Farm') : t('farms.addFarm', 'Add Farm')}
      subtitle={editData
        ? t('farms.editFarmDesc', 'Update this farm\'s details')
        : t('farms.addFarmDesc', 'Register a new farm and link it to a business')}
      icon={Warehouse}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={editData ? t('common.save', 'Save') : t('common.create', 'Create')}
      loading={saving}
      disabled={saving}
      deleteLabel={editData?._id && canDelete && onDelete ? t('farms.deleteFarm', 'Delete Farm') : undefined}
      onDelete={editData?._id && canDelete && onDelete
        ? () => { onClose(); onDelete(); }
        : undefined
      }
    >
      <FormSection title={t('farms.farmIdentitySection', 'Farm Identity')}>
        <FormField label={t('farms.farmName', 'Farm Name')} required error={errors.farmName?.message}>
          <Controller
            control={control}
            name="farmName"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                placeholder={t('farms.farmName', 'Farm Name')}
                autoCapitalize="words"
              />
            )}
          />
        </FormField>

        <FormField
          label={t('farms.nickname', 'Farm Nickname')}
          hint={t('farms.nicknameHint', 'Choose a short, uppercase nickname (3–8 characters).')}
          error={errors.nickname?.message}
        >
          <Controller
            control={control}
            name="nickname"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                value={value}
                onChangeText={(v) => onChange(v.toUpperCase())}
                placeholder={t('farms.nicknamePlaceholder', 'e.g. EFMAIN, ALAINFM')}
                autoCapitalize="characters"
                maxLength={8}
              />
            )}
          />
        </FormField>

        <FormField label={t('farms.farmType', 'Farm Type')} required error={errors.farmType?.message}>
          <Controller
            control={control}
            name="farmType"
            render={({ field: { value, onChange } }) => (
              <EnumButtonSelect
                value={value}
                onChange={onChange}
                options={farmTypeOptions}
                columns={3}
                compact
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection
        title={t('farms.linkedBusiness', 'Linked Business')}
        headerRight={linkedBusinessId ? (
          <Pressable
            onPress={editLinkedBiz}
            hitSlop={6}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 4,
              paddingVertical: 2,
            }}
            accessibilityRole="button"
            accessibilityLabel={t('farms.editBusiness', 'Edit business')}
          >
            <ExternalLink size={11} color={accentColor} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: accentColor,
              }}
            >
              {t('farms.editBusiness', 'Edit business')}
            </Text>
          </Pressable>
        ) : null}
      >
        <Select
          value={linkedBusinessId || ''}
          onValueChange={handleBusinessChange}
          options={businessOptions}
          placeholder={t('farms.selectBusiness', 'Select a business…')}
          label={t('farms.linkedBusiness', 'Linked Business')}
          clearable
        />

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('farms.tradeLicenseNumber', 'Trade License #')}>
              <Controller
                control={control}
                name="tradeLicenseNumber"
                render={({ field: { value, onChange } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="—"
                    editable={!tradeLicenseLocked}
                    dense
                  />
                )}
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('farms.trnNumber', 'TRN')}>
              <Controller
                control={control}
                name="trnNumber"
                render={({ field: { value, onChange } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="—"
                    editable={!tradeLicenseLocked}
                    dense
                  />
                )}
              />
            </FormField>
          </View>
        </View>

        {tradeLicenseLocked ? (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: tokens.mutedColor,
              marginHorizontal: 4,
              textAlign: isRTL ? 'right' : 'left',
              lineHeight: 17,
            }}
          >
            {t('farms.licenseFromBusinessHint', 'Trade License and TRN are managed on the linked business.')}
          </Text>
        ) : null}
      </FormSection>

      <FormSection
        title={t('farms.locationSection', 'Farm Location')}
        description={t('farms.locationHint', 'Pin the exact location of your farm. Search by area name or drag the marker.')}
        padded={false}
        style={{ padding: 12 }}
      >
        <FarmLocationPicker
          value={location}
          onChange={setLocation}
          markerLabel={watchedFarmName}
        />
      </FormSection>

      <FormSection
        title={t('farms.houses', 'Houses')}
        headerRight={
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-SemiBold',
              color: tokens.mutedColor,
              fontVariant: ['tabular-nums'],
              letterSpacing: 0.4,
            }}
          >
            {`${fmtInt(totalCapacity)} ${t('farms.birds', 'capacity')}`}
          </Text>
        }
        padded={false}
        style={{ padding: 12 }}
      >
        <HouseConfigurator value={housesState} onChange={setHousesState} />
        {housesState.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <SummaryCard>
              <SummaryRow
                label={t('farms.houses', 'Houses')}
                value={fmtInt(housesState.length)}
              />
              <SummaryRow
                label={t('farms.totalCapacity', 'Total')}
                value={`${fmtInt(totalCapacity)} ${t('farms.birds', 'birds')}`}
                emphasis
              />
            </SummaryCard>
          </View>
        ) : null}
      </FormSection>

      <QuickAddBusinessSheet
        open={quickAddBizOpen}
        onClose={() => setQuickAddBizOpen(false)}
        onCreated={handleBizCreated}
        initialName={watchedFarmName}
      />
    </FormSheet>
  );
}
