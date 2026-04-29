// NewJobSheet — single-step creation sheet for a processingJob.
//
// Per plan §3g this used to be sketched as a 2-step wizard, but the
// minimum viable job is just { customer, openedAt }. Trucks are added
// from inside the JobDetailLayout's Trucks tab (TruckEntrySheet) so
// the gate clerk doesn't have to enter all truck data before they can
// start tracking the job.
//
// Mirrors SourceSheet pattern: useOfflineMutation, useFormGuard,
// ConfirmDiscardDialog, react-hook-form + zod, SearchableSelect for
// customer with QuickAddBusinessSheet inline.
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useAuthStore from '@/stores/authStore';
import { formatDateForInput, todayStr } from '@/lib/format';

const jobSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  jobNumber: z.string().optional(),
  openedAt: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

const defaults = {
  customer: '',
  jobNumber: '',
  openedAt: todayStr(),
  notes: '',
};

// Auto-generates a job number like JOB-2026-04-28-007 — sequence is
// the count of jobs created today + 1. Pure function, recomputed on
// open.
function autoJobNumber(existingJobs) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const sameDay = existingJobs.filter((j) => {
    if (!j.openedAt) return false;
    return new Date(j.openedAt).toISOString().slice(0, 10) === todayKey;
  });
  const seq = String(sameDay.length + 1).padStart(3, '0');
  return `JOB-${todayKey}-${seq}`;
}

export default function NewJobSheet({ open, onOpenChange, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');

  const businesses = useLocalQuery('businesses');
  const allJobs = useLocalQuery('processingJobs');

  const form = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: defaults,
  });

  const guard = useFormGuard(form.formState.isDirty);

  const businessOptions = useMemo(
    () => businesses
      .filter((b) => !b.deletedAt)
      .map((b) => ({
        value: b._id,
        label: b.companyName,
        description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
      })),
    [businesses],
  );

  // Reset / pre-populate on open.
  useEffect(() => {
    if (!open) return;
    guard.resetGuard();
    form.reset({
      ...defaults,
      jobNumber: autoJobNumber(allJobs),
    });
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeSheet = () => {
    onOpenChange(false);
    form.reset(defaults);
    guard.resetGuard();
  };

  const tryClose = () => {
    if (guard.isDirty) guard.setConfirmOpen(true);
    else closeSheet();
  };

  const { mutate, isPending } = useOfflineMutation('processingJobs');

  const onSubmit = (formData) => {
    const payload = {
      jobNumber: formData.jobNumber || autoJobNumber(allJobs),
      customer: formData.customer,
      openedAt: formData.openedAt
        ? new Date(formData.openedAt).toISOString()
        : new Date().toISOString(),
      openedBy: user?._id || null,
      status: 'NEW',
      notes: formData.notes || '',
    };

    mutate({
      action: 'create',
      data: payload,
    }, {
      onSuccess: (record) => {
        toast({ title: t('processingJobs.jobCreated', 'Job created') });
        closeSheet();
        onSuccess?.(record);
        if (record?._id) {
          navigate(`/dashboard/processing-jobs/${record._id}`);
        }
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('processingJobs.newJob', 'New Job')}</SheetTitle>
            <SheetDescription>
              {t('processingJobs.newJobDesc', 'Open a new processing job for an inbound truck.')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="new-job-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">

              <div className="space-y-2">
                <Label>
                  {t('processingJobs.customer', 'Customer')}
                  <span className="text-destructive ms-1">*</span>
                </Label>
                <input type="hidden" {...form.register('customer')} />
                <SearchableSelect
                  options={businessOptions}
                  value={form.watch('customer')}
                  onChange={(val) => form.setValue('customer', val, { shouldDirty: true })}
                  placeholder={t('trucks.selectSupplier', 'Select a business…')}
                  searchPlaceholder={t('common.search', 'Search…')}
                  emptyMessage={t('common.noResults', 'No results')}
                  createLabel={t('businesses.addBusiness', 'Add Business')}
                  onCreate={(name) => {
                    setQabName(name || '');
                    setQabOpen(true);
                  }}
                />
                {form.formState.errors.customer && (
                  <p className="text-sm text-destructive">{form.formState.errors.customer.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="job-openedAt">{t('processingJobs.openedAt', 'Opened')}</Label>
                  <Input
                    id="job-openedAt"
                    type="date"
                    {...form.register('openedAt')}
                  />
                  {form.formState.errors.openedAt && (
                    <p className="text-sm text-destructive">{form.formState.errors.openedAt.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-jobNumber">{t('processingJobs.jobNumber', 'Job number')}</Label>
                  <Input
                    id="job-jobNumber"
                    {...form.register('jobNumber')}
                    placeholder="JOB-…"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-notes">{t('common.notes', 'Notes')}</Label>
                <Textarea
                  id="job-notes"
                  rows={3}
                  {...form.register('notes')}
                />
              </div>

            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="new-job-form" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create', 'Create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddBusinessSheet
        open={qabOpen}
        onOpenChange={setQabOpen}
        onCreated={(biz) => {
          form.setValue('customer', biz._id, { shouldDirty: true });
        }}
        initialName={qabName}
      />
    </>
  );
}
