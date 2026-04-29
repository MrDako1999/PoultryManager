import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Truck, Building2, User, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import {
  Row, fmtDate, CARD_CLS, PARTY_CLS, DocRow,
} from './shared';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HandoverDetail({ handoverId, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handover = useLocalRecord('handovers', handoverId);
  const items = useLocalQuery('handoverItems', { handover: handoverId });
  const stockUnits = useLocalQuery('stockUnits');
  const businesses = useLocalQuery('businesses');
  const contacts = useLocalQuery('contacts');

  const customer = useMemo(() => {
    if (!handover) return null;
    const id = typeof handover.customer === 'object' ? handover.customer?._id : handover.customer;
    return businesses.find((b) => b._id === id) || null;
  }, [handover, businesses]);

  const driver = useMemo(() => {
    if (!handover) return null;
    const id = typeof handover.driver === 'object' ? handover.driver?._id : handover.driver;
    return contacts.find((c) => c._id === id) || null;
  }, [handover, contacts]);

  const stockById = useMemo(
    () => Object.fromEntries(stockUnits.map((u) => [u._id, u])),
    [stockUnits],
  );

  if (!handover) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const liveItems = items.filter((it) => !it.deletedAt);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Truck className="h-3 w-3" /> {t(`handovers.statuses.${handover.status}`, handover.status)}
            </span>
            <h3 className="text-sm font-semibold truncate">
              {handover.vehiclePlate || '—'}
            </h3>
            <p className="text-xs text-muted-foreground">{fmtDate(handover.dispatchedAt)}</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {customer ? (
            <button
              type="button"
              onClick={() => { onClose?.(); navigate(`/dashboard/directory/businesses/${customer._id}`); }}
              className={PARTY_CLS}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('handovers.customer', 'Customer')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {customer.companyName}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ) : null}

          {driver ? (
            <div className="rounded-md border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('handovers.driver', 'Driver')}
              </p>
              <div className="flex items-center gap-1 text-sm">
                <User className="h-3.5 w-3.5" />
                {`${driver.firstName || ''} ${driver.lastName || ''}`.trim() || '—'}
              </div>
            </div>
          ) : null}

          <div className={CARD_CLS}>
            <div className="bg-primary text-primary-foreground px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
              {t('handovers.items', 'Items loaded')}
            </div>
            {liveItems.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">—</p>
            ) : (
              <div className="divide-y">
                {liveItems.map((it) => {
                  const su = stockById[typeof it.stockUnit === 'object' ? it.stockUnit?._id : it.stockUnit];
                  const sourceLabel = su
                    ? (su.sourceType === 'box'
                      ? formatBandLabel(su.weightBandGrams)
                      : t(`production.partTypes.${su.partType}`, su.partType || su.sourceType))
                    : '—';
                  return (
                    <div key={it._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{sourceLabel}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtInt(it.qty)}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtKg(it.weightKg)} kg</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-muted/30">
                  <span className="flex-1">{t('handovers.totalKg', 'Total weight')}</span>
                  <span className="tabular-nums">{fmtInt(handover.totals?.totalItems)}</span>
                  <span className="tabular-nums">{fmtKg(handover.totals?.totalKg)} kg</span>
                </div>
              </div>
            )}
          </div>

          {handover.signature ? (
            <DocRow label={t('handovers.signature', 'Driver signature')} doc={handover.signature} />
          ) : null}
          {handover.deliveryNote ? (
            <DocRow label={t('handovers.docs.deliveryNote', 'Delivery Note')} doc={handover.deliveryNote} />
          ) : null}
          {handover.salesInvoice ? (
            <DocRow label={t('handovers.docs.salesInvoice', 'Sales Invoice')} doc={handover.salesInvoice} />
          ) : null}
          {handover.handoverReceipt ? (
            <DocRow label={t('handovers.docs.handoverReceipt', 'Handover Receipt')} doc={handover.handoverReceipt} />
          ) : null}

          {handover.notes ? (
            <div className="rounded-md bg-muted/30 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('common.notes', 'Notes')}</p>
              <p className="text-sm whitespace-pre-wrap">{handover.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
