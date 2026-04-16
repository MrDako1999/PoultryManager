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
import ExpensesListView from '@/modules/broiler/views/ExpensesListView';

const EXPENSE_CATEGORIES = [
  'MAINTENANCE', 'LABOUR', 'UTILITIES', 'FUEL', 'CONSUMABLES',
  'FOOD', 'RENT', 'ANIMAL_PROCESSING', 'ANIMAL_WELFARE',
  'FEED', 'SOURCE', 'ASSETS', 'OTHERS',
];

const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

export default function BatchExpensesView() {
  const { id, eid } = useParams();
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const fmt = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const allExpenses = useLocalQuery('expenses', { batch: id });
  const allBusinesses = useLocalQuery('businesses');

  const [search, setSearch] = usePersistedState(`batch-expenses-${id}-search`, '');
  const [dateRange, setDateRange] = usePersistedState(`batch-expenses-${id}-dateRange`, undefined, { dates: true });
  const [categoryFilter, setCategoryFilter] = usePersistedState(`batch-expenses-${id}-category`, []);
  const [invoiceFilter, setInvoiceFilter] = usePersistedState(`batch-expenses-${id}-invoice`, []);
  const [supplierFilter, setSupplierFilter] = usePersistedState(`batch-expenses-${id}-supplier`, []);

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

    return items;
  }, [allExpenses, search, dateRange, categoryFilter, invoiceFilter, supplierFilter]);

  const totalSpend = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.totalAmount || 0), 0),
    [filtered],
  );

  const hasFilters = !!(
    search || dateRange?.from || categoryFilter.length || invoiceFilter.length ||
    supplierFilter.length
  );

  const resetFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setCategoryFilter([]);
    setInvoiceFilter([]);
    setSupplierFilter([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t('batches.expensesTab', 'Expenses')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('batches.expensesFromBatch', 'Expenses recorded for this batch')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
            {t('common.resetFilters', 'Reset Filters')}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SearchableMultiSelect
            variant="dropdown"
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder={t('batches.expenseForm.category', 'Category')}
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={invoiceOptions}
            value={invoiceFilter}
            onChange={setInvoiceFilter}
            placeholder={t('batches.expenseForm.invoiceType', 'Invoice Type')}
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={supplierOptions}
            value={supplierFilter}
            onChange={setSupplierFilter}
            placeholder={t('batches.expenseForm.supplier', 'Supplier')}
          />

          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
          />
        </div>

        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            {t('common.showingFiltered', 'Showing {{count}} of {{total}}', { count: filtered.length, total: allExpenses.length })} {t('batches.expensesTab', 'expenses').toLowerCase()}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ExpensesListView
          items={filtered}
          selectedId={eid}
          basePath={`/dashboard/batches/${id}`}
          batchId={id}
          persistId={`batch-expenses-${id}`}
        />
      </div>
    </div>
  );
}
