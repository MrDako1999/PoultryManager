import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight, Tag, Calendar, Receipt,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import TransfersListView from '@/components/views/TransfersListView';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';
import { AccountingToolbar } from '@/components/views/AccountingFilterBar';
import { formatRelativeDate } from '@/lib/relativeDate';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const TRANSFER_TYPES = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT'];

/**
 * Transfers tab inside the Business Detail pager. Mirrors
 * BatchSalesTab / BatchExpensesTab — KPI hero (Total / Entries / Last
 * Transfer) + sticky AccountingToolbar (search / date range / type
 * filter) + grouped list. The business filter is omitted because the
 * business is fixed: it's THIS business.
 */
export default function BusinessTransfersTab({
  transfers, loading, onAdd, onRowPress,
}) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState([]);

  const typeOptions = useMemo(
    () => TRANSFER_TYPES.map((tt) => ({
      value: tt,
      label: t(`transfers.types.${tt}`, tt),
    })),
    [t]
  );

  const filtered = useMemo(() => {
    let items = transfers;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((tr) =>
        (tr.notes || '').toLowerCase().includes(q)
        || (tr.business?.companyName || '').toLowerCase().includes(q)
      );
    }

    if (dateRange?.from || dateRange?.to) {
      const fromIso = dateRange.from;
      const toIso = dateRange.to || dateRange.from;
      items = items.filter((tr) => {
        if (!tr.transferDate) return false;
        const sIso = String(tr.transferDate).slice(0, 10);
        if (fromIso && sIso < fromIso) return false;
        if (toIso && sIso > toIso) return false;
        return true;
      });
    }

    if (typeFilter.length) {
      items = items.filter((tr) => typeFilter.includes(tr.transferType || 'CASH'));
    }

    return items;
  }, [transfers, search, dateRange, typeFilter]);

  const heroStats = useMemo(() => {
    const total = filtered.reduce((s, x) => s + (x.amount || 0), 0);
    const lastDate = filtered.reduce((max, tr) => {
      if (!tr.transferDate) return max;
      const d = new Date(tr.transferDate);
      return !max || d > max ? d : max;
    }, null);
    return { total, count: filtered.length, lastDate };
  }, [filtered]);

  const filters = useMemo(() => ([
    {
      key: 'type',
      label: t('transfers.transferType', 'Type'),
      icon: Tag,
      options: typeOptions,
      values: typeFilter,
      onChange: setTypeFilter,
    },
  ]), [t, typeOptions, typeFilter]);

  const lastDateLabel = formatRelativeDate(heroStats.lastDate, t);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setTypeFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <TransfersListView
        transfers={filtered}
        loading={loading}
        onAdd={onAdd}
        onRowPress={onRowPress}
        addLabel={t('transfers.addTransfer', 'Add Transfer')}
        hideHero
        hideSearch
        emptyTitle={t('businesses.detail.noTransfers', 'No transfers yet for this business')}
        headerComponent={(
          <View style={styles.heroWrap}>
            <ListViewHeroKpi
              title={t('transfers.title', 'Transfers')}
              icon={ArrowLeftRight}
              headline={fmt(heroStats.total)}
              stats={[
                {
                  icon: Receipt,
                  label: t('batches.entries', 'Entries'),
                  value: fmtInt(heroStats.count),
                },
                {
                  icon: Calendar,
                  label: t('transfers.lastTransfer', 'Last Transfer'),
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
