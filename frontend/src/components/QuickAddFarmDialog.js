import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { LuEgg, LuEggFried, LuFactory, LuTrees } from 'react-icons/lu';
import { PiBird } from 'react-icons/pi';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useOfflineMutation from '@/hooks/useOfflineMutation';

const FARM_TYPES = ['hatchery', 'broiler', 'free_range', 'layer_eggs', 'slaughterhouse'];
const FARM_TYPE_ICONS = {
  hatchery: LuEgg,
  broiler: PiBird,
  free_range: LuTrees,
  layer_eggs: LuEggFried,
  slaughterhouse: LuFactory,
};

const schema = z.object({
  farmName: z.string().min(1, 'Farm name is required'),
  farmType: z.enum(FARM_TYPES),
  capacity: z.string().optional().transform((val) => {
    if (!val || val === '') return null;
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? null : num;
  }),
});

export default function QuickAddFarmDialog({ open, onOpenChange, onCreated, initialName = '' }) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState('broiler');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { farmName: '', farmType: 'broiler', capacity: '' },
  });

  const farmTypeOptions = useMemo(
    () => FARM_TYPES.map((type) => ({
      value: type,
      label: t(`farms.farmTypes.${type}`),
      Icon: FARM_TYPE_ICONS[type],
    })),
    [t]
  );

  useEffect(() => {
    if (open) {
      reset({ farmName: initialName, farmType: 'broiler', capacity: '' });
      setSelectedType('broiler');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate, isPending } = useOfflineMutation('farms');
  const { mutate: createHouse } = useOfflineMutation('houses');

  const handleOpenChange = (isOpen) => {
    if (!isOpen && !isPending) {
      reset({ farmName: '', farmType: 'broiler', capacity: '' });
      setSelectedType('broiler');
    }
    onOpenChange(isOpen);
  };

  const onSubmit = (formData) => {
    mutate({
      action: 'create',
      data: { farmName: formData.farmName, farmType: formData.farmType },
    }, {
      onSuccess: (newFarm) => {
        if (formData.capacity) {
          createHouse({
            action: 'create',
            data: { farm: newFarm._id, name: 'House 1', capacity: formData.capacity, sortOrder: 0 },
          });
        }
        onCreated?.(newFarm);
        reset({ farmName: '', farmType: 'broiler', capacity: '' });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('farms.addFarm')}</DialogTitle>
          <DialogDescription>{t('farms.addFarmDesc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="qf-farmName">{t('farms.farmName')}</Label>
            <Input id="qf-farmName" {...register('farmName')} />
            {errors.farmName && (
              <p className="text-sm text-destructive">{errors.farmName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('farms.farmType')}</Label>
            <input type="hidden" {...register('farmType')} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {farmTypeOptions.map(({ value, label, Icon }) => {
                const selected = selectedType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelectedType(value);
                      setValue('farmType', value, { shouldDirty: true });
                    }}
                    className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-input bg-background hover:bg-accent/50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qf-capacity">{t('farms.initialCapacity', 'Capacity (optional)')}</Label>
            <Input
              id="qf-capacity"
              inputMode="numeric"
              {...register('capacity', {
                onChange: (e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  e.target.value = raw ? Number(raw).toLocaleString() : '';
                },
              })}
              placeholder={t('farms.capacityQuickPlaceholder', 'e.g. 5,000')}
            />
            <p className="text-xs text-muted-foreground">
              {t('farms.capacityQuickHint', 'A default house will be created with this capacity. You can add more houses later.')}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
