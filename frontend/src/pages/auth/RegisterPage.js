import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import PasswordInput from '@/components/PasswordInput';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import PhoneInput from '@/components/PhoneInput';
import PasswordStrength from '@/components/PasswordStrength';
import useAuthStore from '@/stores/authStore';

const AVAILABLE_MODULES = [
  { slug: 'broiler', labelKey: 'modules.broiler', descKey: 'modules.broilerDesc', available: true },
  { slug: 'hatchery', labelKey: 'modules.hatchery', descKey: 'modules.hatcheryDesc', available: false },
  { slug: 'free-range', labelKey: 'modules.freeRange', descKey: 'modules.freeRangeDesc', available: false },
  { slug: 'egg-production', labelKey: 'modules.eggProduction', descKey: 'modules.eggProductionDesc', available: false },
  { slug: 'slaughterhouse', labelKey: 'modules.slaughterhouse', descKey: 'modules.slaughterhouseDesc', available: false },
];

const registerSchema = z
  .object({
    firstName: z.string().min(1, 'auth.firstNameRequired'),
    lastName: z.string().min(1, 'auth.lastNameRequired'),
    companyName: z.string().optional(),
    email: z.string().min(1, 'auth.emailRequired').email('auth.emailInvalid'),
    password: z.string().min(8, 'auth.passwordMin'),
    confirmPassword: z.string().min(1, 'auth.passwordRequired'),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  });

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModules, setSelectedModules] = useState(['broiler']);
  const { register: registerUser } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
    },
  });

  const watchPassword = watch('password');

  const toggleModule = (slug) => {
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((m) => m !== slug) : [...prev, slug]
    );
  };

  const goToStep2 = () => {
    if (selectedModules.length === 0) {
      toast({
        variant: 'destructive',
        title: t('modules.selectAtLeastOne'),
      });
      return;
    }
    setStep(2);
  };

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...userData } = values;
      await registerUser({ ...userData, modules: selectedModules });
      navigate('/dashboard');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('auth.registerError'),
        description: err.response?.data?.message || t('auth.registerError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedModuleNames = AVAILABLE_MODULES
    .filter((m) => selectedModules.includes(m.slug))
    .map((m) => t(m.labelKey));

  if (step === 1) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">{t('modules.title')}</CardTitle>
          <CardDescription>{t('modules.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {AVAILABLE_MODULES.map((mod) => (
            <label
              key={mod.slug}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                !mod.available
                  ? 'opacity-50 cursor-not-allowed'
                  : selectedModules.includes(mod.slug)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent'
              }`}
            >
              <Checkbox
                checked={selectedModules.includes(mod.slug)}
                onCheckedChange={() => mod.available && toggleModule(mod.slug)}
                disabled={!mod.available}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t(mod.labelKey)}</span>
                  {!mod.available && (
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {t('modules.comingSoon')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t(mod.descKey)}</p>
              </div>
            </label>
          ))}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button className="w-full" onClick={goToStep2}>
            {t('common.next')}
            <ArrowRight className="ml-2 h-4 w-4 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setStep(1)}
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div>
            <CardTitle className="text-xl">{t('auth.registerTitle')}</CardTitle>
            <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
          </div>
        </div>
        {/* Selected modules badge */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedModuleNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md"
            >
              <Check className="h-3 w-3" />
              {name}
            </span>
          ))}
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('auth.firstName')}</Label>
              <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-destructive">{t(errors.firstName.message)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('auth.lastName')}</Label>
              <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-destructive">{t(errors.lastName.message)}</p>
              )}
            </div>
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="companyName">{t('auth.companyName')}</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
              <Input
                id="companyName"
                autoComplete="organization"
                className="pl-9 rtl:pl-3 rtl:pr-9"
                {...register('companyName')}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label>{t('auth.phone')}</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{t(errors.email.message)}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              {...register('password')}
            />
            <PasswordStrength password={watchPassword} />
            {errors.password && (
              <p className="text-sm text-destructive">{t(errors.password.message)}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{t(errors.confirmPassword.message)}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:mr-0 rtl:ml-2" />}
            {t('auth.register')}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
