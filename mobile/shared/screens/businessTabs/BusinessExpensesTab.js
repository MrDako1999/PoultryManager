import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Receipt, FolderTree, FileText, Layers, Calendar, Tag,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import ExpensesListView from '@/components/views/ExpensesListView';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';
import { AccountingToolbar } from '@/components/views/AccountingFilterBar';
import { formatRelativeDate } from '@/lib/relativeDate';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const EXPENSE_CATEGORIES = [
  'MAINTENANCE', 'LABOUR', 'UTILITIES', 'FUEL', 'CONSUMABLES',
  'FOOD', 'RENT', 'ANIMAL_PROCESSING', 'ANIMAL_WELFARE',
  'FEED', 'SOURCE', 'ASSETS', 'OTHERS',
];

const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

/**
 * Expenses tab inside the Business Detail pager. Mirrors BatchExpensesTab's
 * recipe — KPI hero (Total / Entries / Largest-or-LastEntry) + sticky
 * AccountingToolbar (search / date range / category / invoice filters)
 * + grouped list. The supplier filter is omitted because the supplier is
 * fixed: it's THIS business.
 */
export default function BusinessExpensesTab({ expenses, loading }) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState([]);

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

    return items;
  }, [expenses, search, dateRange, categoryFilter, invoiceFilter]);

  const heroStats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const lastDate = filtered.reduce((max, e) => {
      if (!e.expenseDate) return max;
      const d = new Date(e.expenseDate);
      return !max || d > max ? d : max;
    }, null);
    const catTotals = {};
    filtered.forEach((e) => {
      const c = e.category || 'OTHERS';
      catTotals[c] = (catTotals[c] || 0) + (e.totalAmount || 0);
    });
    const largest = Object.entries(catTotals)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
    return { total, count: filtered.length, lastDate, largest };
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
  ]), [
    t,
    categoryOptions, categoryFilter,
    invoiceOptions, invoiceFilter,
  ]);

  const showLastDate = categoryFilter.length > 0;
  const lastDateLabel = formatRelativeDate(heroStats.lastDate, t);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setCategoryFilter([]);
    setInvoiceFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ExpensesListView
        expenses={filtered}
        loading={loading}
        hideHero
        hideSearch
        hideCategoryChips
        emptyTitle={t('businesses.detail.noExpenses', 'No expenses for this business')}
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
  heroWrap: {
    paddingTop: 16,
  },
});
