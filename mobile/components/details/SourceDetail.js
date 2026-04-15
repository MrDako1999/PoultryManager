import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import Separator from '../ui/Separator';
import useLocalRecord from '../../hooks/useLocalRecord';
import useSettings from '../../hooks/useSettings';
import { fmt, fmtDate, Row, Section, TotalBar, DetailLoading, PartyCard, DocumentsSection } from './shared';

export default function SourceDetail({ sourceId, onEdit }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [source] = useLocalRecord('sources', sourceId);
  const accounting = useSettings('accounting');

  if (!source) return <DetailLoading />;

  const currency = accounting?.currency || 'AED';
  const showVat = source.invoiceType === 'TAX_INVOICE';
  const focChicks = (source.totalChicks || 0) - (source.quantityPurchased || 0);

  const docGroups = [
    { key: 'taxInvoice', label: t('batches.sourceDetail.taxInvoiceDoc', 'Tax Invoice'), docs: source.taxInvoiceDocs },
    { key: 'transfer', label: t('batches.sourceDetail.transferProof', 'Transfer Proof'), docs: source.transferProofs },
    { key: 'delivery', label: t('batches.sourceDetail.deliveryNoteDoc', 'Delivery Note'), docs: source.deliveryNoteDocs },
    { key: 'other', label: t('common.document', 'Document'), docs: source.otherDocs },
  ];

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0 gap-1.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge>
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {t(`batches.invoiceTypes.${source.invoiceType}`)}
                </Text>
              </Badge>
              {source.focPercentage > 0 && (
                <Badge variant="secondary">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                    {source.focPercentage}% FOC
                  </Text>
                </Badge>
              )}
            </View>
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {source.taxInvoiceId || '—'}
            </Text>
            <Text className="text-xs text-muted-foreground">{fmtDate(source.deliveryDate)}</Text>
          </View>
          <Pressable
            onPress={() => onEdit?.(source)}
            className="h-8 w-8 items-center justify-center rounded-md border border-border"
            hitSlop={8}
          >
            <Pencil size={16} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
      </View>

      <Separator />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4">
        {source.sourceFrom?.companyName && (
          <Pressable onPress={() => {
            const supplierId = typeof source.sourceFrom === 'object' ? source.sourceFrom._id : source.sourceFrom;
            if (supplierId) router.push(`/(app)/business/${supplierId}`);
          }}>
            <PartyCard
              label={t('batches.sourceDetail.sourceFrom')}
              name={source.sourceFrom.companyName}
              onPress
            />
          </Pressable>
        )}

        <Section>
          <View className="flex-row items-center gap-2 px-3 py-2 bg-muted/50">
            <Text className="text-sm font-medium text-foreground">
              {t('batches.sourceDetail.purchaseBreakdown')}
            </Text>
          </View>
          <View className="px-3 py-2.5 gap-0.5">
            <Row label={t('batches.quantityPurchased')} value={(source.quantityPurchased || 0).toLocaleString()} />
            <Row label={t('batches.sourceDetail.ratePerChick')} value={`${currency} ${fmt(source.chicksRate)}`} />
            {source.focPercentage > 0 && (
              <Row
                label={t('batches.sourceDetail.focBonus')}
                value={`+${focChicks.toLocaleString()} (${source.focPercentage}%)`}
                highlight
              />
            )}
            <Separator className="my-1" />
            <Row label={t('batches.totalChicksField')} value={(source.totalChicks || 0).toLocaleString()} bold />
          </View>
        </Section>

        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            <Row label={t('batches.subtotal')} value={`${currency} ${fmt(source.subtotal)}`} bold />
            {showVat && <Row label={t('batches.vat')} value={`${currency} ${fmt(source.vatAmount)}`} />}
          </View>
          <TotalBar label={t('batches.grandTotal')} value={`${currency} ${fmt(source.grandTotal)}`} />
        </Section>

        {(source.invoiceDate || source.deliveryDate) && (
          <Section>
            <View className="px-3 py-2.5 gap-0.5">
              {source.invoiceDate && <Row label={t('batches.invoiceDate')} value={fmtDate(source.invoiceDate)} />}
              {source.deliveryDate && <Row label={t('batches.deliveryDate')} value={fmtDate(source.deliveryDate)} />}
            </View>
          </Section>
        )}

        <DocumentsSection docGroups={docGroups} t={t} />

        <Text className="text-xs text-muted-foreground text-center pt-1 pb-2">
          {t('batches.sourceDetail.createdAt')} {fmtDate(source.createdAt)} · {t('batches.sourceDetail.updatedAt')} {fmtDate(source.updatedAt)}
        </Text>
      </ScrollView>

      <View className="flex-row items-center justify-end pt-2 border-t border-border px-4" style={{ paddingBottom: Math.max(16, insets.bottom + 8) }}>
        <Pressable
          onPress={() => onEdit?.(source)}
          className="flex-row items-center rounded-lg bg-primary px-4 py-2.5"
        >
          <Pencil size={14} color="#fff" />
          <Text className="text-sm font-medium text-primary-foreground ml-2">{t('batches.editSource')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
