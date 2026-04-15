import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, FileText } from 'lucide-react';
import db from '@/lib/db';
import { fmt, fmtDate, Row, DocRow, CARD_CLS, LABEL_CLS } from './shared';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';

export default function TransferDetail({ transferId, onEdit, onClose }) {
  const { t } = useTranslation();

  const transfer = useLocalRecord('transfers', transferId);
  const accounting = useSettings('accounting');

  const resolvedDocs = useLiveQuery(async () => {
    const resolveMedia = async (doc) => {
      if (typeof doc === 'object' && doc?.url) return doc;
      const id = typeof doc === 'string' ? doc : doc?._id;
      if (!id) return null;
      return (await db.media.get(id)) || null;
    };
    const proof = transfer?.transferProof ? await resolveMedia(transfer.transferProof) : null;
    const receipt = transfer?.receiptDoc ? await resolveMedia(transfer.receiptDoc) : null;
    return { proof, receipt };
  }, [transfer?.transferProof, transfer?.receiptDoc]) ?? { proof: null, receipt: null };

  if (!transfer) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const currency = accounting?.currency || 'AED';
  const { proof, receipt } = resolvedDocs;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {t(`transfers.types.${transfer.transferType}`)}
              </Badge>
            </div>
            <p className="text-lg font-semibold truncate">
              {transfer.business?.companyName || '—'}
            </p>
            <p className="text-xs text-muted-foreground">{fmtDate(transfer.transferDate)}</p>
          </div>
          {onEdit && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onEdit(transfer)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 pb-6 space-y-4">
          <div className={CARD_CLS}>
            <div className="bg-primary text-primary-foreground flex items-center justify-between px-3 py-2 rounded-t-md">
              <span className="text-sm font-semibold">{t('transfers.amount')}</span>
              <span className="text-sm font-bold tabular-nums">{currency} {fmt(transfer.amount)}</span>
            </div>
          </div>

          <div className={CARD_CLS}>
            <div className="px-3 py-2 space-y-0.5">
              <Row label={t('transfers.transferDate')} value={fmtDate(transfer.transferDate)} />
              <Row label={t('transfers.transferType')} value={t(`transfers.types.${transfer.transferType}`)} />
              <Row label={t('transfers.business')} value={transfer.business?.companyName || '—'} />
            </div>
          </div>

          {transfer.notes && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2">
                <span className={LABEL_CLS}>{t('transfers.notes')}</span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{transfer.notes}</p>
              </div>
            </div>
          )}

          {(proof || receipt) && (
            <div className={CARD_CLS}>
              {proof && <DocRow label={t('transfers.transferProof')} doc={proof} />}
              {receipt && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('transfers.viewReceipt')}
                  </span>
                  {receipt.url && (
                    <a
                      href={receipt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs underline"
                    >
                      {t('transfers.viewReceipt')}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
