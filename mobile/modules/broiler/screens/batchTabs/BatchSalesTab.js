import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Tag, FileText, Building2, Calendar, Receipt, Bird,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
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

export default function BatchSalesTab({ batchId }) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [saleOrders, loading] = useLocalQuery('saleOrders', { batch: batchId });
  const [allBusinesses] = useLocalQuery('businesses');

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [methodFilter, setMethodFilter] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState([]);
  const [customerFilter, setCustomerFilter] = useState([]);

  const businessMap = useMemo(() => {
    const m = {};
    allBusinesses.forEach((b) => { m[b._id] = b; });
    return m;
  }, [allBusinesses]);

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

  const customerOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    saleOrders.forEach((s) => {
      const cid = (typeof s.customer === 'object' ? s.customer?._id : s.customer);
      if (!cid || seen.has(cid)) return;
      seen.add(cid);
      const inline = typeof s.customer === 'object' ? s.customer?.companyName : null;
      const biz = businessMap[cid];
      opts.push({ value: cid, label: inline || biz?.companyName || cid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [saleOrders, businessMap]);

  const filtered = useMemo(() => {
    let items = saleOrders;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        (s.saleNumber || '').toLowerCase().includes(q)
        || (s.customer?.companyName || '').toLowerCase().includes(q)
        || (s.notes || '').toLowerCase().includes(q)
      );
    }

    // Date range filter — ISO date string compare (lexicographic) so the
    // filter behaves identically regardless of host timezone. saleDate is
    // stored as YYYY-MM-DD (see SaleOrderSheet) and DateRangePicker emits
    // YYYY-MM-DD endpoints; slicing the first 10 chars covers both plain
    // dates and full ISO timestamps that some imported sales might carry.
    if (dateRange?.from || dateRange?.to) {
      const fromIso = dateRange.from;
      // Single-day range when the user only picked one endpoint.
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
    if (customerFilter.length) {
      items = items.filter((s) => {
        const cid = (typeof s.customer === 'object' ? s.customer?._id : s.customer);
        return customerFilter.includes(cid);
      });
    }

    return items;
  }, [saleOrders, search, dateRange, methodFilter, invoiceFilter, customerFilter]);

  const heroStats = useMemo(() => {
    const total = filtered.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0);
    // Mirror SaleRow's per-row chicken count logic so the hero matches the
    // numbers shown on each card: slaughtered sales use chickensSent,
    // live sales use birdCount.
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
    {
      key: 'customer',
      label: t('accounting.customer', 'Customer'),
      icon: Building2,
      options: customerOptions,
      values: customerFilter,
      onChange: setCustomerFilter,
    },
  ]), [
    t,
    methodOptions, methodFilter,
    invoiceOptions, invoiceFilter,
    customerOptions, customerFilter,
  ]);

  const lastDateLabel = fmtRelativeDate(heroStats.lastDate);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setMethodFilter([]);
    setInvoiceFilter([]);
    setCustomerFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <SalesListView
        sales={filtered}
        loading={loading}
        hideHero
        hideSearch
        emptyTitle={t('batches.noSales', 'No sales')}
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
  // Top breathing room for the KPI hero so the eyebrow text isn't
  // visually clipped against the tabs bar above. SalesListView uses
  // paddingTop:0 when external chrome is provided so the hero owns its
  // own top spacing — same recipe as AccountingHero's heroWrap.
  heroWrap: {
    paddingTop: 16,
  },
});
