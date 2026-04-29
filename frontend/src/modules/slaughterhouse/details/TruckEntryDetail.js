import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Pencil, Truck, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import { Row, fmtDate, CARD_CLS, PARTY_CLS, DocRow } from './shared';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

export default function TruckEntryDetail({ truckId, onClose, onEdit }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const truck = useLocalRecord('truckEntries', truckId);
  const businesses = useLocalQuery('businesses');
  const contacts = useLocalQuery('contacts');

  const supplier = useMemo(() => {
    if (!truck) return null;
    const sid = typeof truck.supplier === 'object' ? truck.supplier?._id : truck.supplier;
    return businesses.find((b) => b._id === sid) || null;
  }, [truck, businesses]);

  const driver = useMemo(() => {
    if (!truck) return null;
    const did = typeof truck.driver === 'object' ? truck.driver?._id : truck.driver;
    return contacts.find((c) => c._id === did) || null;
  }, [truck, contacts]);

  if (!truck) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const s = truck.sortation || {};
  const losses = (Number(s.doa) || 0)
    + (Number(s.condemnation) || 0)
    + (Number(s.bGrade) || 0)
    + (Number(s.shortage) || 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Truck className="h-3 w-3" /> {t(`trucks.statuses.${truck.status}`, truck.status)}
            </span>
            <h3 className="text-sm font-semibold truncate">{truck.vehiclePlate || '—'}</h3>
            <p className="text-xs text-muted-foreground">{fmtDate(truck.arrivedAt)}</p>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(truck)} title={t('common.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {supplier ? (
            <button
              type="button"
              onClick={() => { onClose?.(); navigate(`/dashboard/directory/businesses/${supplier._id}`); }}
              className={PARTY_CLS}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('trucks.supplier', 'Source supplier')}
              </p>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <Building2 className="h-3.5 w-3.5" /> {supplier.companyName}
              </div>
            </button>
          ) : null}

          {driver ? (
            <button
              type="button"
              onClick={() => { onClose?.(); navigate(`/dashboard/directory/contacts/${driver._id}`); }}
              className={PARTY_CLS}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('trucks.driver', 'Driver')}
              </p>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <User className="h-3.5 w-3.5" />
                {`${driver.firstName || ''} ${driver.lastName || ''}`.trim() || '—'}
              </div>
              {driver.phone ? <p className="text-xs text-muted-foreground mt-0.5">{driver.phone}</p> : null}
            </button>
          ) : null}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('trucks.expectedQty', 'Expected birds')} value={fmtInt(truck.expectedQty)} bold />
              <Row label={t('sortation.doa', 'DOA')} value={fmtInt(s.doa)} />
              <Row label={t('sortation.condemned', 'Condemned')} value={fmtInt(s.condemnation)} />
              <Row label={t('sortation.bGrade', 'B-grade')} value={fmtInt(s.bGrade)} />
              <Row label={t('sortation.shortage', 'Shortage')} value={fmtInt(s.shortage)} />
              <Separator className="my-1" />
              <Row
                label={t('reconciliation.netToLine', 'Net to line')}
                value={fmtInt((Number(truck.expectedQty) || 0) - losses)}
                bold
              />
            </div>
          </div>

          {truck.truckPhoto ? (
            <DocRow label={t('trucks.truckPhoto', 'Frontal truck photo')} doc={truck.truckPhoto} />
          ) : null}

          {truck.notes ? (
            <div className="rounded-md bg-muted/30 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('common.notes', 'Notes')}</p>
              <p className="text-sm whitespace-pre-wrap">{truck.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
