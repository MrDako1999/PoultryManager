import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { Badge } from '@/components/ui/Badge';
import Separator from '@/components/ui/Separator';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';
import { fmt, fmtDate, Row, Section, TotalBar, DetailLoading, PartyCard, DocumentsSection } from '@/components/details/shared';

export default function FeedOrderDetail({ feedOrderId, onEdit }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [order] = useLocalRecord('feedOrders', feedOrderId);
  const accounting = useSettings('accounting');

  if (!order) return <DetailLoading />;

  const currency = accounting?.currency || 'AED';
  const items = order.items || [];
  const totalBags = items.reduce((sum, li) => sum + (li.bags || 0), 0);
  const hasVat = (order.vatAmount || 0) > 0;

  const docGroups = [
    { key: 'taxInvoice', label: t('batches.sourceDetail.taxInvoiceDoc', 'Tax Invoice'), docs: order.taxInvoiceDocs },
    { key: 'transfer', label: t('batches.sourceDetail.transferProof', 'Transfer Proof'), docs: order.transferProofs },
    { key: 'delivery', label: t('batches.sourceDetail.deliveryNoteDoc', 'Delivery Note'), docs: order.deliveryNoteDocs },
  ];

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0 gap-1.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge>
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {t('batches.feedOrderDetail.feedOrder')}
                </Text>
              </Badge>
              <Badge variant="secondary">
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                  {totalBags} {t('batches.bags')}
                </Text>
              </Badge>
            </View>
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {order.feedCompany?.companyName || '—'}
            </Text>
            <Text className="text-xs text-muted-foreground">{fmtDate(order.orderDate)}</Text>
          </View>
          <Pressable
            onPress={() => onEdit?.(order)}
            className="h-8 w-8 items-center justify-center rounded-md border border-border"
            hitSlop={8}
          >
            <Pencil size={16} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
      </View>

      <Separator />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4">
        {order.feedCompany?.companyName && (
          <Pressable onPress={() => {
            const companyId = typeof order.feedCompany === 'object' ? order.feedCompany._id : order.feedCompany;
            if (companyId) router.push(`/(app)/business/${companyId}`);
          }}>
            <PartyCard
              label={t('batches.feedCompany')}
              name={order.feedCompany.companyName}
              onPress
            />
          </Pressable>
        )}

        {items.length > 0 && (
          <Section>
            <View className="flex-row bg-primary px-3 py-1.5">
              <Text className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.feedOrderDetail.product')}
              </Text>
              <Text className="w-12 text-right text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.bags')}
              </Text>
              <Text className="w-16 text-right text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.feedOrderDetail.price')}
              </Text>
              <Text className="w-[74px] text-right text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.feedOrderDetail.amount')}
              </Text>
            </View>
            {items.map((item, i) => {
              const desc = item.feedDescription || item.feedItem?.feedDescription || t(`feed.feedTypes.${item.feedType}`);
              const size = item.quantitySize && item.quantityUnit ? `${item.quantitySize}${item.quantityUnit}` : '';
              return (
                <View
                  key={item._id || i}
                  className={`flex-row px-3 py-1.5 border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                >
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm text-foreground" numberOfLines={1}>{desc}</Text>
                    {size ? <Text className="text-xs text-muted-foreground">{size}</Text> : null}
                  </View>
                  <Text className="w-12 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                    {(item.bags || 0).toLocaleString()}
                  </Text>
                  <Text className="w-16 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                    {fmt(item.pricePerBag)}
                  </Text>
                  <Text className="w-[74px] text-right text-sm font-medium text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                    {fmt(item.subtotal)}
                  </Text>
                </View>
              );
            })}
          </Section>
        )}

        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            <Row label={t('batches.subtotal')} value={`${currency} ${fmt(order.subtotal)}`} bold />
            {(order.deliveryCharge || 0) > 0 && (
              <Row label={t('batches.deliveryCharge')} value={`${currency} ${fmt(order.deliveryCharge)}`} />
            )}
            {hasVat && <Row label={t('batches.vat')} value={`${currency} ${fmt(order.vatAmount)}`} />}
          </View>
          <TotalBar label={t('batches.grandTotal')} value={`${currency} ${fmt(order.grandTotal)}`} />
        </Section>

        {(order.orderDate || order.deliveryDate || order.taxInvoiceId) && (
          <Section>
            <View className="px-3 py-2.5 gap-0.5">
              {order.orderDate && <Row label={t('batches.orderDate')} value={fmtDate(order.orderDate)} />}
              {order.deliveryDate && <Row label={t('batches.deliveryDate')} value={fmtDate(order.deliveryDate)} />}
              {order.taxInvoiceId && <Row label={t('batches.taxInvoiceId')} value={order.taxInvoiceId} />}
            </View>
          </Section>
        )}

        <DocumentsSection docGroups={docGroups} t={t} />

        <Text className="text-xs text-muted-foreground text-center pt-1 pb-2">
          {t('batches.feedOrderDetail.createdAt')} {fmtDate(order.createdAt)} · {t('batches.feedOrderDetail.updatedAt')} {fmtDate(order.updatedAt)}
        </Text>
      </ScrollView>

      <View className="flex-row items-center justify-end pt-2 border-t border-border px-4" style={{ paddingBottom: Math.max(16, insets.bottom + 8) }}>
        <Pressable
          onPress={() => onEdit?.(order)}
          className="flex-row items-center rounded-lg bg-primary px-4 py-2.5"
        >
          <Pencil size={14} color="#fff" />
          <Text className="text-sm font-medium text-primary-foreground ml-2">{t('batches.editFeedOrder')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
