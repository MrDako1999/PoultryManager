import { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react-native';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import Select from '../ui/Select';
import EnumButtonSelect from '../ui/EnumButtonSelect';
import DatePicker from '../ui/DatePicker';
import Separator from '../ui/Separator';
import MobileMultiFileUpload from '../MobileMultiFileUpload';
import useLocalQuery from '../../hooks/useLocalQuery';
import useOfflineMutation from '../../hooks/useOfflineMutation';
import useAuthStore from '../../stores/authStore';
import { LOG_TYPES, LOG_TYPE_ICONS } from '../../lib/constants';
import { useToast } from '../ui/Toast';

const parseNum = (v) => { if (!v || v === '') return null; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? null : n; };

function FieldError({ error }) {
  if (!error) return null;
  return <Text className="text-xs text-destructive mt-1">{error.message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

const dailyLogSchema = z.object({
  logType: z.string().min(1, 'Log type is required'),
  date: z.string().min(1, 'Date is required'),
  deaths: z.string().optional(),
  feedKg: z.string().optional(),
  waterLiters: z.string().optional(),
  averageWeight: z.string().optional(),
  temperature: z.string().optional(),
  humidity: z.string().optional(),
  waterTDS: z.string().optional(),
  waterPH: z.string().optional(),
  notes: z.string().optional(),
});

export default function DailyLogSheet({ open, onClose, batchId, houses, editData }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { create, update } = useOfflineMutation('dailyLogs');
  const [saving, setSaving] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState('');
  const [photos, setPhotos] = useState([]);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: {
      logType: 'DAILY', date: new Date().toISOString().slice(0, 10),
      deaths: '', feedKg: '', waterLiters: '',
      averageWeight: '', temperature: '', humidity: '',
      waterTDS: '', waterPH: '', notes: '',
    },
  });

  useEffect(() => {
    if (editData) {
      const houseId = typeof editData.house === 'object' ? editData.house._id : editData.house;
      setSelectedHouse(houseId || '');
      setPhotos(editData.photos || []);
      reset({
        logType: editData.logType || 'DAILY',
        date: editData.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        deaths: editData.deaths?.toString() || '',
        feedKg: editData.feedKg?.toString() || '',
        waterLiters: editData.waterLiters?.toString() || '',
        averageWeight: editData.averageWeight?.toString() || '',
        temperature: editData.temperature?.toString() || '',
        humidity: editData.humidity?.toString() || '',
        waterTDS: editData.waterTDS?.toString() || '',
        waterPH: editData.waterPH?.toString() || '',
        notes: editData.notes || '',
      });
    } else {
      setSelectedHouse(houses?.[0]?._id || houses?.[0]?.house?._id || houses?.[0]?.house || '');
      setPhotos([]);
      reset({
        logType: 'DAILY', date: new Date().toISOString().slice(0, 10),
        deaths: '', feedKg: '', waterLiters: '',
        averageWeight: '', temperature: '', humidity: '',
        waterTDS: '', waterPH: '', notes: '',
      });
    }
  }, [editData, reset, open, houses]);

  const watchLogType = watch('logType');

  const logTypeOptions = LOG_TYPES.map((v) => ({ value: v, label: t(`batches.operations.logTypes.${v}`), icon: LOG_TYPE_ICONS[v] }));
  const houseOptions = useMemo(() =>
    (houses || []).map((h) => {
      const houseObj = typeof h.house === 'object' ? h.house : h;
      return { value: houseObj._id || houseObj, label: houseObj.name || `House` };
    }),
    [houses]);

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        batch: batchId,
        house: selectedHouse || null,
        date: formData.date,
        logType: formData.logType,
        deaths: parseNum(formData.deaths),
        feedKg: parseNum(formData.feedKg),
        waterLiters: parseNum(formData.waterLiters),
        averageWeight: parseNum(formData.averageWeight),
        temperature: parseNum(formData.temperature),
        humidity: parseNum(formData.humidity),
        waterTDS: parseNum(formData.waterTDS),
        waterPH: parseNum(formData.waterPH),
        notes: formData.notes || null,
        photos: photos.map((m) => (typeof m === 'object' ? m._id : m)),
      };

      if (editData?._id) {
        payload.updatedBy = user?._id;
        await update(editData._id, payload);
        toast({ title: t('batches.operations.entryUpdated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        payload.createdBy = user?._id;
        await create(tempId, payload, ['photos']);
        toast({ title: t('batches.operations.entryCreated') });
      }
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: err.message || t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">
            {editData ? t('batches.operations.editEntry') : t('batches.operations.addEntry')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
        <Separator />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Label>{t('batches.operations.logType')}<RequiredStar /></Label>
            <Controller control={control} name="logType"
              render={({ field: { value, onChange } }) => (
                <EnumButtonSelect value={value} onChange={onChange} options={logTypeOptions} columns={3} />
              )}
            />
            <FieldError error={errors.logType} />
          </View>

          <View className="gap-2">
            <Label>{t('batches.operations.date')}<RequiredStar /></Label>
            <Controller control={control} name="date"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('batches.operations.date')} />
              )}
            />
            <FieldError error={errors.date} />
          </View>

          {houseOptions.length > 0 && (
            <View className="gap-2">
              <Label>{t('batches.house')}</Label>
              <Select value={selectedHouse} onValueChange={setSelectedHouse} options={houseOptions} placeholder={t('batches.operations.selectHouse')} label={t('batches.house')} />
            </View>
          )}

          {watchLogType === 'DAILY' && (
            <>
              <View className="gap-2"><Label>{t('batches.operations.deaths')}</Label><Controller control={control} name="deaths" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="0" />)} /></View>
              <View className="gap-2"><Label>{t('batches.operations.feedKg')}</Label><Controller control={control} name="feedKg" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" />)} /></View>
              <View className="gap-2"><Label>{t('batches.operations.waterLiters')}</Label><Controller control={control} name="waterLiters" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" />)} /></View>
            </>
          )}

          {watchLogType === 'WEIGHT' && (
            <View className="gap-2"><Label>{t('batches.operations.averageWeight')}</Label><Controller control={control} name="averageWeight" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" />)} /></View>
          )}

          {watchLogType === 'ENVIRONMENT' && (
            <>
              <View className="gap-2"><Label>{t('batches.operations.temperature')}</Label><Controller control={control} name="temperature" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" />)} /></View>
              <View className="gap-2"><Label>{t('batches.operations.humidity')}</Label><Controller control={control} name="humidity" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" />)} /></View>
              <View className="gap-2"><Label>{t('batches.operations.waterTDS')}</Label><Controller control={control} name="waterTDS" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" />)} /></View>
              <View className="gap-2"><Label>{t('batches.operations.waterPH')}</Label><Controller control={control} name="waterPH" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} keyboardType="decimal-pad" />)} /></View>
            </>
          )}

          <View className="gap-2"><Label>{t('batches.operations.notes')}</Label><Controller control={control} name="notes" render={({ field: { value, onChange } }) => (<Input value={value} onChangeText={onChange} placeholder={t('batches.operations.notesPlaceholder')} multiline numberOfLines={3} style={{ textAlignVertical: 'top', minHeight: 80 }} />)} /></View>

          <MobileMultiFileUpload
            label={t('batches.operations.photos', 'Photos')}
            files={photos}
            onAdd={(media) => setPhotos((prev) => [...prev, media])}
            onRemove={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
            entityType="daily-log"
            entityId={editData?._id}
            category="daily-logs"
            mediaType="image"
            pickType="image"
          />
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
