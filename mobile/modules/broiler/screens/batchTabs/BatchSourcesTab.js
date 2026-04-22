import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Egg, DollarSign, Layers, Calendar, Building2,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SourcesListView from '@/components/views/SourcesListView';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';
import { AccountingToolbar } from '@/components/views/AccountingFilterBar';
import { formatRelativeDate } from '@/lib/relativeDate';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

export default function BatchSourcesTab({ batchId }) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [sources, loading] = useLocalQuery('sources', { batch: batchId });
  const [allBusinesses] = useLocalQuery('businesses');

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [supplierFilter, setSupplierFilter] = useState([]);

  const businessMap = useMemo(() => {
    const m = {};
    allBusinesses.forEach((b) => { m[b._id] = b; });
    return m;
  }, [allBusinesses]);

  // Supplier options derived only from sources we have for this batch, so
  // the filter doesn't show empty options the user can't possibly need.
  const supplierOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    sources.forEach((s) => {
      const sid = (typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom);
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      const inline = typeof s.sourceFrom === 'object' ? s.sourceFrom?.companyName : null;
      const biz = businessMap[sid];
      opts.push({ value: sid, label: inline || biz?.companyName || sid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [sources, businessMap]);

  const filtered = useMemo(() => {
    let items = sources;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        (s.sourceFrom?.companyName || '').toLowerCase().includes(q)
        || (s.taxInvoiceId || '').toLowerCase().includes(q)
        || (s.invoiceId || '').toLowerCase().includes(q)
      );
    }

    // ISO date string compare — see BatchSalesTab for rationale (timezone-
    // safe; deliveryDate is stored as YYYY-MM-DD).
    if (dateRange?.from || dateRange?.to) {
      const fromIso = dateRange.from;
      const toIso = dateRange.to || dateRange.from;
      items = items.filter((s) => {
        if (!s.deliveryDate) return false;
        const sIso = String(s.deliveryDate).slice(0, 10);
        if (fromIso && sIso < fromIso) return false;
        if (toIso && sIso > toIso) return false;
        return true;
      });
    }

    if (supplierFilter.length) {
      items = items.filter((s) => {
        const sid = (typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom);
        return supplierFilter.includes(sid);
      });
    }

    return items;
  }, [sources, search, dateRange, supplierFilter]);

  const heroStats = useMemo(() => {
    const totalChicks = filtered.reduce((sum, x) => sum + (x.totalChicks || 0), 0);
    const totalCost = filtered.reduce((sum, x) => sum + (x.grandTotal || 0), 0);
    const lastDeliveryDate = filtered.reduce((max, s) => {
      if (!s.deliveryDate) return max;
      const d = new Date(s.deliveryDate);
      return !max || d > max ? d : max;
    }, null);
    return {
      totalChicks,
      totalCost,
      costPerChick: totalChicks > 0 ? totalCost / totalChicks : null,
      lastDeliveryDate,
      count: filtered.length,
    };
  }, [filtered]);

  const filters = useMemo(() => ([
    {
      key: 'supplier',
      label: t('batches.expenseForm.supplier', 'Supplier'),
      icon: Building2,
      options: supplierOptions,
      values: supplierFilter,
      onChange: setSupplierFilter,
    },
  ]), [t, supplierOptions, supplierFilter]);

  const dateRangeActive = !!(dateRange?.from || dateRange?.to);
  const hasAnyFilter = !!(search || supplierFilter.length || dateRangeActive);

  const lastDeliveryLabel = formatRelativeDate(heroStats.lastDeliveryDate, t);

  const sublineFiltered = t('accounting.showingOf', '{{shown}} of {{total}}', {
    shown: fmtInt(heroStats.count),
    total: fmtInt(sources.length),
  });
  const sublineDefault = `${fmt(heroStats.totalCost)}  ·  ${t('batches.totalCost', 'Total Cost').toLowerCase()}`;

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setSupplierFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <SourcesListView
        sources={filtered}
        loading={loading}
        hideHero
        hideSearch
        emptyTitle={t('batches.noSources', 'No sources')}
        headerComponent={(
          <View style={styles.heroWrap}>
            <ListViewHeroKpi
              title={t('batches.sourcesSummary', 'Sources')}
              icon={Egg}
              headline={fmtInt(heroStats.totalChicks)}
              subline={hasAnyFilter ? sublineFiltered : sublineDefault}
              stats={[
                {
                  icon: Layers,
                  label: t('batches.entries', 'Entries'),
                  value: fmtInt(heroStats.count),
                },
                {
                  icon: DollarSign,
                  label: t('batches.costPerChick', 'Cost / Chick'),
                  value: heroStats.costPerChick != null ? fmt(heroStats.costPerChick) : '—',
                },
                {
                  icon: Calendar,
                  label: t('batches.lastDelivery', 'Last Delivery'),
                  value: lastDeliveryLabel || '—',
                },
              ]}
            />
          </View>
        )}
        stickyToolbar={() => (
          <AccountingToolbar
            search={search}
            setSearch={setSearch}
            dateRange={dateRange}
            setDateRange={setDateRange}
            filters={filters}
            onResetAll={resetAll}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Top breathing room for the KPI hero so the eyebrow text isn't
  // visually clipped against the tabs bar above. SourcesListView uses
  // paddingTop:0 when external chrome is provided so the hero owns its
  // own top spacing — same recipe as AccountingHero's heroWrap.
  heroWrap: {
    paddingTop: 16,
  },
});
