import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Tag, FileText, Calendar, Receipt, Bird,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SalesListView from '@/components/views/SalesListView';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';
import { AccountingToolbar } from '@/components/views/AccountingFilterBar';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtRelativeDate = (val) => {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const days = Math.floor((today - d) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(NUMERIC_LOCALE, { day: '2-digit', month: 'short' });
};

const SALE_METHODS = ['SLAUGHTERED', 'LIVE_BY_PIECE', 'LIVE_BY_WEIGHT'];
const INVOICE_TYPES = ['VAT_INVOICE', 'CASH_MEMO'];

/**
 * Sales tab inside the Business Detail pager. Mirrors BatchSalesTab's
 * recipe — KPI hero (Total Revenue / Birds Sold / Entries / Last Entry)
 * + sticky AccountingToolbar (search / date range / method / invoice
 * filters) + grouped list. The customer filter is omitted because the
 * customer is fixed: it's THIS business.
 */
export default function BusinessSalesTab({ sales, loading }) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [methodFilter, setMethodFilter] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState([]);

  const methodOptions = useMemo(
    () => SALE_METHODS.map((m) => ({
      value: m,
      label: t(`batches.saleMethods.${m}`, m),
    })),
    [t]
  );

  const invoiceOptions = useMemo(
    () => INVOICE_TYPES.map((it) => ({
      value: it,
      label: t(`batches.saleInvoiceTypes.${it}`, it),
    })),
    [t]
  );

  const filtered = useMemo(() => {
    let items = sales;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        (s.saleNumber || '').toLowerCase().includes(q)
        || (s.customer?.companyName || '').toLowerCase().includes(q)
        || (s.notes || '').toLowerCase().includes(q)
      );
    }

    // ISO date string compare — see BatchSalesTab for rationale.
    if (dateRange?.from || dateRange?.to) {
      const fromIso = dateRange.from;
      const toIso = dateRange.to || dateRange.from;
      items = items.filter((s) => {
        if (!s.saleDate) return false;
        const sIso = String(s.saleDate).slice(0, 10);
        if (fromIso && sIso < fromIso) return false;
        if (toIso && sIso > toIso) return false;
        return true;
      });
    }

    if (methodFilter.length) {
      items = items.filter((s) => methodFilter.includes(s.saleMethod));
    }
    if (invoiceFilter.length) {
      items = items.filter((s) => invoiceFilter.includes(s.invoiceType));
    }

    return items;
  }, [sales, search, dateRange, methodFilter, invoiceFilter]);

  const heroStats = useMemo(() => {
    const total = filtered.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0);
    const totalBirds = filtered.reduce((sum, s) => {
      const birds = s.saleMethod === 'SLAUGHTERED'
        ? (s.counts?.chickensSent || 0)
        : (s.live?.birdCount || 0);
      return sum + birds;
    }, 0);
    const lastDate = filtered.reduce((max, s) => {
      if (!s.saleDate) return max;
      const d = new Date(s.saleDate);
      return !max || d > max ? d : max;
    }, null);
    return { total, totalBirds, count: filtered.length, lastDate };
  }, [filtered]);

  const filters = useMemo(() => ([
    {
      key: 'method',
      label: t('batches.saleForm.saleMethod', 'Sale Method'),
      icon: Tag,
      options: methodOptions,
      values: methodFilter,
      onChange: setMethodFilter,
    },
    {
      key: 'invoice',
      label: t('batches.saleForm.invoiceType', 'Invoice Type'),
      icon: FileText,
      options: invoiceOptions,
      values: invoiceFilter,
      onChange: setInvoiceFilter,
    },
  ]), [
    t,
    methodOptions, methodFilter,
    invoiceOptions, invoiceFilter,
  ]);

  const lastDateLabel = fmtRelativeDate(heroStats.lastDate);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setMethodFilter([]);
    setInvoiceFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <SalesListView
        sales={filtered}
        loading={loading}
        hideHero
        hideSearch
        emptyTitle={t('businesses.detail.noSales', 'No sales for this business')}
        headerComponent={(
          <View style={styles.heroWrap}>
            <ListViewHeroKpi
              title={t('batches.totalRevenue', 'Total Revenue')}
              icon={TrendingUp}
              headline={fmt(heroStats.total)}
              stats={[
                {
                  icon: Bird,
                  label: t('batches.birdsSold', 'Birds Sold'),
                  value: fmtInt(heroStats.totalBirds),
                },
                {
                  icon: Receipt,
                  label: t('batches.entries', 'Entries'),
                  value: fmtInt(heroStats.count),
                },
                {
                  icon: Calendar,
                  label: t('batches.lastEntry', 'Last Entry'),
                  value: lastDateLabel || '—',
                },
              ]}
            />
          </View>
        )}
        stickyToolbar={({ collapseButton }) => (
          <AccountingToolbar
            search={search}
            setSearch={setSearch}
            dateRange={dateRange}
            setDateRange={setDateRange}
            filters={filters}
            onResetAll={resetAll}
            searchTrailing={collapseButton}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    paddingTop: 16,
  },
});
