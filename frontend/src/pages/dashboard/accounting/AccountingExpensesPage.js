import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, RotateCcw, DollarSign } from 'lucide-react';

import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import usePersistedState from '@/hooks/usePersistedState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import ExpensesListView from '@/components/views/ExpensesListView';

const EXPENSE_CATEGORIES = [
  'MAINTENANCE', 'LABOUR', 'UTILITIES', 'FUEL', 'CONSUMABLES',
  'FOOD', 'RENT', 'ANIMAL_PROCESSING', 'ANIMAL_WELFARE',
  'FEED', 'SOURCE', 'ASSETS', 'OTHERS',
];

const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

export default function AccountingExpensesPage() {
  const { eid } = useParams();
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const fmt = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const allExpenses = useLocalQuery('expenses');
  const allBatches = useLocalQuery('batches');
  const allBusinesses = useLocalQuery('businesses');

  const [search, setSearch] = usePersistedState('acct-expenses-search', '');
  const [dateRange, setDateRange] = usePersistedState('acct-expenses-dateRange', undefined, { dates: true });
  const [categoryFilter, setCategoryFilter] = usePersistedState('acct-expenses-category', []);
  const [invoiceFilter, setInvoiceFilter] = usePersistedState('acct-expenses-invoice', []);
  const [supplierFilter, setSupplierFilter] = usePersistedState('acct-expenses-supplier', []);
  const [batchFilter, setBatchFilter] = usePersistedState('acct-expenses-batch', []);

  const batchMap = useMemo(() => {
    const m = {};
    allBatches.forEach((b) => { m[b._id] = b; });
    return m;
  }, [allBatches]);

  const categoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((c) => ({
      value: c,
      label: t(`batches.expenseCategories.${c}`, c),
    })),
    [t],
  );

  const invoiceOptions = useMemo(
    () => INVOICE_TYPES.map((it) => ({
      value: it,
      label: t(`batches.expenseInvoiceTypes.${it}`, it),
    })),
    [t],
  );

  const supplierOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allExpenses.forEach((e) => {
      const sid = e.tradingCompany?._id || e.tradingCompany;
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      const biz = allBusinesses.find((b) => b._id === sid);
      opts.push({
        value: sid,
        label: e.tradingCompany?.companyName || biz?.companyName || sid,
      });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allExpenses, allBusinesses]);

  const batchOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allExpenses.forEach((e) => {
      if (!e.batch || seen.has(e.batch)) return;
      seen.add(e.batch);
      const batch = batchMap[e.batch];
      opts.push({
        value: e.batch,
        label: batch?.batchName || e.batch,
      });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allExpenses, batchMap]);

  const filtered = useMemo(() => {
    let items = allExpenses;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.invoiceId || '').toLowerCase().includes(q) ||
        (e.tradingCompany?.companyName || '').toLowerCase().includes(q),
      );
    }

    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
      items = items.filter((e) => {
        if (!e.expenseDate) return false;
        const d = new Date(e.expenseDate);
        return d >= from && d <= to;
      });
    }

    if (categoryFilter.length > 0) {
      items = items.filter((e) => categoryFilter.includes(e.category));
    }

    if (invoiceFilter.length > 0) {
      items = items.filter((e) => invoiceFilter.includes(e.invoiceType));
    }

    if (supplierFilter.length > 0) {
      items = items.filter((e) => {
        const sid = e.tradingCompany?._id || e.tradingCompany;
        return supplierFilter.includes(sid);
      });
    }

    if (batchFilter.length > 0) {
      items = items.filter((e) => batchFilter.includes(e.batch));
    }

    return items;
  }, [allExpenses, search, dateRange, categoryFilter, invoiceFilter, supplierFilter, batchFilter]);

  const totalSpend = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.totalAmount || 0), 0),
    [filtered],
  );

  const hasFilters = !!(
    search || dateRange?.from || categoryFilter.length || invoiceFilter.length ||
    supplierFilter.length || batchFilter.length
  );

  const resetFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setCategoryFilter([]);
    setInvoiceFilter([]);
    setSupplierFilter([]);
    setBatchFilter([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t('batches.expensesTab', 'Expenses')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('batches.expensesDesc', 'All expenses across batches')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalExpenses', 'Total Expenses')}</p>
                <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalSpend', 'Total Spend')}</p>
                <p className="text-sm font-semibold tabular-nums">{currency} {fmt(totalSpend)}</p>
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
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder={t('batches.expenseForm.category', 'Category')}
            className="flex-1 min-w-0"
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={invoiceOptions}
            value={invoiceFilter}
            onChange={setInvoiceFilter}
            placeholder={t('batches.expenseForm.invoiceType', 'Invoice Type')}
            className="flex-1 min-w-0"
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={supplierOptions}
            value={supplierFilter}
            onChange={setSupplierFilter}
            placeholder={t('batches.expenseForm.supplier', 'Supplier')}
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
            Showing {filtered.length} of {allExpenses.length} {t('batches.expensesTab', 'expenses').toLowerCase()}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ExpensesListView
          items={filtered}
          selectedId={eid}
          basePath="/dashboard/accounting"
          persistId="acct-expenses"
        />
      </div>
    </div>
  );
}
