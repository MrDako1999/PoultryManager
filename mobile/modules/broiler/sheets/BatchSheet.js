import { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Home } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import Separator from '@/components/ui/Separator';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';

const BATCH_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'OTHER'];

function FieldError({ error }) {
  if (!error) return null;
  return <Text className="text-xs text-destructive mt-1">{error.message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

const batchSchema = z.object({
  farm: z.string().min(1, 'Farm is required'),
  startDate: z.string().min(1, 'Start date is required'),
  status: z.string().min(1, 'Status is required'),
});

export default function BatchSheet({ open, onClose, editData }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
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

  const farmOptions = useMemo(() =>
    farms.map((f) => ({ value: f._id, label: f.farmName })),
    [farms]);

  const statusOptions = BATCH_STATUSES.map((v) => ({ value: v, label: t(`batches.statuses.${v}`, v) }));

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
      prev.map((h) => h.house === houseId ? { ...h, quantity: parseInt(qty) || 0 } : h)
    );
  };

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

  if (!open) return null;

  const primaryColor = 'hsl(148, 60%, 20%)';

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">
            {editData ? t('batches.editBatch') : t('batches.addBatch')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
        <Separator />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Label>{t('batches.farm')}<RequiredStar /></Label>
            <Controller control={control} name="farm"
              render={({ field: { value, onChange } }) => (
                <Select value={value} onValueChange={onChange} options={farmOptions} placeholder={t('batches.selectFarm')} label={t('batches.farm')} />
              )}
            />
            <FieldError error={errors.farm} />
          </View>

          <View className="gap-2">
            <Label>{t('batches.startDate')}<RequiredStar /></Label>
            <Controller control={control} name="startDate"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('batches.startDate')} />
              )}
            />
            <FieldError error={errors.startDate} />
          </View>

          <View className="gap-2">
            <Label>{t('batches.status')}<RequiredStar /></Label>
            <Controller control={control} name="status"
              render={({ field: { value, onChange } }) => (
                <EnumButtonSelect value={value} onChange={onChange} options={statusOptions} columns={3} compact />
              )}
            />
            <FieldError error={errors.status} />
          </View>

          {selectedHouses.length > 0 && (
            <>
              <Separator />
              <Text className="text-sm font-semibold text-foreground">{t('batches.selectHouses')}</Text>
              {selectedHouses.map((h) => (
                <View key={h.house} className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <View className="h-8 w-8 rounded-md bg-primary/10 items-center justify-center">
                    <Home size={14} color={primaryColor} />
                  </View>
                  <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={1}>
                    {h.houseName || 'House'}
                  </Text>
                  <Input
                    value={h.quantity > 0 ? h.quantity.toString() : ''}
                    onChangeText={(v) => updateHouseQty(h.house, v)}
                    keyboardType="number-pad"
                    placeholder={t('batches.qty')}
                    className="w-24"
                  />
                </View>
              ))}
              <Text className="text-xs text-muted-foreground">
                {t('batches.totalBirds')}: {selectedHouses.reduce((s, h) => s + (h.quantity || 0), 0).toLocaleString()}
              </Text>
            </>
          )}
        </ScrollView>

        <View className="px-4 pt-4 border-t border-border" style={{ paddingBottom: Math.max(safeBottom, 16) }}>
          <Button onPress={handleSubmit(onSubmit)} loading={saving} disabled={saving}>
            {editData ? t('common.save') : t('common.create')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
