import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Landmark, Banknote, FileCheck, CreditCard } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import Separator from '@/components/ui/Separator';
import FileUpload from '@/components/FileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';

const TRANSFER_TYPES = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT'];

const TRANSFER_TYPE_ICONS = {
  BANK_TRANSFER: Landmark,
  CASH: Banknote,
  CHEQUE: FileCheck,
  CREDIT: CreditCard,
};

const QUICK_ADD_VALUE = '__quick_add__';

const parseNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const transferSchema = z.object({
  business: z.string().min(1, 'Business is required'),
  transferDate: z.string().min(1, 'Transfer date is required'),
  amount: z.string().min(1, 'Amount is required'),
  transferType: z.enum(TRANSFER_TYPES),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (parseNum(data.amount) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be greater than 0', path: ['amount'] });
  }
});

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const defaultValues = {
  business: '',
  transferDate: todayYMD(),
  amount: '',
  transferType: 'CASH',
  notes: '',
};

function FieldError({ error }) {
  if (!error) return null;
  return <Text className="text-xs text-destructive mt-1">{error.message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

export default function TransferSheet({
  open,
  onClose,
  editData = null,
  onDelete,
  canDelete = false,
  preselectedBusinessId,
}) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { toast } = useToast();
  const [businesses] = useLocalQuery('businesses');
  const { create, update } = useOfflineMutation('transfers');
  const [saving, setSaving] = useState(false);
  const [transferProof, setTransferProof] = useState(null);
  const [quickAddBizOpen, setQuickAddBizOpen] = useState(false);

  const isEditing = !!editData?._id;

  const {
    control, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues,
  });

  const watchBusiness = watch('business');

  useEffect(() => {
    if (!open) return;
    if (editData) {
      const businessId = typeof editData.business === 'object'
        ? editData.business?._id
        : editData.business;
      reset({
        business: businessId || preselectedBusinessId || '',
        transferDate: editData.transferDate
          ? new Date(editData.transferDate).toISOString().slice(0, 10)
          : todayYMD(),
        amount: editData.amount != null ? String(editData.amount) : '',
        transferType: editData.transferType || 'CASH',
        notes: editData.notes || '',
      });
      setTransferProof(
        editData.transferProof && typeof editData.transferProof === 'object'
          ? editData.transferProof
          : null
      );
    } else {
      reset({
        ...defaultValues,
        business: preselectedBusinessId || '',
      });
      setTransferProof(null);
    }
  }, [open, editData?._id, preselectedBusinessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const businessOptions = useMemo(() => {
    const options = businesses.map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    }));
    options.unshift({
      value: QUICK_ADD_VALUE,
      label: t('businesses.addNewBusiness', 'Add new business…'),
      description: t('farms.addNewBusinessHint', 'Quickly create a business and link it'),
    });
    return options;
  }, [businesses, t]);

  const transferTypeOptions = useMemo(
    () => TRANSFER_TYPES.map((tt) => ({
      value: tt,
      label: t(`transfers.types.${tt}`, tt),
      icon: TRANSFER_TYPE_ICONS[tt],
    })),
    [t]
  );

  const handleBusinessChange = (businessId) => {
    if (businessId === QUICK_ADD_VALUE) {
      setQuickAddBizOpen(true);
      return;
    }
    setValue('business', businessId || '', { shouldDirty: true });
  };

  const handleBizCreated = (newBiz) => {
    setValue('business', newBiz._id, { shouldDirty: true });
    setQuickAddBizOpen(false);
  };

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        business: formData.business,
        transferDate: formData.transferDate,
        amount: parseNum(formData.amount),
        transferType: formData.transferType,
        notes: formData.notes || '',
        transferProof: transferProof?._id || null,
      };
      if (isEditing) {
        await update(editData._id, payload);
        toast({ title: t('transfers.transferUpdated', 'Transfer updated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload, ['transferProof']);
        toast({ title: t('transfers.transferCreated', 'Transfer recorded') });
      }
      onClose();
    } catch (err) {
      console.error('[TransferSheet] save failed', err);
      toast({
        variant: 'destructive',
        title: isEditing
          ? t('transfers.updateError', 'Failed to update transfer')
          : t('transfers.createError', 'Failed to record transfer'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const businessLocked = !!preselectedBusinessId;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">
            {isEditing
              ? t('transfers.editTransfer', 'Edit Transfer')
              : t('transfers.addTransfer', 'Add Transfer')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
        <Separator />

        <ScrollView
          className="flex-1 px-4"
          contentContainerClassName="py-4 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Label>{t('transfers.business', 'Business')}<RequiredStar /></Label>
            {businessLocked ? (
              <View className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <Text className="text-sm text-foreground" numberOfLines={1}>
                  {businesses.find((b) => b._id === preselectedBusinessId)?.companyName
                    || t('transfers.business', 'Business')}
                </Text>
              </View>
            ) : (
              <Select
                value={watchBusiness || ''}
                onValueChange={handleBusinessChange}
                options={businessOptions}
                placeholder={t('transfers.selectBusiness', 'Select a business…')}
                label={t('transfers.business', 'Business')}
              />
            )}
            <FieldError error={errors.business} />
          </View>

          <View className="gap-2">
            <Label>{t('transfers.transferDate', 'Transfer Date')}<RequiredStar /></Label>
            <Controller
              control={control}
              name="transferDate"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('transfers.transferDate', 'Transfer Date')} />
              )}
            />
            <FieldError error={errors.transferDate} />
          </View>

          <View className="gap-2">
            <Label>{t('transfers.amount', 'Amount')}<RequiredStar /></Label>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              )}
            />
            <FieldError error={errors.amount} />
          </View>

          <View className="gap-2">
            <Label>{t('transfers.transferType', 'Transfer Type')}<RequiredStar /></Label>
            <Controller
              control={control}
              name="transferType"
              render={({ field: { value, onChange } }) => (
                <EnumButtonSelect
                  value={value}
                  onChange={onChange}
                  options={transferTypeOptions}
                  columns={2}
                  compact
                />
              )}
            />
            <FieldError error={errors.transferType} />
          </View>

          <View className="gap-2">
            <Label>{t('transfers.notes', 'Notes')}</Label>
            <Controller
              control={control}
              name="notes"
              render={({ field: { value, onChange } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('transfers.notesPlaceholder', 'Additional notes about this transfer...')}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: 'top' }}
                />
              )}
            />
          </View>

          <Separator />

          <FileUpload
            label={t('transfers.transferProof', 'Transfer Proof')}
            value={transferProof}
            onUpload={setTransferProof}
            onRemove={() => setTransferProof(null)}
            entityType="transfer"
            category="transfers"
            mediaType="document"
          />
        </ScrollView>

        <View
          className="px-4 pt-4 border-t border-border"
          style={{ paddingBottom: Math.max(safeBottom, 16) }}
        >
          <Button onPress={handleSubmit(onSubmit)} loading={saving} disabled={saving}>
            {isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
          </Button>
          {isEditing && canDelete && onDelete && (
            <Pressable
              onPress={() => {
                onClose();
                onDelete();
              }}
              disabled={saving}
              hitSlop={8}
              className="self-center mt-3 px-2 py-1 active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel={t('transfers.deleteTransfer', 'Delete Transfer')}
            >
              <Text className="text-xs font-medium text-red-500">
                {t('transfers.deleteTransfer', 'Delete Transfer')}
              </Text>
            </Pressable>
          )}
        </View>

        <QuickAddBusinessSheet
          open={quickAddBizOpen}
          onClose={() => setQuickAddBizOpen(false)}
          onCreated={handleBizCreated}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
