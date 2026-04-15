import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Pencil, ChevronRight, Link2 } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import Separator from '../ui/Separator';
import useLocalRecord from '../../hooks/useLocalRecord';
import useSettings from '../../hooks/useSettings';
import { fmt, fmtDate, Row, Section, SectionHeader, TotalBar, DetailLoading, PartyCard, DocumentsSection } from './shared';

export default function ExpenseDetail({ expenseId, onEdit }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [expense] = useLocalRecord('expenses', expenseId);
  const accounting = useSettings('accounting');

  if (!expense) return <DetailLoading />;

  const currency = accounting?.currency || 'AED';
  const hasVat = (expense.taxableAmount || 0) > 0;
  const isLinked = !!(expense.source || expense.feedOrder || expense.saleOrder);

  const docGroups = [
    { key: 'receipts', label: t('batches.receipt', 'Receipt'), docs: expense.receipts },
    { key: 'transfer', label: t('batches.sourceDetail.transferProof', 'Transfer Proof'), docs: expense.transferProofs },
  ];
  const sourceId = typeof expense.source === 'object' ? expense.source?._id : expense.source;
  const feedOrderId = typeof expense.feedOrder === 'object' ? expense.feedOrder?._id : expense.feedOrder;
  const saleOrderId = typeof expense.saleOrder === 'object' ? expense.saleOrder?._id : expense.saleOrder;

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0 gap-1.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge>
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {t(`batches.expenseCategories.${expense.category}`)}
                </Text>
              </Badge>
              <Badge variant="secondary">
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                  {t(`batches.invoiceTypes.${expense.invoiceType}`)}
                </Text>
              </Badge>
            </View>
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {expense.description || t(`batches.expenseCategories.${expense.category}`)}
            </Text>
            <Text className="text-xs text-muted-foreground">{fmtDate(expense.expenseDate)}</Text>
          </View>
          {!isLinked && (
            <Pressable
              onPress={() => onEdit?.(expense)}
              className="h-8 w-8 items-center justify-center rounded-md border border-border"
              hitSlop={8}
            >
              <Pencil size={16} color="hsl(150, 10%, 45%)" />
            </Pressable>
          )}
        </View>
      </View>

      <Separator />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4">
        {expense.tradingCompany?.companyName && (
          <Pressable onPress={() => {
            const companyId = typeof expense.tradingCompany === 'object' ? expense.tradingCompany._id : expense.tradingCompany;
            if (companyId) router.push(`/(app)/business/${companyId}`);
          }}>
            <PartyCard
              label={t('batches.tradingCompany')}
              name={expense.tradingCompany.companyName}
              onPress
            />
          </Pressable>
        )}

        {expense.invoiceId && (
          <Section>
            <View className="px-3 py-2.5">
              <Row label={t('batches.invoiceIdLabel')} value={expense.invoiceId} />
            </View>
          </Section>
        )}

        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            <Row label={t('batches.grossAmount')} value={`${currency} ${fmt(expense.grossAmount)}`} bold />
            {hasVat && <Row label={t('batches.taxableAmount')} value={`${currency} ${fmt(expense.taxableAmount)}`} />}
          </View>
          <TotalBar label={t('batches.totalAmount')} value={`${currency} ${fmt(expense.totalAmount)}`} />
        </Section>

        {isLinked && (
          <Section>
            <SectionHeader icon={Link2}>{t('batches.expenseDetail.linkedEntity')}</SectionHeader>
            <View className="divide-y divide-border">
              {sourceId && (
                <Pressable
                  onPress={() => router.push(`/(app)/source/${sourceId}`)}
                  className="flex-row items-center justify-between px-3 py-2.5"
                >
                  <Text className="text-xs text-muted-foreground">{t('batches.linkedToSource')}</Text>
                  <ChevronRight size={14} color="hsl(150, 10%, 45%)" />
                </Pressable>
              )}
              {feedOrderId && (
                <Pressable
                  onPress={() => router.push(`/(app)/feed-order/${feedOrderId}`)}
                  className="flex-row items-center justify-between px-3 py-2.5"
                >
                  <Text className="text-xs text-muted-foreground">{t('batches.linkedToFeedOrder')}</Text>
                  <ChevronRight size={14} color="hsl(150, 10%, 45%)" />
                </Pressable>
              )}
              {saleOrderId && (
                <Pressable
                  onPress={() => router.push(`/(app)/sale/${saleOrderId}`)}
                  className="flex-row items-center justify-between px-3 py-2.5"
                >
                  <Text className="text-xs text-muted-foreground">{t('batches.linkedToSaleOrder')}</Text>
                  <ChevronRight size={14} color="hsl(150, 10%, 45%)" />
                </Pressable>
              )}
            </View>
          </Section>
        )}

        <Section>
          <View className="px-3 py-2.5">
            <Row label={t('batches.expenseDate')} value={fmtDate(expense.expenseDate)} />
          </View>
        </Section>

        {expense.description && (
          <View className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
            <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t('batches.expenseDescription')}
            </Text>
            <Text className="text-sm text-foreground">{expense.description}</Text>
          </View>
        )}

        <DocumentsSection docGroups={docGroups} t={t} />

        <Text className="text-xs text-muted-foreground text-center pt-1 pb-2">
          {t('batches.expenseDetail.createdAt')} {fmtDate(expense.createdAt)} · {t('batches.expenseDetail.updatedAt')} {fmtDate(expense.updatedAt)}
        </Text>
      </ScrollView>

      {!isLinked && (
        <View className="flex-row items-center justify-end pt-2 border-t border-border px-4" style={{ paddingBottom: Math.max(16, insets.bottom + 8) }}>
          <Pressable
            onPress={() => onEdit?.(expense)}
            className="flex-row items-center rounded-lg bg-primary px-4 py-2.5"
          >
            <Pencil size={14} color="#fff" />
            <Text className="text-sm font-medium text-primary-foreground ml-2">{t('batches.editExpense')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
