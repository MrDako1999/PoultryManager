import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, RotateCcw, Wheat } from 'lucide-react';

import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import usePersistedState from '@/hooks/usePersistedState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import FeedOrdersListView from '@/modules/broiler/views/FeedOrdersListView';

const FEED_TYPES = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];

export default function BatchFeedOrdersView() {
  const { id, fid } = useParams();
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const fmt = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const allFeedOrders = useLocalQuery('feedOrders', { batch: id });
  const allBusinesses = useLocalQuery('businesses');

  const [search, setSearch] = usePersistedState(`batch-feed-${id}-search`, '');
  const [dateRange, setDateRange] = usePersistedState(`batch-feed-${id}-dateRange`, undefined, { dates: true });
  const [feedTypeFilter, setFeedTypeFilter] = usePersistedState(`batch-feed-${id}-feedType`, []);
  const [companyFilter, setCompanyFilter] = usePersistedState(`batch-feed-${id}-company`, []);

  const feedTypeOptions = useMemo(
    () => FEED_TYPES.map((ft) => ({
      value: ft,
      label: t(`feed.feedTypes.${ft}`, ft),
    })),
    [t],
  );

  const companyOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allFeedOrders.forEach((o) => {
      const cid = o.feedCompany?._id || o.feedCompany;
      if (!cid || seen.has(cid)) return;
      seen.add(cid);
      const biz = allBusinesses.find((b) => b._id === cid);
      opts.push({
        value: cid,
        label: o.feedCompany?.companyName || biz?.companyName || cid,
      });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allFeedOrders, allBusinesses]);

  const filtered = useMemo(() => {
    let items = allFeedOrders;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((o) =>
        (o.feedCompany?.companyName || '').toLowerCase().includes(q) ||
        (o.taxInvoiceId || '').toLowerCase().includes(q) ||
        (o.items || []).some((it) =>
          (it.feedDescription || '').toLowerCase().includes(q),
        ),
      );
    }

    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
      items = items.filter((o) => {
        if (!o.orderDate) return false;
        const d = new Date(o.orderDate);
        return d >= from && d <= to;
      });
    }

    if (feedTypeFilter.length > 0) {
      items = items.filter((o) =>
        (o.items || []).some((it) => feedTypeFilter.includes(it.feedType)),
      );
    }

    if (companyFilter.length > 0) {
      items = items.filter((o) => {
        const cid = o.feedCompany?._id || o.feedCompany;
        return companyFilter.includes(cid);
      });
    }

    return items;
  }, [allFeedOrders, search, dateRange, feedTypeFilter, companyFilter]);

  const totalKg = useMemo(
    () => filtered.reduce((sum, o) =>
      sum + (o.items || []).reduce((s, it) => s + (it.bags || 0) * (it.quantitySize || 50), 0),
    0),
    [filtered],
  );

  const totalCost = useMemo(
    () => filtered.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
    [filtered],
  );

  const hasFilters = !!(
    search || dateRange?.from || feedTypeFilter.length || companyFilter.length
  );

  const resetFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setFeedTypeFilter([]);
    setCompanyFilter([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t('batches.feedOrdersTab', 'Feed Orders')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('batches.feedOrdersFromBatch', 'Feed orders placed for this batch')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <Wheat className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalOrders', 'Total Orders')}</p>
                <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalWeight', 'Total Weight')}</p>
                <p className="text-sm font-semibold tabular-nums">{totalKg.toLocaleString()} KG</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-none">{t('batches.totalCost', 'Total Cost')}</p>
                <p className="text-sm font-semibold tabular-nums">{currency} {fmt(totalCost)}</p>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <SearchableMultiSelect
            variant="dropdown"
            options={feedTypeOptions}
            value={feedTypeFilter}
            onChange={setFeedTypeFilter}
            placeholder={t('feed.feedType', 'Feed Type')}
          />

          <SearchableMultiSelect
            variant="dropdown"
            options={companyOptions}
            value={companyFilter}
            onChange={setCompanyFilter}
            placeholder={t('batches.feedCompany', 'Feed Company')}
          />

          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
          />
        </div>

        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            {t('common.showingFiltered', 'Showing {{count}} of {{total}}', { count: filtered.length, total: allFeedOrders.length })} {t('batches.feedOrdersTab', 'feed orders').toLowerCase()}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <FeedOrdersListView
          items={filtered}
          selectedId={fid}
          basePath={`/dashboard/batches/${id}`}
          batchId={id}
          persistId={`batch-feed-orders-${id}`}
        />
      </div>
    </div>
  );
}
