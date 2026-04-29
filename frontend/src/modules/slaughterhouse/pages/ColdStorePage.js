import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Snowflake, Search, X, RotateCcw, Building2, MapPin } from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import useLocalQuery from '@/hooks/useLocalQuery';
import usePersistedState from '@/hooks/usePersistedState';
import ExpiryBadge from '@/modules/slaughterhouse/components/ExpiryBadge';
import { expiryStatus } from '@/modules/slaughterhouse/lib/expiry';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

const EXPIRY_FILTERS = ['ALL', 'fresh', 'soon', 'critical', 'expired'];
const ALLOCATION_FILTERS = ['ALL', 'ONLINE', 'STOCK'];

// Global cold-store inventory view. Filters by owner, location, zone,
// allocation, expiry urgency. Mirrors FarmsPage/BatchesPage filter +
// search + persisted state structure (per plan §0.1).
export default function ColdStorePage() {
  const { t } = useTranslation();

  const stockUnits = useLocalQuery('stockUnits');
  const businesses = useLocalQuery('businesses');
  const storageLocations = useLocalQuery('storageLocations');

  const [search, setSearch] = usePersistedState('coldstore-search', '');
  const [ownerFilter, setOwnerFilter] = usePersistedState('coldstore-owner', []);
  const [locationFilter, setLocationFilter] = usePersistedState('coldstore-location', []);
  const [allocationFilter, setAllocationFilter] = usePersistedState('coldstore-allocation', 'ALL');
  const [expiryFilter, setExpiryFilter] = usePersistedState('coldstore-expiry', 'ALL');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );
  const locationsById = useMemo(
    () => Object.fromEntries(storageLocations.map((l) => [l._id, l])),
    [storageLocations],
  );

  const ownerOptions = useMemo(() => {
    const ids = new Set();
    stockUnits.forEach((u) => {
      const id = typeof u.owner === 'object' ? u.owner?._id : u.owner;
      if (id) ids.add(id);
    });
    return Array.from(ids).map((id) => ({
      value: id,
      label: businessesById[id]?.companyName || id,
    }));
  }, [stockUnits, businessesById]);

  const locationOptions = useMemo(
    () => storageLocations
      .filter((l) => !l.deletedAt)
      .map((l) => ({ value: l._id, label: l.name })),
    [storageLocations],
  );

  const expiryOptions = useMemo(
    () => EXPIRY_FILTERS.map((s) => ({
      value: s,
      label: s === 'ALL' ? t('stock.filterAll', 'All') : t(`stock.expiry.${s}`, s),
    })),
    [t],
  );

  const allocationOptions = useMemo(
    () => ALLOCATION_FILTERS.map((s) => ({
      value: s,
      label: s === 'ALL' ? t('stock.filterAll', 'All') : t(`production.allocations.${s}`, s),
    })),
    [t],
  );

  const filtered = useMemo(() => {
    let list = stockUnits.filter((u) => !u.deletedAt && (Number(u.qtyAvailable) || 0) > 0);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => {
        const ownerName = businessesById[typeof u.owner === 'object' ? u.owner?._id : u.owner]?.companyName || '';
        const locationName = locationsById[typeof u.location === 'object' ? u.location?._id : u.location]?.name || '';
        const sourceLabel = u.sourceType === 'box' ? formatBandLabel(u.weightBandGrams) : (u.partType || '');
        return ownerName.toLowerCase().includes(q)
          || locationName.toLowerCase().includes(q)
          || sourceLabel.toLowerCase().includes(q);
      });
    }

    if (ownerFilter.length > 0) {
      list = list.filter((u) => {
        const id = typeof u.owner === 'object' ? u.owner?._id : u.owner;
        return ownerFilter.includes(id);
      });
    }
    if (locationFilter.length > 0) {
      list = list.filter((u) => {
        const id = typeof u.location === 'object' ? u.location?._id : u.location;
        return locationFilter.includes(id);
      });
    }
    if (allocationFilter !== 'ALL') {
      list = list.filter((u) => u.allocation === allocationFilter);
    }
    if (expiryFilter !== 'ALL') {
      list = list.filter((u) => expiryStatus(u.expiresAt) === expiryFilter);
    }

    return list.sort((a, b) => {
      const aT = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
      const bT = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
      return aT - bT;
    });
  }, [stockUnits, search, ownerFilter, locationFilter, allocationFilter, expiryFilter, businessesById, locationsById]);

  const totalKg = useMemo(
    () => filtered.reduce((sum, u) => sum + (Number(u.weightKg) || 0), 0),
    [filtered],
  );
  const totalUnits = useMemo(
    () => filtered.reduce((sum, u) => sum + (Number(u.qtyAvailable) || 0), 0),
    [filtered],
  );

  const hasFilters = !!(
    search || ownerFilter.length || locationFilter.length
    || allocationFilter !== 'ALL' || expiryFilter !== 'ALL'
  );

  const resetFilters = () => {
    setSearch('');
    setOwnerFilter([]);
    setLocationFilter([]);
    setAllocationFilter('ALL');
    setExpiryFilter('ALL');
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title={t('stock.title', 'Cold Store')}
        subtitle={t('stock.subtitle', 'Live inventory across all storage locations.')}
        actions={
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <Snowflake className="h-4 w-4 text-muted-foreground" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground leading-none">{t('stock.qtyAvailable', 'Available')}</p>
              <p className="text-sm font-semibold tabular-nums">{fmtInt(totalUnits)} · {fmtKg(totalKg)} kg</p>
            </div>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search', 'Search…')}
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
            options={ownerOptions}
            value={ownerFilter}
            onChange={setOwnerFilter}
            placeholder={t('stock.byOwner', 'Owner')}
          />
          <SearchableMultiSelect
            variant="dropdown"
            options={locationOptions}
            value={locationFilter}
            onChange={setLocationFilter}
            placeholder={t('stock.byLocation', 'Location')}
          />
          <EnumButtonSelect
            options={allocationOptions}
            value={allocationFilter}
            onChange={setAllocationFilter}
            columns={allocationOptions.length}
            compact
          />
          <EnumButtonSelect
            options={expiryOptions}
            value={expiryFilter}
            onChange={setExpiryFilter}
            columns={expiryOptions.length}
            compact
          />
        </div>

        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            {t('common.showingFiltered', 'Showing {{count}} of {{total}}', {
              count: filtered.length,
              total: stockUnits.filter((u) => !u.deletedAt && (Number(u.qtyAvailable) || 0) > 0).length,
            })}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Snowflake className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('stock.noStock', 'No stock on hand')}</h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('stock.noStockDesc', 'Boxes, portions and giblets allocated to STOCK appear here as soon as they are packed.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map((u) => {
              const owner = businessesById[typeof u.owner === 'object' ? u.owner?._id : u.owner];
              const location = locationsById[typeof u.location === 'object' ? u.location?._id : u.location];
              const sourceLabel = u.sourceType === 'box'
                ? formatBandLabel(u.weightBandGrams)
                : t(`production.partTypes.${u.partType}`, u.partType || u.sourceType);
              return (
                <div key={u._id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{sourceLabel}</p>
                      <ExpiryBadge expiresAt={u.expiresAt} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {owner ? (
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{owner.companyName}</span>
                        </span>
                      ) : null}
                      {location ? (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{location.name}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">{fmtKg(u.weightKg)} kg</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtInt(u.qtyAvailable)} {t('stock.qtyAvailable', 'avail').toLowerCase()}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
