import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart, Tag, FileText, Building2, Layers, Bird,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SalesListView from '@/components/views/SalesListView';
import {
  AccountingHero, AccountingToolbar,
} from '@/components/views/AccountingFilterBar';

const SALE_METHODS = ['SLAUGHTERED', 'LIVE_BY_PIECE', 'LIVE_BY_WEIGHT'];
const INVOICE_TYPES = ['VAT_INVOICE', 'CASH_MEMO'];

const fmtInt = (val) => Number(val || 0).toLocaleString('en-US');

export default function BroilerSalesView() {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [allSales, salesLoading] = useLocalQuery('saleOrders');
  const [allBatches] = useLocalQuery('batches');
  const [allBusinesses] = useLocalQuery('businesses');

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [methodFilter, setMethodFilter] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState([]);
  const [customerFilter, setCustomerFilter] = useState([]);
  const [batchFilter, setBatchFilter] = useState([]);

  const batchMap = useMemo(() => {
    const m = {};
    allBatches.forEach((b) => { m[b._id] = b; });
    return m;
  }, [allBatches]);

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

  // Customer/batch options derived only from sales we have, so the filter
  // doesn't show empty options the user can't possibly need.
  const customerOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allSales.forEach((s) => {
      const cid = (typeof s.customer === 'object' ? s.customer?._id : s.customer);
      if (!cid || seen.has(cid)) return;
      seen.add(cid);
      const inline = typeof s.customer === 'object' ? s.customer?.companyName : null;
      const biz = businessMap[cid];
      opts.push({ value: cid, label: inline || biz?.companyName || cid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allSales, businessMap]);

  const batchOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allSales.forEach((s) => {
      const bid = (typeof s.batch === 'object' ? s.batch?._id : s.batch);
      if (!bid || seen.has(bid)) return;
      seen.add(bid);
      const batch = batchMap[bid];
      opts.push({ value: bid, label: batch?.batchName || bid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allSales, batchMap]);

  const filtered = useMemo(() => {
    let items = allSales;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        (s.saleNumber || '').toLowerCase().includes(q)
        || (s.customer?.companyName || '').toLowerCase().includes(q)
        || (s.notes || '').toLowerCase().includes(q)
      );
    }

    // ISO date string compare — timezone-safe regardless of host. saleDate
    // is stored as YYYY-MM-DD (see SaleOrderSheet); slicing the first 10
    // chars also covers full ISO timestamps from imported records.
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
    if (customerFilter.length) {
      items = items.filter((s) => {
        const cid = (typeof s.customer === 'object' ? s.customer?._id : s.customer);
        return customerFilter.includes(cid);
      });
    }
    if (batchFilter.length) {
      items = items.filter((s) => {
        const bid = (typeof s.batch === 'object' ? s.batch?._id : s.batch);
        return batchFilter.includes(bid);
      });
    }
    return items;
  }, [allSales, search, dateRange, methodFilter, invoiceFilter, customerFilter, batchFilter]);

  const totalRevenue = useMemo(
    () => filtered.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0),
    [filtered]
  );

  // Mirror SaleRow's per-row chicken count logic (slaughtered → chickensSent,
  // live → birdCount) so the hero matches what the user sees on each card.
  const totalBirds = useMemo(
    () => filtered.reduce((sum, s) => {
      const birds = s.saleMethod === 'SLAUGHTERED'
        ? (s.counts?.chickensSent || 0)
        : (s.live?.birdCount || 0);
      return sum + birds;
    }, 0),
    [filtered]
  );

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
    {
      key: 'batch',
      label: t('nav.batches', 'Batch'),
      icon: Layers,
      options: batchOptions,
      values: batchFilter,
      onChange: setBatchFilter,
    },
  ]), [
    t,
    methodOptions, methodFilter,
    invoiceOptions, invoiceFilter,
    customerOptions, customerFilter,
    batchOptions, batchFilter,
  ]);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setMethodFilter([]);
    setInvoiceFilter([]);
    setCustomerFilter([]);
    setBatchFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <SalesListView
        sales={filtered}
        loading={salesLoading}
        hideHero
        hideSearch
        emptyTitle={t('batches.noSales', 'No sales')}
        headerComponent={(
          <AccountingHero
            HeaderIcon={ShoppingCart}
            heroTitle={t('batches.totalRevenue', 'Total Revenue')}
            count={filtered.length}
            total={totalRevenue}
            allCount={allSales.length}
            search={search}
            filters={filters}
            dateRange={dateRange}
            loading={salesLoading}
            extraStats={[
              {
                icon: Bird,
                label: t('batches.birdsSold', 'Birds Sold'),
                value: fmtInt(totalBirds),
              },
            ]}
          />
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
