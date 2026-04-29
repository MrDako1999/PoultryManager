import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Snowflake, Building2, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import ExpiryBadge from '@/modules/slaughterhouse/components/ExpiryBadge';
import { Row, fmtDate, CARD_CLS, PARTY_CLS } from './shared';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StockUnitDetail({ stockId, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unit = useLocalRecord('stockUnits', stockId);
  const businesses = useLocalQuery('businesses');
  const storageLocations = useLocalQuery('storageLocations');

  const owner = useMemo(() => {
    if (!unit) return null;
    const id = typeof unit.owner === 'object' ? unit.owner?._id : unit.owner;
    return businesses.find((b) => b._id === id) || null;
  }, [unit, businesses]);

  const location = useMemo(() => {
    if (!unit) return null;
    const id = typeof unit.location === 'object' ? unit.location?._id : unit.location;
    return storageLocations.find((l) => l._id === id) || null;
  }, [unit, storageLocations]);

  if (!unit) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const sourceLabel = unit.sourceType === 'box'
    ? formatBandLabel(unit.weightBandGrams)
    : t(`production.partTypes.${unit.partType}`, unit.partType || unit.sourceType);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Snowflake className="h-3 w-3" /> {t(`stock.zones.${unit.temperatureZone}`, unit.temperatureZone)}
            </span>
            <h3 className="text-sm font-semibold truncate">{sourceLabel}</h3>
            <div className="flex items-center gap-2">
              <ExpiryBadge expiresAt={unit.expiresAt} />
              <span className="text-xs text-muted-foreground">{fmtDate(unit.expiresAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {owner ? (
            <button
              type="button"
              onClick={() => { onClose?.(); navigate(`/dashboard/directory/businesses/${owner._id}`); }}
              className={PARTY_CLS}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('stock.byOwner', 'Owner')}
              </p>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <Building2 className="h-3.5 w-3.5" /> {owner.companyName}
              </div>
            </button>
          ) : null}

          {location ? (
            <div className="rounded-md border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('stock.byLocation', 'Location')}
              </p>
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" /> {location.name}
              </div>
            </div>
          ) : null}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('stock.qtyAvailable', 'Available')} value={fmtInt(unit.qtyAvailable)} bold />
              {Number(unit.qtyReserved) > 0 ? (
                <Row label={t('stock.qtyReserved', 'Reserved')} value={fmtInt(unit.qtyReserved)} />
              ) : null}
              <Row label={t('stock.weightKg', 'Weight (kg)')} value={fmtKg(unit.weightKg)} />
              <Separator className="my-1" />
              <Row label={t('production.packagedAt', 'Packaged on')} value={fmtDate(unit.packagedAt)} />
              <Row label={t('production.expiresAt', 'Expires on')} value={fmtDate(unit.expiresAt)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
