import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, RotateCcw, ShoppingCart } from 'lucide-react';

import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import usePersistedState from '@/hooks/usePersistedState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import SalesListView from '@/modules/broiler/views/SalesListView';

const SALE_METHODS = ['SLAUGHTERED', 'LIVE_BY_PIECE', 'LIVE_BY_WEIGHT'];
const INVOICE_TYPES = ['VAT_INVOICE', 'CASH_MEMO'];

export default function AccountingSalesPage() {
  const { saleId } = useParams();
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const fmt = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const allSales = useLocalQuery('saleOrders');
  const allBatches = useLocalQuery('batches');
  const allBusinesses = useLocalQuery('businesses');

  const [search, setSearch] = usePersistedState('acct-sales-search', '');
  const [dateRange, setDateRange] = usePersistedState('acct-sales-dateRange', undefined, { dates: true });
  const [methodFilter, setMethodFilter] = usePersistedState('acct-sales-method', []);
  const [invoiceFilter, setInvoiceFilter] = usePersistedState('acct-sales-invoice', []);
  const [customerFilter, setCustomerFilter] = usePersistedState('acct-sales-customer', []);
  const [batchFilter, setBatchFilter] = usePersistedState('acct-sales-batch', []);

  const batchMap = useMemo(() => {
    const m = {};
    allBatches.forEach((b) => { m[b._id] = b; });
    return m;
  }, [allBatches]);

  const methodOptions = useMemo(
    () => SALE_METHODS.map((m) => ({
      value: m,
      label: t(`batches.saleMethods.${m}`, m),
    })),
    [t],
  );

  const invoiceOptions = useMemo(
    () => INVOICE_TYPES.map((it) => ({
      value: it,
      label: t(`batches.saleInvoiceTypes.${it}`, it),
    })),
    [t],
  );

  const customerOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allSales.forEach((s) => {
      const cid = s.customer?._id || s.customer;
      if (!cid || seen.has(cid)) return;
      seen.add(cid);
      const biz = allBusinesses.find((b) => b._id === cid);
      opts.push({
        value: cid,
        label: s.customer?.companyName || biz?.companyName || cid,
      });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allSales, allBusinesses]);

  const batchOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allSales.forEach((s) => {
      if (!s.batch || seen.has(s.batch)) return;
      seen.add(s.batch);
      const batch = batchMap[s.batch];
      opts.push({
        value: s.batch,
        label: batch?.batchName || s.batch,
      });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allSales, batchMap]);

  const filtered = useMemo(() => {
    let items = allSales;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        (s.saleNumber || '').toLowerCase().includes(q) ||
        (s.customer?.companyName || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q),
      );
    }

    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
      items = items.filter((s) => {
        if (!s.saleDate) return false;
        const d = new Date(s.saleDate);
        return d >= from && d <= to;
      });
    }

    if (methodFilter.length > 0) {
      items = items.filter((s) => methodFilter.includes(s.saleMethod));
    }

    if (invoiceFilter.length > 0) {
      items = items.filter((s) => invoiceFilter.includes(s.invoiceType));
    }

    if (customerFilter.length > 0) {
      items = items.filter((s) => {
        const cid = s.customer?._id || s.customer;
        return customerFilter.includes(cid);
      });
    }

    if (batchFilter.length > 0) {
      items = items.filter((s) => batchFilter.includes(s.batch));
    }

    return items;
  }, [allSales, search, dateRange, methodFilter, invoiceFilter, customerFilter, batchFilter]);

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, s) => sum + (s.totals?.grandTotal || 0), 0),
    [filtered],
  );

  const hasFilters = !!(
    search || dateRange?.from || methodFilter.length || invoiceFilter.length ||
    customerFilter.length || batchFilter.length
  );

  const resetFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setMethodFilter([]);
    setInvoiceFilter([]);
    setCustomerFilter([]);
    setBatchFilter([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with KPIs */}
      <div className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t('batches.salesTab', 'Sales')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('batches.salesDesc', 'All sale orders across batches')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalSales', 'Total Sales')}</p>
                <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalRevenue', 'Total Revenue')}</p>
                <p className="text-sm font-semibold tabular-nums">{currency} {fmt(totalRevenue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search bar + Reset */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search', 'Search...')}
              className="pl-8 h-9 bg-white dark:bg-card"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs shrink-0"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2">
          <SearchableMultiSelect
            variant="dropdown"
            options={methodOptions}
            value={methodFilter}
            onChange={setMethodFilter}
            placeholder={t('batches.saleForm.saleMethod', 'Sale Method')}
            className="flex-1 min-w-0"
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={invoiceOptions}
            value={invoiceFilter}
            onChange={setInvoiceFilter}
            placeholder={t('batches.saleForm.invoiceType', 'Invoice Type')}
            className="flex-1 min-w-0"
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={customerOptions}
            value={customerFilter}
            onChange={setCustomerFilter}
            placeholder={t('directory.businesses', 'Customer')}
            className="flex-1 min-w-0"
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={batchOptions}
            value={batchFilter}
            onChange={setBatchFilter}
            placeholder={t('nav.batches', 'Batch')}
            className="flex-1 min-w-0"
          />

          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            className="flex-1 min-w-0"
          />
        </div>

        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {allSales.length} {t('batches.salesTab', 'sales').toLowerCase()}
          </p>
        )}
      </div>

      {/* Main content: SalesListView */}
      <div className="flex-1 min-h-0">
        <SalesListView
          items={filtered}
          selectedId={saleId}
          basePath="/dashboard/accounting"
          persistId="acct-sales"
        />
      </div>
    </div>
  );
}
