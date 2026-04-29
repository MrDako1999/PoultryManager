import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Info, Home } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import MultiFileUpload from '@/components/MultiFileUpload';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useAuthStore from '@/stores/authStore';
import db from '@/lib/db';
import { todayStr, formatDateForInput, decimalInputHandler } from '@/lib/format';
import { LOG_TYPES, LOG_TYPE_ICONS } from '@/lib/constants';

const dailyLogSchema = z.object({
  logType: z.string().min(1, 'Entry type is required'),
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
}).superRefine((data, ctx) => {
  if (data.logType === 'WEIGHT') {
    const val = parseFloat(data.averageWeight);
    if (!data.averageWeight || isNaN(val) || val <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Average weight is required', path: ['averageWeight'] });
    }
  }
  if (data.logType === 'ENVIRONMENT') {
    const val = parseFloat(data.temperature);
    if (!data.temperature || isNaN(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Temperature is required', path: ['temperature'] });
    }
  }
});

const formDefaults = {
  logType: '',
  date: '',
  deaths: '',
  feedKg: '',
  waterLiters: '',
  averageWeight: '',
  temperature: '',
  humidity: '',
  waterTDS: '',
  waterPH: '',
  notes: '',
};

export default function DailyLogSheet({
  open,
  onOpenChange,
  batchId,
  houseId: externalHouseId,
  editingLog,
  batch,
  onSuccess,
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [photos, setPhotos] = useState([]);
  const [upsertMatch, setUpsertMatch] = useState(null);
  const [upsertConfirmed, setUpsertConfirmed] = useState(false);
  const [internalHouseId, setInternalHouseId] = useState(null);

  const houseId = externalHouseId || internalHouseId;
  const houses = batch?.houses || [];
  const needsHouseSelector = !externalHouseId && houses.length > 0;

  const form = useForm({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: formDefaults,
  });

  const guard = useFormGuard(form.formState.isDirty);

  const logTypeOptions = useMemo(
    () => LOG_TYPES.map((lt) => ({
      value: lt,
      label: t(`batches.operations.logTypes.${lt}`),
      icon: LOG_TYPE_ICONS[lt],
    })),
    [t]
  );

  const watchLogType = form.watch('logType');
  const watchDate = form.watch('date');

  const batchStartDate = batch?.startDate
    ? formatDateForInput(batch.startDate)
    : '';

  const isDateValid = useCallback((dateStr) => {
    if (!dateStr || !batchStartDate) return true;
    return dateStr >= batchStartDate;
  }, [batchStartDate]);

  const resolveId = (ref) => (typeof ref === 'object' && ref !== null ? ref._id : ref);

  // Check for existing entry when date + logType change (upsert detection)
  const existingEntry = useLiveQuery(async () => {
    if (!open || !watchDate || !watchLogType || !houseId || !batchId) return null;
    if (editingLog) return null;

    const matches = await db.dailyLogs
      .where('batch')
      .equals(batchId)
      .filter((log) =>
        resolveId(log.house) === houseId &&
        log.logType === watchLogType &&
        !log.deletedAt &&
        formatDateForInput(log.date) === watchDate
      )
      .toArray();

    return matches.length > 0 ? matches[0] : null;
  }, [open, watchDate, watchLogType, houseId, batchId, editingLog]);

  useEffect(() => {
    if (!existingEntry || editingLog) {
      setUpsertMatch(null);
      setUpsertConfirmed(false);
      return;
    }
    setUpsertMatch(existingEntry);
    setUpsertConfirmed(false);
  }, [existingEntry, editingLog]);

  const confirmEditExisting = useCallback(() => {
    if (!upsertMatch) return;
    form.setValue('deaths', upsertMatch.deaths != null ? String(upsertMatch.deaths) : '');
    form.setValue('feedKg', upsertMatch.feedKg != null ? String(upsertMatch.feedKg) : '');
    form.setValue('waterLiters', upsertMatch.waterLiters != null ? String(upsertMatch.waterLiters) : '');
    form.setValue('averageWeight', upsertMatch.averageWeight != null ? String(upsertMatch.averageWeight) : '');
    form.setValue('temperature', upsertMatch.temperature != null ? String(upsertMatch.temperature) : '');
    form.setValue('humidity', upsertMatch.humidity != null ? String(upsertMatch.humidity) : '');
    form.setValue('waterTDS', upsertMatch.waterTDS != null ? String(upsertMatch.waterTDS) : '');
    form.setValue('waterPH', upsertMatch.waterPH != null ? String(upsertMatch.waterPH) : '');
    form.setValue('notes', upsertMatch.notes || '');
    setPhotos(upsertMatch.photos || []);
    setUpsertConfirmed(true);
  }, [upsertMatch, form]);

  const closeSheet = () => {
    onOpenChange(false);
    setPhotos([]);
    setUpsertMatch(null);
    setUpsertConfirmed(false);
    setInternalHouseId(null);
    guard.resetGuard();
    form.reset(formDefaults);
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  useEffect(() => {
    if (!open || !editingLog) return;
    guard.resetGuard();
    form.reset({
      logType: editingLog.logType || '',
      date: formatDateForInput(editingLog.date),
      deaths: editingLog.deaths != null ? String(editingLog.deaths) : '',
      feedKg: editingLog.feedKg != null ? String(editingLog.feedKg) : '',
      waterLiters: editingLog.waterLiters != null ? String(editingLog.waterLiters) : '',
      averageWeight: editingLog.averageWeight != null ? String(editingLog.averageWeight) : '',
      temperature: editingLog.temperature != null ? String(editingLog.temperature) : '',
      humidity: editingLog.humidity != null ? String(editingLog.humidity) : '',
      waterTDS: editingLog.waterTDS != null ? String(editingLog.waterTDS) : '',
      waterPH: editingLog.waterPH != null ? String(editingLog.waterPH) : '',
      notes: editingLog.notes || '',
    });
    setPhotos(editingLog.photos || []);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingLog?._id]);

  useEffect(() => {
    if (!open || editingLog) return;
    guard.resetGuard();
    setPhotos([]);
    setUpsertMatch(null);
    form.reset({ ...formDefaults, date: todayStr() });
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { mutate, isPending: isMutating } = useOfflineMutation('dailyLogs');

  const onSubmit = (formData) => {
    if (!isDateValid(formData.date)) {
      form.setError('date', { message: t('batches.operations.dateBeforeStart') });
      return;
    }

    if (blockedByDuplicate) {
      form.setError('date', { message: t('batches.operations.duplicateExists') });
      return;
    }

    const parseNum = (v) => {
      if (!v && v !== 0) return null;
      const n = parseFloat(String(v).replace(/,/g, ''));
      return isNaN(n) ? null : n;
    };

    const payload = {
      batch: batchId,
      house: houseId,
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
      createdBy: user?._id,
      updatedBy: user?._id,
    };

    const targetId = editingLog?._id || upsertMatch?._id;
    const isUpdate = !!targetId;

    mutate({
      action: isUpdate ? 'update' : 'create',
      id: targetId,
      data: payload,
      mediaFields: ['photos'],
    }, {
      onSuccess: () => {
        toast({
          title: isUpdate
            ? t('batches.operations.entryUpdated')
            : t('batches.operations.entryCreated'),
        });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  const blockedByDuplicate = !!upsertMatch && !editingLog && !upsertConfirmed;
  const showFields = !!editingLog || (!!watchDate && !blockedByDuplicate);
  const isEditing = !!editingLog || (!!upsertMatch && upsertConfirmed);

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {isEditing ? t('batches.operations.editEntry') : t('batches.operations.addEntry')}
            </SheetTitle>
            <SheetDescription>
              {isEditing ? t('batches.operations.editEntryDesc') : t('batches.operations.addEntryDesc')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="daily-log-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4 overflow-hidden">
              {needsHouseSelector && !editingLog && (
                <div className="space-y-2">
                  <Label>{t('batches.house')} <span className="text-destructive">*</span></Label>
                  <Select value={internalHouseId || ''} onValueChange={setInternalHouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('batches.operations.selectHouse', 'Select a house…')} />
                    </SelectTrigger>
                    <SelectContent>
                      {houses.map((entry) => {
                        const hId = typeof entry.house === 'object' ? entry.house._id : entry.house;
                        const name = typeof entry.house === 'object' ? entry.house.name : `${t('batches.house')} ${hId}`;
                        return (
                          <SelectItem key={hId} value={hId}>
                            <span className="flex items-center gap-2">
                              <Home className="h-3.5 w-3.5 text-muted-foreground" />
                              {name}
                              <span className="text-xs text-muted-foreground">({entry.quantity?.toLocaleString('en-US')} {t('farms.birds')})</span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Log Type selector */}
              <div className="space-y-2">
                <Label>{t('batches.operations.logType')} <span className="text-destructive">*</span></Label>
                <input type="hidden" {...form.register('logType')} />
                <EnumButtonSelect
                  options={logTypeOptions}
                  value={watchLogType}
                  onChange={(val) => form.setValue('logType', val, { shouldDirty: true, shouldValidate: true })}
                  columns={3}
                  disabled={!!editingLog}
                />
                {form.formState.errors.logType && (
                  <p className="text-sm text-destructive">{form.formState.errors.logType.message}</p>
                )}
              </div>

              {/* Date */}
              {(!!editingLog || !!watchLogType) && (
                <div className="space-y-2">
                  <Label htmlFor="dl-date">{t('batches.operations.date')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="dl-date"
                    type="date"
                    min={batchStartDate}
                    {...form.register('date')}
                  />
                  {form.formState.errors.date && (
                    <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
                  )}
                  {watchDate && !isDateValid(watchDate) && (
                    <p className="text-sm text-destructive">{t('batches.operations.dateBeforeStart')}</p>
                  )}
                </div>
              )}

              {/* Duplicate detected — blocking prompt */}
              {upsertMatch && !editingLog && !upsertConfirmed && (
                <div className="rounded-lg border border-warning/30 bg-warning-bg px-4 py-4">
                  <div className="flex items-start gap-2 mb-3">
                    <Info className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                    <p className="text-sm text-warning">
                      {t('batches.operations.duplicateExists')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={confirmEditExisting}>
                      {t('batches.operations.editExisting')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={closeSheet}>
                      {t('common.discard')}
                    </Button>
                  </div>
                </div>
              )}

              {/* DAILY fields */}
              {showFields && watchLogType === 'DAILY' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="dl-deaths">{t('batches.operations.deaths')}</Label>
                    <Input
                      id="dl-deaths"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      {...form.register('deaths')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-feedKg">{t('batches.operations.feedKg')}</Label>
                    <Input
                      id="dl-feedKg"
                      inputMode="decimal"
                      min="0"
                      {...form.register('feedKg', { onChange: decimalInputHandler })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-waterLiters">{t('batches.operations.waterLiters')}</Label>
                    <Input
                      id="dl-waterLiters"
                      inputMode="decimal"
                      min="0"
                      {...form.register('waterLiters', { onChange: decimalInputHandler })}
                    />
                  </div>
                </>
              )}

              {/* WEIGHT fields */}
              {showFields && watchLogType === 'WEIGHT' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="dl-avgWeight">
                      {t('batches.operations.averageWeight')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="dl-avgWeight"
                      inputMode="decimal"
                      min="0"
                      {...form.register('averageWeight', { onChange: decimalInputHandler })}
                    />
                    {form.formState.errors.averageWeight && (
                      <p className="text-sm text-destructive">{form.formState.errors.averageWeight.message}</p>
                    )}
                  </div>
                </>
              )}

              {/* ENVIRONMENT fields */}
              {showFields && watchLogType === 'ENVIRONMENT' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="dl-temp">
                      {t('batches.operations.temperature')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="dl-temp"
                      inputMode="decimal"
                      {...form.register('temperature', { onChange: decimalInputHandler })}
                    />
                    {form.formState.errors.temperature && (
                      <p className="text-sm text-destructive">{form.formState.errors.temperature.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-humidity">{t('batches.operations.humidity')}</Label>
                    <Input
                      id="dl-humidity"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      {...form.register('humidity', { onChange: decimalInputHandler })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-waterTDS">{t('batches.operations.waterTDS')}</Label>
                    <Input
                      id="dl-waterTDS"
                      inputMode="decimal"
                      min="0"
                      {...form.register('waterTDS', { onChange: decimalInputHandler })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-waterPH">{t('batches.operations.waterPH')}</Label>
                    <Input
                      id="dl-waterPH"
                      inputMode="decimal"
                      min="0"
                      max="14"
                      step="0.1"
                      {...form.register('waterPH', { onChange: decimalInputHandler })}
                    />
                  </div>
                </>
              )}

              {/* Notes & Photos */}
              {showFields && !!watchLogType && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="dl-notes">{t('batches.operations.notes')}</Label>
                    <Textarea
                      id="dl-notes"
                      {...form.register('notes')}
                      placeholder={t('batches.operations.notesPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <MultiFileUpload
                    label={t('batches.operations.photos')}
                    files={photos}
                    onAdd={(media) => {
                      setPhotos((prev) => [...prev, media]);
                      guard.markDirty();
                    }}
                    onRemove={(i) => {
                      setPhotos((prev) => prev.filter((_, idx) => idx !== i));
                      guard.markDirty();
                    }}
                    entityType="daily-log"
                    entityId={editingLog?._id || upsertMatch?._id}
                    category="daily-logs"
                    guardMarkDirty={guard.markDirty}
                  />
                </>
              )}
            </form>
          </ScrollArea>

          {!blockedByDuplicate && (
            <SheetFooter>
              <Button type="button" variant="outline" onClick={tryClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="daily-log-form" disabled={isMutating}>
                {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? t('common.save') : t('common.create')}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />
    </>
  );
}
