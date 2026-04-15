import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function SecuritySettings() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => api.put('/settings/password', data),
    onSuccess: () => {
      reset();
      toast({ title: t('settings.passwordUpdated') });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.passwordUpdateError'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data) =>
    mutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.securityTitle')}</CardTitle>
        <CardDescription>{t('settings.securityDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
            <PasswordInput id="currentPassword" {...register('currentPassword')} />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
            <PasswordInput id="newPassword" {...register('newPassword')} />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('settings.confirmNewPassword')}</Label>
            <PasswordInput id="confirmPassword" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('settings.changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
