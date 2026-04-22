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
import useLocalQuery from '@/hooks/useLocalQuery';
import useLocalRecord from '@/hooks/useLocalRecord';
import useAuthStore from '@/stores/authStore';
import useCapabilities from '@/hooks/useCapabilities';
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

export default function DailyLogSheet({
  open,
  onClose,
  batchId,
  houses,
  editData,
  defaultLogType,
  defaultHouseId,
  // ISO YYYY-MM-DD. Used by the "fill missing day" entry point in
  // BatchLogTypeTab so the form opens to the gap day instead of today.
  // Falls back to today if the caller doesn't supply it.
  defaultDate,
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { can } = useCapabilities();
  const { create, update } = useOfflineMutation('dailyLogs');
  const [saving, setSaving] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState('');
  const [photos, setPhotos] = useState([]);

  // Pull the parent batch + its logs so the calendar can paint
  // submitted/missing markers and clamp the picker to the active
  // cycle. Both queries are local-first and reactive — when a new log
  // syncs in, the markers update without manual invalidation.
  const [batch] = useLocalRecord('batches', batchId);
  const [batchLogs] = useLocalQuery('dailyLogs', { batch: batchId });

  // Worker / vet roles can be capped to a subset of LOG_TYPES via the
  // `dailyLog:create:<TYPE>` action grammar in shared/permissions.js.
  // Only show the types this user can actually create. Owners/managers
  // hold `dailyLog:*` so they see everything; ground_staff and vets see
  // a filtered list. Falls back to the full list if the user somehow
  // has none of the create caps (defensive — we'd rather show options
  // than render an empty button row).
  const allowedLogTypes = useMemo(() => {
    const allowed = LOG_TYPES.filter((typeName) => can(`dailyLog:create:${typeName}`)
      || can('dailyLog:create'));
    return allowed.length ? allowed : LOG_TYPES;
  }, [can]);

  const initialLogType = useMemo(() => {
    if (editData?.logType) return editData.logType;
    if (defaultLogType && allowedLogTypes.includes(defaultLogType)) return defaultLogType;
    return allowedLogTypes[0] || 'DAILY';
  }, [editData?.logType, defaultLogType, allowedLogTypes]);

  const initialDate = useMemo(() => {
    if (editData?.date) return editData.date.slice(0, 10);
    if (defaultDate) return defaultDate;
    return new Date().toISOString().slice(0, 10);
  }, [editData?.date, defaultDate]);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: {
      logType: initialLogType, date: initialDate,
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
      // Pre-select the requested house when the caller supplies a
      // `defaultHouseId` (worker dashboard / tasks list does this so
      // the sheet opens already pinned to the house they tapped).
      const fallbackHouse =
        houses?.[0]?._id || houses?.[0]?.house?._id || houses?.[0]?.house || '';
      setSelectedHouse(defaultHouseId || fallbackHouse);
      setPhotos([]);
      reset({
        logType: initialLogType, date: initialDate,
        deaths: '', feedKg: '', waterLiters: '',
        averageWeight: '', temperature: '', humidity: '',
        waterTDS: '', waterPH: '', notes: '',
      });
    }
  }, [editData, reset, open, houses, defaultHouseId, initialLogType, initialDate]);

  const watchLogType = watch('logType');

  const logTypeOptions = useMemo(
    () => allowedLogTypes.map((v) => ({
      value: v,
      label: t(`batches.operations.logTypes.${v}`),
      icon: LOG_TYPE_ICONS[v],
    })),
    [t, allowedLogTypes]
  );
  const houseOptions = useMemo(() =>
    (houses || []).map((h) => {
      const houseObj = typeof h.house === 'object' ? h.house : h;
      return { value: houseObj._id || houseObj, label: houseObj.name || `House` };
    }),
    [houses]);

  // Date bounds — start of cycle through today (or batch endDate when
  // the cycle has been closed out). New entries on COMPLETE batches
  // are blocked entirely; the form still opens for read/edit when
  // editData is supplied so historical edits remain possible if the
  // owner chooses to allow them via permissions.
  const isCompleted = batch?.status === 'COMPLETE';
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const minDate = batch?.startDate
    ? new Date(batch.startDate).toISOString().slice(0, 10)
    : undefined;
  // Hard cap at today even on completed batches; if the batch carries
  // an explicit end date earlier than today we use that. Workers can
  // never log into the future regardless of role.
  const batchEndKey = batch?.endDate
    ? new Date(batch.endDate).toISOString().slice(0, 10)
    : null;
  const maxDate = batchEndKey && batchEndKey < todayKey ? batchEndKey : todayKey;

  // Per-(house, logType) calendar markings: green for days that
  // already have an entry, yellow for days inside the cycle that
  // don't. The user picks "Date" inside the sheet *after* picking
  // house + log type, so we recompute as those change. We skip
  // markings entirely until both selections are made — otherwise
  // every date would render as 'missing'.
  const markedDates = useMemo(() => {
    if (!selectedHouse || !watchLogType || !minDate) return undefined;
    const submittedKeys = new Set();
    for (const log of batchLogs || []) {
      if (log.deletedAt) continue;
      if (log.logType !== watchLogType) continue;
      const hid = String(typeof log.house === 'object' ? log.house?._id : log.house);
      if (hid !== String(selectedHouse)) continue;
      const raw = log.logDate || log.date;
      if (!raw) continue;
      submittedKeys.add(new Date(raw).toISOString().slice(0, 10));
    }

    const map = {};
    submittedKeys.forEach((k) => { map[k] = 'submitted'; });

    // Walk from start to maxDate, marking unsubmitted days as missing.
    // This respects the unique-per-day index, and puts a yellow ring
    // around every actionable empty cell so workers know what's left.
    const cursor = new Date(`${minDate}T00:00:00`);
    const limit = new Date(`${maxDate}T00:00:00`);
    while (cursor.getTime() <= limit.getTime()) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!submittedKeys.has(key)) map[key] = 'missing';
      cursor.setDate(cursor.getDate() + 1);
    }
    return map;
  }, [batchLogs, selectedHouse, watchLogType, minDate, maxDate]);

  const onSubmit = async (formData) => {
    // Refuse new entries on a completed batch — the FAB / pending
    // slots are already hidden in the UI but this is the last-line
    // guard for any deep-link path.
    if (isCompleted && !editData) {
      toast({
        variant: 'destructive',
        title: t(
          'batches.operations.completeBlocked',
          'This batch is complete. New entries are no longer accepted.'
        ),
      });
      return;
    }

    // Belt-and-braces date clamp — the picker disables out-of-range
    // cells but a deep-link prefill or an old in-flight selection
    // could still slip a bad date through.
    const dateKey = String(formData.date || '').slice(0, 10);
    if (minDate && dateKey < minDate) {
      toast({
        variant: 'destructive',
        title: t('batches.operations.dateBeforeStart', 'Date is before the batch start.'),
      });
      return;
    }
    if (maxDate && dateKey > maxDate) {
      toast({
        variant: 'destructive',
        title: t('batches.operations.dateInFuture', 'Future dates are not allowed.'),
      });
      return;
    }

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
      subtitle={
        isCompleted && !editData
          ? t('batches.operations.completeReadonly', 'Batch complete — read only')
          : t(`batches.operations.logTypes.${watchLogType}`, watchLogType)
      }
      icon={ClipboardList}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={editData ? t('common.save') : t('common.create')}
      loading={saving}
      disabled={isCompleted && !editData}
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

        {/* House goes BEFORE date so the calendar's submitted/missing
            markers reflect the actually-selected house. Otherwise
            opening the picker before picking a house would paint
            misleading rings. */}
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

        <FormField label={t('batches.operations.date')} required error={errors.date?.message}>
          <Controller
            control={control}
            name="date"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                value={value}
                onChange={onChange}
                label={t('batches.operations.date')}
                minDate={minDate}
                maxDate={maxDate}
                markedDates={markedDates}
              />
            )}
          />
        </FormField>
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
