import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, ShoppingCart, DollarSign, Wheat, Egg } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import StatCard from '@/components/ui/StatCard';
import Separator from '@/components/ui/Separator';
import CollapsibleSection from '@/components/CollapsibleSection';
import SaleRow from '@/modules/broiler/rows/SaleRow';
import ExpenseRow from '@/modules/broiler/rows/ExpenseRow';
import SourceRow from '@/modules/broiler/rows/SourceRow';
import { Section, Row, fmtDate, fmt } from '@/components/details/shared';
import { SkeletonDetailPage } from '@/components/skeletons';

export default function BusinessScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const [biz, bizLoading] = useLocalRecord('businesses', id);
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [allSales] = useLocalQuery('saleOrders');
  const [allExpenses] = useLocalQuery('expenses');
  const [allSources] = useLocalQuery('sources');
  const [allTransfers] = useLocalQuery('transfers');

  const relatedSales = useMemo(() =>
    allSales.filter((s) => {
      const custId = typeof s.customer === 'object' ? s.customer?._id : s.customer;
      return custId === id;
    }), [allSales, id]);

  const relatedExpenses = useMemo(() =>
    allExpenses.filter((e) => {
      const compId = typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany;
      return compId === id;
    }), [allExpenses, id]);

  const relatedSources = useMemo(() =>
    allSources.filter((s) => {
      const fromId = typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom;
      return fromId === id;
    }), [allSources, id]);

  const relatedTransfers = useMemo(() =>
    allTransfers.filter((tr) => {
      const bizId = typeof tr.business === 'object' ? tr.business?._id : tr.business;
      return bizId === id;
    }), [allTransfers, id]);

  const totalSales = useMemo(() => relatedSales.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0), [relatedSales]);
  const totalExpenses = useMemo(() => relatedExpenses.reduce((s, e) => s + (e.totalAmount || 0), 0), [relatedExpenses]);
  const totalTransfers = useMemo(() => relatedTransfers.reduce((s, tr) => s + (tr.amount || 0), 0), [relatedTransfers]);

  if (bizLoading || !biz) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 pt-2 pb-1 flex-row items-center">
          <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
            <ArrowLeft size={20} color={iconColor} />
          </Pressable>
        </View>
        <SkeletonDetailPage />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-bold text-foreground" numberOfLines={1}>{biz.companyName}</Text>
          {biz.businessType && <Text className="text-xs text-muted-foreground">{biz.businessType}</Text>}
        </View>
      </View>

      <Separator className="mt-2" />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="flex-row gap-2">
          <StatCard label={t('businesses.detail.totalSales')} value={`${currency} ${fmt(totalSales)}`} icon={ShoppingCart} />
          <StatCard label={t('businesses.detail.totalExpenses')} value={`${currency} ${fmt(totalExpenses)}`} icon={DollarSign} />
        </View>

        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            {biz.tradeLicenseNumber && <Row label={t('businesses.tradeLicenseNumber')} value={biz.tradeLicenseNumber} />}
            {biz.trnNumber && <Row label={t('businesses.trnNumber')} value={biz.trnNumber} />}
          </View>
        </Section>

        {relatedSales.length > 0 && (
          <CollapsibleSection
            title={t('businesses.detail.relatedSales')}
            icon={ShoppingCart}
            headerExtra={<Text className="text-[10px] text-muted-foreground font-semibold">{relatedSales.length}</Text>}
            items={relatedSales}
            renderItem={(sale) => (
              <SaleRow key={sale._id} sale={sale} onClick={() => router.push(`/(app)/sale/${sale._id}`)} />
            )}
          />
        )}

        {relatedExpenses.length > 0 && (
          <CollapsibleSection
            title={t('businesses.detail.relatedExpenses')}
            icon={DollarSign}
            headerExtra={<Text className="text-[10px] text-muted-foreground font-semibold">{relatedExpenses.length}</Text>}
            items={relatedExpenses}
            renderItem={(expense) => (
              <ExpenseRow
                key={expense._id}
                expense={expense}
                categoryLabel={t(`batches.expenseCategories.${expense.category}`, expense.category)}
                onClick={() => router.push(`/(app)/expense/${expense._id}`)}
              />
            )}
          />
        )}

        {relatedSources.length > 0 && (
          <CollapsibleSection
            title={t('businesses.detail.relatedSourceOrders')}
            icon={Egg}
            headerExtra={<Text className="text-[10px] text-muted-foreground font-semibold">{relatedSources.length}</Text>}
            items={relatedSources}
            renderItem={(source) => (
              <SourceRow key={source._id} source={source} onClick={() => router.push(`/(app)/source/${source._id}`)} />
            )}
          />
        )}

        <Text className="text-xs text-muted-foreground text-center pt-2">
          Created {fmtDate(biz.createdAt)}
        </Text>
      </ScrollView>
    </View>
  );
}
