import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Receipt, FolderTree, FileText, Building2, Layers, Calendar, Tag,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import ExpensesListView from '@/components/views/ExpensesListView';
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

const EXPENSE_CATEGORIES = [
  'MAINTENANCE', 'LABOUR', 'UTILITIES', 'FUEL', 'CONSUMABLES',
  'FOOD', 'RENT', 'ANIMAL_PROCESSING', 'ANIMAL_WELFARE',
  'FEED', 'SOURCE', 'ASSETS', 'OTHERS',
];

const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

export default function BatchExpensesTab({ batchId }) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [expenses, loading] = useLocalQuery('expenses', { batch: batchId });
  const [allBusinesses] = useLocalQuery('businesses');

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState([]);

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
    expenses.forEach((e) => {
      const sid = (typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany);
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      const inline = typeof e.tradingCompany === 'object' ? e.tradingCompany?.companyName : null;
      const biz = businessMap[sid];
      opts.push({ value: sid, label: inline || biz?.companyName || sid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [expenses, businessMap]);

  const filtered = useMemo(() => {
    let items = expenses;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) =>
        (e.description || '').toLowerCase().includes(q)
        || (e.invoiceId || '').toLowerCase().includes(q)
        || (e.tradingCompany?.companyName || '').toLowerCase().includes(q)
      );
    }

    // ISO date string compare — see BatchSalesTab for rationale (timezone-
    // safe; expenseDate is stored as YYYY-MM-DD).
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

    return items;
  }, [expenses, search, dateRange, categoryFilter, invoiceFilter, supplierFilter]);

  const heroStats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const lastDate = filtered.reduce((max, e) => {
      if (!e.expenseDate) return max;
      const d = new Date(e.expenseDate);
      return !max || d > max ? d : max;
    }, null);
    // Largest category by spend
    const catTotals = {};
    filtered.forEach((e) => {
      const c = e.category || 'OTHERS';
      catTotals[c] = (catTotals[c] || 0) + (e.totalAmount || 0);
    });
    const largest = Object.entries(catTotals)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
    return {
      total,
      count: filtered.length,
      lastDate,
      largest,
    };
  }, [filtered]);

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
  ]), [
    t,
    categoryOptions, categoryFilter,
    invoiceOptions, invoiceFilter,
    supplierOptions, supplierFilter,
  ]);

  // Show "Last Entry" when a category filter is active (so the user has
  // narrowed to a single category) — otherwise show "Largest Category"
  // since that's the more useful summary across all categories.
  const showLastDate = categoryFilter.length > 0;
  const lastDateLabel = fmtRelativeDate(heroStats.lastDate);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setCategoryFilter([]);
    setInvoiceFilter([]);
    setSupplierFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ExpensesListView
        expenses={filtered}
        loading={loading}
        hideHero
        hideSearch
        hideCategoryChips
        emptyTitle={t('batches.noExpenses', 'No expenses')}
        headerComponent={(
          <View style={styles.heroWrap}>
            <ListViewHeroKpi
              title={t('batches.expensesSummary', 'Expenses')}
              icon={Receipt}
              headline={fmt(heroStats.total)}
              stats={[
                {
                  icon: Layers,
                  label: t('batches.entries', 'Entries'),
                  value: fmtInt(heroStats.count),
                },
                showLastDate
                  ? {
                      icon: Calendar,
                      label: t('batches.lastEntry', 'Last Entry'),
                      value: lastDateLabel || '—',
                    }
                  : {
                      icon: Tag,
                      label: t('batches.largestCategory', 'Largest'),
                      value: heroStats.largest
                        ? t(`batches.expenseCategories.${heroStats.largest}`, heroStats.largest)
                        : '—',
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
  // visually clipped against the tabs bar above. ExpensesListView uses
  // paddingTop:0 when external chrome is provided so the hero owns its
  // own top spacing — same recipe as AccountingHero's heroWrap.
  heroWrap: {
    paddingTop: 16,
  },
});
