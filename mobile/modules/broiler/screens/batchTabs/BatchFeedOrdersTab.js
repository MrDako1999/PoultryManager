import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Wheat, Building2 } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import FeedOrdersListView from '@/components/views/FeedOrdersListView';
import FeedMixHeroCard from '@/components/views/FeedMixHeroCard';
import { AccountingToolbar } from '@/components/views/AccountingFilterBar';

const FEED_TYPES = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];

export default function BatchFeedOrdersTab({ batchId }) {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();

  const [feedOrders, loading] = useLocalQuery('feedOrders', { batch: batchId });
  const [allBusinesses] = useLocalQuery('businesses');
  // Daily logs power the consumption fill on the FeedMixHeroCard's
  // per-type bars — so the same "consumed vs ordered" relationship
  // farmers see on the Batch Overview Feed card is also visible
  // here. We deliberately do NOT gate `loading` on this query: the
  // card has its own empty/missing-data fallbacks, and feed-order
  // browsing shouldn't wait on log sync.
  const [dailyLogs] = useLocalQuery('dailyLogs', { batch: batchId });

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [feedTypeFilter, setFeedTypeFilter] = useState([]);
  const [companyFilter, setCompanyFilter] = useState([]);

  const businessMap = useMemo(() => {
    const m = {};
    allBusinesses.forEach((b) => { m[b._id] = b; });
    return m;
  }, [allBusinesses]);

  const feedTypeOptions = useMemo(
    () => FEED_TYPES.map((type) => ({
      value: type,
      label: t(`feed.feedTypes.${type}`, type),
    })),
    [t]
  );

  // Company options derived only from feed orders we have for this batch.
  const companyOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    feedOrders.forEach((o) => {
      const cid = (typeof o.feedCompany === 'object' ? o.feedCompany?._id : o.feedCompany);
      if (!cid || seen.has(cid)) return;
      seen.add(cid);
      const inline = typeof o.feedCompany === 'object' ? o.feedCompany?.companyName : null;
      const biz = businessMap[cid];
      opts.push({ value: cid, label: inline || biz?.companyName || cid });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [feedOrders, businessMap]);

  const filtered = useMemo(() => {
    let items = feedOrders;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((o) => {
        if ((o.feedCompany?.companyName || '').toLowerCase().includes(q)) return true;
        return (o.items || []).some(
          (it) => (it.feedDescription || '').toLowerCase().includes(q)
        );
      });
    }

    // ISO date string compare — see BatchSalesTab for rationale (timezone-
    // safe; orderDate is stored as YYYY-MM-DD).
    if (dateRange?.from || dateRange?.to) {
      const fromIso = dateRange.from;
      const toIso = dateRange.to || dateRange.from;
      items = items.filter((o) => {
        if (!o.orderDate) return false;
        const sIso = String(o.orderDate).slice(0, 10);
        if (fromIso && sIso < fromIso) return false;
        if (toIso && sIso > toIso) return false;
        return true;
      });
    }

    if (companyFilter.length) {
      items = items.filter((o) => {
        const cid = (typeof o.feedCompany === 'object' ? o.feedCompany?._id : o.feedCompany);
        return companyFilter.includes(cid);
      });
    }

    if (feedTypeFilter.length) {
      // Order-level pass: keep orders that contain at least one item of
      // the selected feed types. Item-level filtering happens inside
      // FeedOrdersListView via the `feedTypeFilter` prop.
      items = items.filter((o) =>
        (o.items || []).some(
          (it) => feedTypeFilter.includes(it.feedType || 'OTHER')
        )
      );
    }

    return items;
  }, [feedOrders, search, dateRange, companyFilter, feedTypeFilter]);

  const filters = useMemo(() => ([
    {
      key: 'feedType',
      label: t('feed.feedType', 'Feed Type'),
      icon: Wheat,
      options: feedTypeOptions,
      values: feedTypeFilter,
      onChange: setFeedTypeFilter,
    },
    {
      key: 'company',
      label: t('feed.feedCompany', 'Feed Company'),
      icon: Building2,
      options: companyOptions,
      values: companyFilter,
      onChange: setCompanyFilter,
    },
  ]), [t, feedTypeOptions, feedTypeFilter, companyOptions, companyFilter]);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setFeedTypeFilter([]);
    setCompanyFilter([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <FeedOrdersListView
        feedOrders={filtered}
        loading={loading}
        hideHero
        hideSearch
        hideTypeChips
        feedTypeFilter={feedTypeFilter}
        emptyTitle={t('batches.noFeedOrders', 'No feed orders')}
        headerComponent={(
          <View style={styles.heroWrap}>
            <FeedMixHeroCard
              feedOrders={filtered}
              allFeedOrders={feedOrders}
              dailyLogs={dailyLogs}
              feedTypeFilter={feedTypeFilter}
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
  // visually clipped against the tabs bar above. FeedOrdersListView
  // uses paddingTop:0 when external chrome is provided so the hero owns
  // its own top spacing — same recipe as AccountingHero's heroWrap.
  heroWrap: {
    paddingTop: 16,
  },
});
