import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/PhoneInput';
import api from '@/lib/api';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});

export default function QuickAddContactDialog({ open, onOpenChange, onCreated, initialName = '' }) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
    },
  });

  useEffect(() => {
    if (open) {
      const parts = initialName.trim().split(/\s+/);
      reset({
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        email: '',
        phone: '',
        jobTitle: '',
      });
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (isOpen) => {
    if (!isOpen && !submitting) {
      reset();
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/contacts', formData);
      onCreated?.(data);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err.response?.data?.message || t('contacts.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('contacts.addContact')}</DialogTitle>
          <DialogDescription>{t('contacts.addContactDesc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qc-firstName">{t('contacts.firstName')}</Label>
              <Input id="qc-firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-lastName">{t('contacts.lastName')}</Label>
              <Input id="qc-lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-email">{t('contacts.email')}</Label>
            <Input id="qc-email" type="email" {...register('email')} />
          </div>

          <div className="space-y-2">
            <Label>{t('contacts.phone')}</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-jobTitle">{t('contacts.jobTitle')}</Label>
            <Input id="qc-jobTitle" {...register('jobTitle')} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
