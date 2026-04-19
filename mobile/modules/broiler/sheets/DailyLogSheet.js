import { useState, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardList } from 'lucide-react-native';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import MultiFileUpload from '@/components/MultiFileUpload';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField, FormSubheader } from '@/components/FormSheetParts';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useAuthStore from '@/stores/authStore';
import { LOG_TYPES, LOG_TYPE_ICONS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

const parseNum = (v) => { if (!v || v === '') return null; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? null : n; };

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

  const logTypeOptions = useMemo(
    () => LOG_TYPES.map((v) => ({ value: v, label: t(`batches.operations.logTypes.${v}`), icon: LOG_TYPE_ICONS[v] })),
    [t]
  );
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

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={editData ? t('batches.operations.editEntry') : t('batches.operations.addEntry')}
      subtitle={t(`batches.operations.logTypes.${watchLogType}`, watchLogType)}
      icon={ClipboardList}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={editData ? t('common.save') : t('common.create')}
      loading={saving}
    >
      {/* Type & date */}
      <FormSection title={t('batches.operations.entryType', 'Entry Type')}>
        <FormField label={t('batches.operations.logType')} required error={errors.logType?.message}>
          <Controller
            control={control}
            name="logType"
            render={({ field: { value, onChange } }) => (
              <EnumButtonSelect value={value} onChange={onChange} options={logTypeOptions} columns={3} />
            )}
          />
        </FormField>

        <FormField label={t('batches.operations.date')} required error={errors.date?.message}>
          <Controller
            control={control}
            name="date"
            render={({ field: { value, onChange } }) => (
              <DatePicker value={value} onChange={onChange} label={t('batches.operations.date')} />
            )}
          />
        </FormField>

        {houseOptions.length > 0 ? (
          <FormField label={t('batches.house')}>
            <Select
              value={selectedHouse}
              onValueChange={setSelectedHouse}
              options={houseOptions}
              placeholder={t('batches.operations.selectHouse')}
              label={t('batches.house')}
            />
          </FormField>
        ) : null}
      </FormSection>

      {/* Type-specific metrics */}
      {watchLogType === 'DAILY' ? (
        <FormSection
          title={t('batches.operations.dailyMetrics', 'Daily Metrics')}
        >
          <Controller
            control={control}
            name="deaths"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.deaths')}
                value={value}
                onChangeText={onChange}
                keyboardType="number-pad"
                placeholder="0"
              />
            )}
          />
          <Controller
            control={control}
            name="feedKg"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.feedKg')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            )}
          />
          <Controller
            control={control}
            name="waterLiters"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.waterLiters')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            )}
          />
        </FormSection>
      ) : null}

      {watchLogType === 'WEIGHT' ? (
        <FormSection
          title={t('batches.operations.weightMetrics', 'Weight Sample')}
        >
          <Controller
            control={control}
            name="averageWeight"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.averageWeight')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            )}
          />
        </FormSection>
      ) : null}

      {watchLogType === 'ENVIRONMENT' ? (
        <FormSection
          title={t('batches.operations.environmentMetrics', 'Environment Readings')}
        >
          <Controller
            control={control}
            name="temperature"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.temperature')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
              />
            )}
          />
          <Controller
            control={control}
            name="humidity"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.humidity')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
              />
            )}
          />
          <Controller
            control={control}
            name="waterTDS"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.waterTDS')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
              />
            )}
          />
          <Controller
            control={control}
            name="waterPH"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.operations.waterPH')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
              />
            )}
          />
        </FormSection>
      ) : null}

      {/* Notes & photos */}
      <FormSection title={t('batches.operations.notesAndPhotos', 'Notes & Photos')}>
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange } }) => (
            <SheetInput
              label={t('batches.operations.notes')}
              value={value}
              onChangeText={onChange}
              placeholder={t('batches.operations.notesPlaceholder')}
              multiline
              numberOfLines={3}
              style={{ height: 100, alignItems: 'flex-start', paddingVertical: 12 }}
            />
          )}
        />
        <View>
          <FormSubheader>{t('batches.operations.photos', 'Photos')}</FormSubheader>
          <View style={{ marginTop: 10 }}>
            <MultiFileUpload
              label=""
              files={photos}
              onAdd={(media) => setPhotos((prev) => [...prev, media])}
              onRemove={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
              entityType="daily-log"
              entityId={editData?._id}
              category="daily-logs"
              mediaType="image"
              pickType="image"
            />
          </View>
        </View>
      </FormSection>
    </FormSheet>
  );
}
