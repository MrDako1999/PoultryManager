import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Home, Layers } from 'lucide-react-native';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import FormSheet from '@/components/FormSheet';
import {
  FormSection, FormField, SummaryCard, SummaryRow,
} from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const BATCH_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'OTHER'];

const batchSchema = z.object({
  farm: z.string().min(1, 'Farm is required'),
  startDate: z.string().min(1, 'Start date is required'),
  status: z.string().min(1, 'Status is required'),
});

export default function BatchSheet({ open, onClose, editData, onDelete, canDelete = false }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [farms] = useLocalQuery('farms');
  const [allHouses] = useLocalQuery('houses');
  const { create, update } = useOfflineMutation('batches');
  const [saving, setSaving] = useState(false);
  const [selectedHouses, setSelectedHouses] = useState([]);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      farm: '', startDate: new Date().toISOString().slice(0, 10), status: 'NEW',
    },
  });

  const watchFarm = watch('farm');
  const watchStatus = watch('status');

  useEffect(() => {
    if (editData) {
      const farmId = typeof editData.farm === 'object' ? editData.farm?._id : editData.farm;
      reset({
        farm: farmId || '',
        startDate: editData.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        status: editData.status || 'NEW',
      });
      setSelectedHouses(
        (editData.houses || []).map((h) => ({
          house: typeof h.house === 'object' ? h.house._id : h.house,
          houseName: typeof h.house === 'object' ? h.house.name : '',
          quantity: h.quantity || 0,
        }))
      );
    } else {
      reset({ farm: '', startDate: new Date().toISOString().slice(0, 10), status: 'NEW' });
      setSelectedHouses([]);
    }
  }, [editData, reset, open]);

  const farmOptions = useMemo(
    () => farms.map((f) => ({ value: f._id, label: f.farmName })),
    [farms]
  );

  const statusOptions = useMemo(
    () => BATCH_STATUSES.map((v) => ({ value: v, label: t(`batches.statuses.${v}`, v) })),
    [t]
  );

  const farmHouses = useMemo(() => {
    if (!watchFarm) return [];
    return allHouses.filter((h) => {
      const fid = typeof h.farm === 'object' ? h.farm?._id : h.farm;
      return fid === watchFarm;
    });
  }, [allHouses, watchFarm]);

  useEffect(() => {
    if (!editData && farmHouses.length > 0) {
      setSelectedHouses(farmHouses.map((h) => ({
        house: h._id,
        houseName: h.name,
        quantity: 0,
      })));
    }
  }, [farmHouses, editData]);

  const updateHouseQty = (houseId, qty) => {
    setSelectedHouses((prev) =>
      prev.map((h) => h.house === houseId ? { ...h, quantity: parseInt(qty, 10) || 0 } : h)
    );
  };

  const totalBirds = selectedHouses.reduce((s, h) => s + (h.quantity || 0), 0);
  const stockedHouses = selectedHouses.filter((h) => h.quantity > 0).length;

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const housesPayload = selectedHouses.filter((h) => h.quantity > 0).map((h) => ({
        house: h.house, quantity: h.quantity,
      }));

      if (editData?._id) {
        await update(editData._id, {
          startDate: formData.startDate,
          status: formData.status,
          houses: housesPayload,
        });
        toast({ title: t('batches.batchUpdated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, {
          farm: formData.farm,
          startDate: formData.startDate,
          status: formData.status,
          houses: housesPayload,
        });
        toast({ title: t('batches.batchCreated') });
      }
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: err.message || t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  const subtitle = editData
    ? t(`batches.statuses.${watchStatus}`, watchStatus)
    : t('batches.batchSubtitle', 'Set up a new growing cycle');

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={editData ? t('batches.editBatch') : t('batches.addBatch')}
      subtitle={subtitle}
      icon={Layers}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={editData ? t('common.save') : t('common.create')}
      loading={saving}
      deleteLabel={editData?._id && canDelete && onDelete ? t('batches.deleteBatch', 'Delete Batch') : undefined}
      onDelete={editData?._id && canDelete && onDelete ? () => { onClose(); onDelete(); } : undefined}
    >
      {/* Batch Details */}
      <FormSection title={t('batches.batchDetails', 'Batch Details')}>
        <FormField label={t('batches.farm')} required error={errors.farm?.message}>
          <Controller
            control={control}
            name="farm"
            render={({ field: { value, onChange } }) => (
              <Select
                value={value}
                onValueChange={onChange}
                options={farmOptions}
                placeholder={t('batches.selectFarm')}
                label={t('batches.farm')}
              />
            )}
          />
        </FormField>

        <FormField label={t('batches.startDate')} required error={errors.startDate?.message}>
          <Controller
            control={control}
            name="startDate"
            render={({ field: { value, onChange } }) => (
              <DatePicker value={value} onChange={onChange} label={t('batches.startDate')} />
            )}
          />
        </FormField>

        <FormField label={t('batches.status')} required error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field: { value, onChange } }) => (
              <EnumButtonSelect value={value} onChange={onChange} options={statusOptions} columns={3} compact />
            )}
          />
        </FormField>
      </FormSection>

      {/* Houses & quantities */}
      {selectedHouses.length > 0 ? (
        <FormSection
          title={t('batches.selectHouses', 'Houses & Quantities')}
          description={t(
            'batches.housesHint',
            'Enter the chick count placed in each house. Houses with zero birds are excluded from the batch.'
          )}
        >
          {selectedHouses.map((h) => (
            <HouseQtyRow
              key={h.house}
              name={h.houseName || t('batches.house', 'House')}
              quantity={h.quantity}
              onChange={(v) => updateHouseQty(h.house, v)}
              t={t}
            />
          ))}
          <SummaryCard>
            <SummaryRow
              label={t('batches.stockedHouses', 'Stocked houses')}
              value={`${stockedHouses} / ${selectedHouses.length}`}
            />
            <SummaryRow
              label={t('batches.totalBirds', 'Total birds')}
              value={totalBirds.toLocaleString('en-US')}
              emphasis
            />
          </SummaryCard>
        </FormSection>
      ) : null}
    </FormSheet>
  );
}

function HouseQtyRow({ name, quantity, onChange, t }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, accentColor, textColor, mutedColor } = tokens;

  const stocked = quantity > 0;
  const tileBg = stocked
    ? (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)')
    : (dark ? 'rgba(255,255,255,0.05)' : 'hsl(148, 18%, 95%)');
  const tileIconColor = stocked ? accentColor : mutedColor;

  return (
    <View
      style={[
        rowStyles.row,
        {
          flexDirection: rowDirection(isRTL),
          backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'hsl(148, 22%, 96%)',
          borderColor: dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 16%, 88%)',
        },
      ]}
    >
      <View style={[rowStyles.tile, { backgroundColor: tileBg }]}>
        <Home size={16} color={tileIconColor} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            textAlign: textAlignStart(isRTL),
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {stocked ? (
          <Text
            style={{
              fontSize: 11.5,
              fontFamily: 'Poppins-Medium',
              color: accentColor,
              marginTop: 2,
              textAlign: textAlignStart(isRTL),
            }}
          >
            {quantity.toLocaleString('en-US')} {t('batches.birds', 'birds')}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 110 }}>
        <SheetInput
          dense
          value={quantity > 0 ? quantity.toString() : ''}
          onChangeText={onChange}
          keyboardType="number-pad"
          placeholder={t('batches.qty', 'Qty')}
        />
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
