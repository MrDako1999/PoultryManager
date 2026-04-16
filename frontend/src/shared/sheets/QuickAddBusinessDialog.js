import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import api from '@/lib/api';

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

export default function QuickAddBusinessDialog({ open, onOpenChange, onCreated }) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      tradeLicenseNumber: '',
      trnNumber: '',
    },
  });

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
      const { data } = await api.post('/businesses', formData);
      onCreated?.(data);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err.response?.data?.message || t('businesses.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('businesses.addBusiness')}</DialogTitle>
          <DialogDescription>{t('businesses.addBusinessDesc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="qb-companyName">{t('businesses.companyName')}</Label>
            <Input id="qb-companyName" {...register('companyName')} />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qb-tradeLicense">{t('businesses.tradeLicenseNumber')}</Label>
              <Input id="qb-tradeLicense" {...register('tradeLicenseNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qb-trn">{t('businesses.trnNumber')}</Label>
              <Input id="qb-trn" {...register('trnNumber')} />
            </div>
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
