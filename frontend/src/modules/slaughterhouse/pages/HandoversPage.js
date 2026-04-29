import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Truck, Search, X, RotateCcw, Building2,
} from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import usePersistedState from '@/hooks/usePersistedState';
import HandoverSheet from '@/modules/slaughterhouse/sheets/HandoverSheet';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

export default function HandoversPage() {
  const { t } = useTranslation();
  const { can } = useCapabilities();
  const canCreate = can('handover:create');

  const handovers = useLocalQuery('handovers');
  const businesses = useLocalQuery('businesses');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = usePersistedState('handovers-search', '');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const filtered = useMemo(() => {
    let list = handovers.filter((h) => !h.deletedAt);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((h) => {
        const customer = businessesById[typeof h.customer === 'object' ? h.customer?._id : h.customer];
        const customerName = customer?.companyName?.toLowerCase() || '';
        const plate = (h.vehiclePlate || '').toLowerCase();
        return customerName.includes(q) || plate.includes(q);
      });
    }
    return list.sort((a, b) => {
      const aT = a.dispatchedAt ? new Date(a.dispatchedAt).getTime() : 0;
      const bT = b.dispatchedAt ? new Date(b.dispatchedAt).getTime() : 0;
      return bT - aT;
    });
  }, [handovers, search, businessesById]);

  return (
    <div className="space-y-4">
      <PageTitle
        title={t('handovers.title', 'Handovers')}
        subtitle={t('handovers.subtitle', 'Outbound dispatches to wholesalers and traders.')}
        actions={canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setSheetOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t('handovers.newHandover', 'New Handover')}
          </Button>
        )}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('handovers.noHandovers', 'No handovers yet')}</h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('handovers.noHandoversDesc', 'Create a handover when a wholesaler arrives to collect product.')}
            </p>
            {canCreate ? (
              <Button size="sm" className="gap-1.5" onClick={() => setSheetOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t('handovers.newHandover', 'New Handover')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map((h) => {
              const customer = businessesById[typeof h.customer === 'object' ? h.customer?._id : h.customer];
              return (
                <div key={h._id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{h.vehiclePlate || '—'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {customer ? (
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{customer.companyName}</span>
                        </span>
                      ) : null}
                      {h.dispatchedAt ? (
                        <span className="tabular-nums">{new Date(h.dispatchedAt).toLocaleString('en-US')}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">{fmtKg(h.totals?.totalKg)} kg</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtInt(h.totals?.totalItems)} {t('handovers.totalItems', 'items').toLowerCase()}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <HandoverSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
