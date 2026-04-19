import { useState, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Wheat } from 'lucide-react-native';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import SheetInput, { SheetCurrencyInput } from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import Switch from '@/components/ui/Switch';
import FormSheet from '@/components/FormSheet';
import {
  FormSection, FormField, SummaryCard, SummaryRow, CardDivider,
} from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { useToast } from '@/components/ui/Toast';
import { FEED_TYPES, FEED_TYPE_ICONS } from '@/lib/constants';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';

const QUANTITY_UNITS = ['KG', 'LB', 'G', 'TON'];
const NUMERIC_LOCALE = 'en-US';

const parseNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const fmtMoney = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const feedItemSchema = z.object({
  feedCompany: z.string().min(1, 'Feed company is required'),
  feedDescription: z.string().min(1, 'Feed description is required'),
  feedType: z.enum(FEED_TYPES),
  pricePerQty: z.string().optional(),
  quantitySize: z.string().optional(),
  quantityUnit: z.enum(QUANTITY_UNITS).default('KG'),
  isActive: z.boolean().default(true),
});

const defaultValues = {
  feedCompany: '',
  feedDescription: '',
  feedType: 'STARTER',
  pricePerQty: '',
  quantitySize: '50',
  quantityUnit: 'KG',
  isActive: true,
};

export default function FeedItemSheet({
  open,
  onClose,
  editData = null,
  canDelete = false,
  onDelete,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const accounting = useSettings('accounting');

  const vatRate = accounting?.vatRate ?? 5;
  const currency = accounting?.currency || 'AED';

  const [businesses] = useLocalQuery('businesses');
  const { create, update } = useOfflineMutation('feedItems');
  const isEditing = !!editData?._id;

  const [saving, setSaving] = useState(false);
  const [bizSheetOpen, setBizSheetOpen] = useState(false);
  const [bizInitialName, setBizInitialName] = useState('');

  const {
    control, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm({
    resolver: zodResolver(feedItemSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    if (editData) {
      const companyId = typeof editData.feedCompany === 'object'
        ? editData.feedCompany?._id
        : editData.feedCompany;
      reset({
        feedCompany: companyId || '',
        feedDescription: editData.feedDescription || '',
        feedType: FEED_TYPES.includes(editData.feedType) ? editData.feedType : 'STARTER',
        pricePerQty: editData.pricePerQty
          ? Number(editData.pricePerQty).toLocaleString(NUMERIC_LOCALE, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '',
        quantitySize: editData.quantitySize ? String(editData.quantitySize) : '50',
        quantityUnit: QUANTITY_UNITS.includes(editData.quantityUnit) ? editData.quantityUnit : 'KG',
        isActive: editData.isActive !== false,
      });
    } else {
      reset(defaultValues);
    }
  }, [open, editData, reset]);

  const businessOptions = useMemo(() =>
    (businesses || []).map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    })),
    [businesses]
  );

  const feedTypeOptions = useMemo(
    () => FEED_TYPES.map((value) => {
      const Icon = FEED_TYPE_ICONS[value];
      return {
        value,
        label: t(`feed.feedTypes.${value}`, value),
        icon: Icon,
      };
    }),
    [t]
  );

  const unitOptions = useMemo(
    () => QUANTITY_UNITS.map((value) => ({
      value,
      label: t(`feed.quantityUnits.${value}`, value),
    })),
    [t]
  );

  const watchedPrice = watch('pricePerQty');
  const subtotal = parseNum(watchedPrice);
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount;

  const handleBizCreated = (newBiz) => {
    setValue('feedCompany', newBiz._id, { shouldDirty: true });
    setBizSheetOpen(false);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        feedCompany: data.feedCompany,
        feedDescription: data.feedDescription,
        feedType: data.feedType,
        pricePerQty: parseNum(data.pricePerQty),
        quantitySize: parseNum(data.quantitySize) || 50,
        quantityUnit: data.quantityUnit,
        isActive: data.isActive,
        subtotal,
        vatAmount,
        grandTotal,
      };

      if (isEditing) {
        await update(editData._id, payload);
        toast({ title: t('feed.feedItemUpdated', 'Feed item updated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload);
        toast({ title: t('feed.feedItemCreated', 'Feed item created') });
      }
      onClose();
    } catch (err) {
      console.error('[FeedItemSheet] save failed', err);
      toast({
        variant: 'destructive',
        title: isEditing
          ? t('feed.updateError', 'Failed to update feed item')
          : t('feed.createError', 'Failed to create feed item'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEditing
        ? t('feed.editFeedItem', 'Edit Feed Item')
        : t('feed.addFeedItem', 'Add Feed Item')
      }
      subtitle={isEditing
        ? t('feed.editFeedItemDesc', 'Update this feed item\'s details')
        : t('feed.addFeedItemDesc', 'Add a feed product to your catalogue')
      }
      icon={Wheat}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
      loading={saving}
      disabled={saving}
      deleteLabel={isEditing && canDelete && onDelete ? t('feed.deleteFeedItem', 'Delete Feed Item') : undefined}
      onDelete={isEditing && canDelete && onDelete
        ? () => { onClose(); onDelete(); }
        : undefined
      }
    >
      <FormSection title={t('feed.sourceSection', 'Source')}>
        <FormField label={t('feed.feedCompany', 'Feed Company')} required error={errors.feedCompany?.message}>
          <Controller
            control={control}
            name="feedCompany"
            render={({ field: { value, onChange } }) => (
              <Select
                value={value}
                onValueChange={onChange}
                options={businessOptions}
                placeholder={t('feed.selectCompany', 'Select feed company')}
                label={t('feed.feedCompany', 'Feed Company')}
                onCreateNew={(searchText) => {
                  setBizInitialName(searchText || '');
                  setBizSheetOpen(true);
                }}
                createNewLabel={t('feed.addNewCompany', 'Add new company')}
              />
            )}
          />
        </FormField>

        <FormField label={t('feed.feedDescription', 'Feed Description')} required error={errors.feedDescription?.message}>
          <Controller
            control={control}
            name="feedDescription"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('feed.feedDescriptionPlaceholder', 'e.g. AFYA - STARTER (Non Subsidized)')}
              />
            )}
          />
        </FormField>

        <FormField label={t('feed.feedType', 'Feed Type')} required error={errors.feedType?.message}>
          <Controller
            control={control}
            name="feedType"
            render={({ field: { value, onChange } }) => (
              <EnumButtonSelect
                value={value}
                onChange={onChange}
                options={feedTypeOptions}
                columns={4}
                compact
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection
        title={t('feed.pricingSection', 'Pricing')}
        description={t('feed.pricingHint', 'Subtotal, VAT, and total per unit are calculated automatically.')}
      >
        <FormField label={t('feed.pricePerQty', 'Price per Quantity')}>
          <Controller
            control={control}
            name="pricePerQty"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetCurrencyInput
                value={value}
                onChangeText={(v) => {
                  // Sanitize: only digits and one decimal point.
                  const raw = String(v ?? '').replace(/[^0-9.]/g, '');
                  const parts = raw.split('.');
                  const cleaned = parts.length > 2
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : raw;
                  onChange(cleaned);
                }}
                onBlur={onBlur}
                placeholder={t('feed.pricePerQtyPlaceholder', 'e.g. 80.00')}
                currency={currency}
              />
            )}
          />
        </FormField>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 2 }}>
            <FormField label={t('feed.quantitySize', 'Quantity Size')}>
              <Controller
                control={control}
                name="quantitySize"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={(v) => onChange(String(v ?? '').replace(/[^0-9]/g, ''))}
                    onBlur={onBlur}
                    placeholder={t('feed.quantitySizePlaceholder', 'e.g. 50')}
                    keyboardType="number-pad"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('feed.quantityUnit', 'Unit')}>
              <Controller
                control={control}
                name="quantityUnit"
                render={({ field: { value, onChange } }) => (
                  <Select
                    value={value}
                    onValueChange={onChange}
                    options={unitOptions}
                    placeholder={t('feed.quantityUnit', 'Unit')}
                    label={t('feed.quantityUnit', 'Unit')}
                    searchable={false}
                  />
                )}
              />
            </FormField>
          </View>
        </View>

        <SummaryCard>
          <SummaryRow
            label={t('feed.subtotal', 'Subtotal')}
            value={`${currency} ${fmtMoney(subtotal)}`}
          />
          <SummaryRow
            label={t('feed.vat', 'VAT') + ` (${vatRate}%)`}
            value={`${currency} ${fmtMoney(vatAmount)}`}
          />
          <CardDivider />
          <SummaryRow
            label={t('feed.totalPerUnit', 'Total per unit')}
            value={`${currency} ${fmtMoney(grandTotal)}`}
            emphasis
          />
        </SummaryCard>
      </FormSection>

      <FormSection title={t('feed.statusSection', 'Status')}>
        <Controller
          control={control}
          name="isActive"
          render={({ field: { value, onChange } }) => (
            <ActiveToggleRow
              value={value}
              onChange={onChange}
              tokens={tokens}
              isRTL={isRTL}
              t={t}
            />
          )}
        />
      </FormSection>

      <QuickAddBusinessSheet
        open={bizSheetOpen}
        onClose={() => setBizSheetOpen(false)}
        onCreated={handleBizCreated}
        initialName={bizInitialName}
      />
    </FormSheet>
  );
}

function ActiveToggleRow({ value, onChange, tokens, isRTL, t }) {
  const { textColor, mutedColor } = tokens;
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {t('feed.isActive', 'Active')}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
            lineHeight: 17,
          }}
        >
          {t('feed.isActiveHint', 'Inactive items are hidden from new feed orders.')}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
