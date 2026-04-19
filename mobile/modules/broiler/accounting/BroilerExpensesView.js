import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Receipt, FolderTree, FileText, Building2, Layers,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import ExpensesListView from '@/components/views/ExpensesListView';
import {
  AccountingHero, AccountingToolbar,
} from '@/components/views/AccountingFilterBar';

const EXPENSE_CATEGORIES = [
  'MAINTENANCE', 'LABOUR', 'UTILITIES', 'FUEL', 'CONSUMABLES',
  'FOOD', 'RENT', 'ANIMAL_PROCESSING', 'ANIMAL_WELFARE',
  'FEED', 'SOURCE', 'ASSETS', 'OTHERS',
];

const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

export default function BroilerExpensesView() {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [allExpenses, expensesLoading] = useLocalQuery('expenses');
  const [allBatches] = useLocalQuery('batches');
  const [allBusinesses] = useLocalQuery('businesses');

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState([]);
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

  const categoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((c) => ({
      value: c,
      label: t(`batches.expenseCategories.${c}`, c),
    })),
    [t]
  );

  const invoiceOptions = useMemo(
    () => INVOICE_TYPES.map((it) => ({
      value: it,
      label: t(`batches.expenseInvoiceTypes.${it}`, it),
    })),
    [t]
  );

  const supplierOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allExpenses.forEach((e) => {
      const sid = (typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany);
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      const inline = typeof e.tradingCompany === 'object' ? e.tradingCompany?.companyName : null;
      const biz = businessMap[sid];
      opts.push({ value: sid, label: inline || biz?.companyName || sid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allExpenses, businessMap]);

  const batchOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allExpenses.forEach((e) => {
      const bid = (typeof e.batch === 'object' ? e.batch?._id : e.batch);
      if (!bid || seen.has(bid)) return;
      seen.add(bid);
      const batch = batchMap[bid];
      opts.push({ value: bid, label: batch?.batchName || bid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allExpenses, batchMap]);

  const filtered = useMemo(() => {
    let items = allExpenses;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) =>
        (e.description || '').toLowerCase().includes(q)
        || (e.invoiceId || '').toLowerCase().includes(q)
        || (e.tradingCompany?.companyName || '').toLowerCase().includes(q)
      );
    }

    // ISO date string compare — timezone-safe regardless of host. expenseDate
    // is stored as YYYY-MM-DD; slicing the first 10 chars also covers full
    // ISO timestamps from imported records.
    if (dateRange?.from || dateRange?.to) {
      const fromIso = dateRange.from;
      const toIso = dateRange.to || dateRange.from;
      items = items.filter((e) => {
        if (!e.expenseDate) return false;
        const sIso = String(e.expenseDate).slice(0, 10);
        if (fromIso && sIso < fromIso) return false;
        if (toIso && sIso > toIso) return false;
        return true;
      });
    }

    if (categoryFilter.length) {
      items = items.filter((e) => categoryFilter.includes(e.category || 'OTHERS'));
    }
    if (invoiceFilter.length) {
      items = items.filter((e) => invoiceFilter.includes(e.invoiceType));
    }
    if (supplierFilter.length) {
      items = items.filter((e) => {
        const sid = (typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany);
        return supplierFilter.includes(sid);
      });
    }
    if (batchFilter.length) {
      items = items.filter((e) => {
        const bid = (typeof e.batch === 'object' ? e.batch?._id : e.batch);
        return batchFilter.includes(bid);
      });
    }
    return items;
  }, [allExpenses, search, dateRange, categoryFilter, invoiceFilter, supplierFilter, batchFilter]);

  const totalSpend = useMemo(
    () => filtered.reduce((s, e) => s + (e.totalAmount || 0), 0),
    [filtered]
  );

  const filters = useMemo(() => ([
    {
      key: 'category',
      label: t('batches.expenseForm.category', 'Category'),
      icon: FolderTree,
      options: categoryOptions,
      values: categoryFilter,
      onChange: setCategoryFilter,
    },
    {
      key: 'invoice',
      label: t('batches.expenseForm.invoiceType', 'Invoice Type'),
      icon: FileText,
      options: invoiceOptions,
      values: invoiceFilter,
      onChange: setInvoiceFilter,
    },
    {
      key: 'supplier',
      label: t('batches.expenseForm.supplier', 'Supplier'),
      icon: Building2,
      options: supplierOptions,
      values: supplierFilter,
      onChange: setSupplierFilter,
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
    categoryOptions, categoryFilter,
    invoiceOptions, invoiceFilter,
    supplierOptions, supplierFilter,
    batchOptions, batchFilter,
  ]);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setCategoryFilter([]);
    setInvoiceFilter([]);
    setSupplierFilter([]);
    setBatchFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ExpensesListView
        expenses={filtered}
        loading={expensesLoading}
        hideHero
        hideSearch
        hideCategoryChips
        emptyTitle={t('batches.noExpenses', 'No expenses')}
        headerComponent={(
          <AccountingHero
            HeaderIcon={Receipt}
            heroTitle={t('accounting.totalSpend', 'Total Spend')}
            count={filtered.length}
            total={totalSpend}
            allCount={allExpenses.length}
            search={search}
            filters={filters}
            dateRange={dateRange}
            loading={expensesLoading}
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
