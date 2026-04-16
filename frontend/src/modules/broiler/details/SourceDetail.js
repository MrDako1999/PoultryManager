import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, FileText, ChevronRight, Receipt } from 'lucide-react';
import { fmt, fmtDate, Row, DocRow, OtherDocsList, CARD_CLS, PARTY_CLS } from './shared';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';

export default function SourceDetail({ sourceId, onEdit, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const source = useLocalRecord('sources', sourceId);
  const accounting = useSettings('accounting');

  if (!source) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const currency = accounting?.currency || 'AED';
  const showVat = source.invoiceType === 'TAX_INVOICE';
  const supplierId = typeof source.sourceFrom === 'object' ? source.sourceFrom?._id : source.sourceFrom;
  const focChicks = (source.totalChicks || 0) - (source.quantityPurchased || 0);
  const taxInvoiceDocs = (source.taxInvoiceDocs || []).filter(Boolean);
  const transferProofs = (source.transferProofs || []).filter(Boolean);
  const deliveryNoteDocs = (source.deliveryNoteDocs || []).filter(Boolean);
  const otherDocs = (source.otherDocs || []).filter(Boolean);
  const hasDocuments = taxInvoiceDocs.length > 0 || transferProofs.length > 0 || deliveryNoteDocs.length > 0 || otherDocs.length > 0;
  const invoiceUrl = taxInvoiceDocs[0]?.url || null;

  const handleNavBusiness = () => {
    onClose?.();
    navigate(`/dashboard/directory/businesses/${supplierId}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {t(`batches.invoiceTypes.${source.invoiceType}`)}
              </Badge>
              {source.focPercentage > 0 && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                  {source.focPercentage}% FOC
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold truncate">{source.taxInvoiceId || '—'}</h3>
            <p className="text-xs text-muted-foreground">{fmtDate(source.deliveryDate)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            {invoiceUrl && (
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" title={t('batches.sourceDetail.viewInvoice')}>
                  <FileText className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(source)} title={t('common.edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {source.sourceFrom?.companyName && (
            <button type="button" onClick={handleNavBusiness} className={PARTY_CLS}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('batches.sourceDetail.sourceFrom')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{source.sourceFrom.companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          )}

          <div className={CARD_CLS}>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
              {t('batches.sourceDetail.purchaseBreakdown')}
            </div>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('batches.quantityPurchased')} value={(source.quantityPurchased || 0).toLocaleString()} />
              <Row label={t('batches.sourceDetail.ratePerChick')} value={`${currency} ${fmt(source.chicksRate)}`} />
              {source.focPercentage > 0 && (
                <Row label={t('batches.sourceDetail.focBonus')} value={`+${focChicks.toLocaleString()} (${source.focPercentage}%)`} highlight />
              )}
              <Separator className="my-1" />
              <Row label={t('batches.totalChicksField')} value={(source.totalChicks || 0).toLocaleString()} bold />
            </div>
          </div>

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('batches.subtotal')} value={`${currency} ${fmt(source.subtotal)}`} bold />
              {showVat && <Row label={t('batches.vat')} value={`${currency} ${fmt(source.vatAmount)}`} />}
            </div>
            <div className="flex items-center justify-between bg-primary text-primary-foreground px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('batches.grandTotal')}</span>
              <span className="text-sm font-bold tabular-nums">{currency} {fmt(source.grandTotal)}</span>
            </div>
          </div>

          {(source.invoiceDate || source.deliveryDate) && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2.5 space-y-0.5">
                {source.invoiceDate && <Row label={t('batches.invoiceDate')} value={fmtDate(source.invoiceDate)} />}
                {source.deliveryDate && <Row label={t('batches.deliveryDate')} value={fmtDate(source.deliveryDate)} />}
              </div>
            </div>
          )}

          {hasDocuments && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.sourceDetail.documents')}
              </div>
              <div className="divide-y">
                {taxInvoiceDocs.map((doc) => <DocRow key={doc._id} label={t('batches.sourceDetail.taxInvoiceDoc')} doc={doc} />)}
                {transferProofs.map((doc) => <DocRow key={doc._id} label={t('batches.sourceDetail.transferProof')} doc={doc} />)}
                {deliveryNoteDocs.map((doc) => <DocRow key={doc._id} label={t('batches.sourceDetail.deliveryNoteDoc')} doc={doc} />)}
                <OtherDocsList docs={otherDocs} />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-1 pb-2">
            {t('batches.sourceDetail.createdAt')} {fmtDate(source.createdAt)} · {t('batches.sourceDetail.updatedAt')} {fmtDate(source.updatedAt)}
          </p>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 justify-between pt-2 border-t px-6 pb-4 shrink-0">
        {invoiceUrl ? (
          <Button variant="outline" asChild>
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" />
              {t('batches.sourceDetail.viewInvoice')}
            </a>
          </Button>
        ) : <div />}
        <Button onClick={() => onEdit?.(source)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t('batches.editSource')}
        </Button>
      </div>
    </div>
  );
}
