import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, FileText, ChevronRight, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmt, fmtDate, Row, DocRow, OtherDocsList, CARD_CLS, PARTY_CLS, VALUE_CLS, TABLE_HEADER_CLS, TABLE_ROW_CLS } from './shared';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';

export default function FeedOrderDetail({ feedOrderId, onEdit, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const order = useLocalRecord('feedOrders', feedOrderId);
  const accounting = useSettings('accounting');

  if (!order) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const currency = accounting?.currency || 'AED';
  const companyId = typeof order.feedCompany === 'object' ? order.feedCompany?._id : order.feedCompany;
  const items = order.items || [];
  const totalBags = items.reduce((sum, li) => sum + (li.bags || 0), 0);
  const hasVat = (order.vatAmount || 0) > 0;
  const taxInvoiceDocs = (order.taxInvoiceDocs || []).filter(Boolean);
  const transferProofs = (order.transferProofs || []).filter(Boolean);
  const deliveryNoteDocs = (order.deliveryNoteDocs || []).filter(Boolean);
  const otherDocs = (order.otherDocs || []).filter(Boolean);
  const hasDocuments = taxInvoiceDocs.length > 0 || transferProofs.length > 0 || deliveryNoteDocs.length > 0 || otherDocs.length > 0;
  const invoiceUrl = taxInvoiceDocs[0]?.url || null;

  const handleNavBusiness = () => {
    onClose?.();
    navigate(`/dashboard/directory/businesses/${companyId}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {t('batches.feedOrderDetail.feedOrder')}
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {totalBags} {t('batches.bags')}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold truncate">{order.feedCompany?.companyName || '—'}</h3>
            <p className="text-xs text-muted-foreground">{fmtDate(order.orderDate)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            {invoiceUrl && (
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" title={t('batches.feedOrderDetail.viewInvoice')}>
                  <FileText className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(order)} title={t('common.edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {order.feedCompany?.companyName && (
            <button type="button" onClick={handleNavBusiness} className={PARTY_CLS}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('batches.feedCompany')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{order.feedCompany.companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          )}

          {items.length > 0 && (
            <div className={CARD_CLS}>
              <div className={cn('grid grid-cols-[1fr_50px_62px_74px] gap-0', TABLE_HEADER_CLS)}>
                <span>{t('batches.feedOrderDetail.product')}</span>
                <span className="text-right">{t('batches.bags')}</span>
                <span className="text-right">{t('batches.feedOrderDetail.price')}</span>
                <span className="text-right">{t('batches.feedOrderDetail.amount')}</span>
              </div>
              {items.map((item, i) => {
                const desc = item.feedDescription || item.feedItem?.feedDescription || t(`feed.feedTypes.${item.feedType}`);
                const size = item.quantitySize && item.quantityUnit ? `${item.quantitySize}${item.quantityUnit}` : '';
                return (
                  <div key={item._id || i} className={cn('grid grid-cols-[1fr_50px_62px_74px] gap-0', TABLE_ROW_CLS, i % 2 === 1 && 'bg-muted/30')}>
                    <div className="min-w-0">
                      <span className="truncate block">{desc}</span>
                      {size && <span className="text-xs text-muted-foreground">{size}</span>}
                    </div>
                    <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{(item.bags || 0).toLocaleString('en-US')}</span>
                    <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(item.pricePerBag)}</span>
                    <span className={cn('text-right', VALUE_CLS, 'font-medium')}>{fmt(item.subtotal)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('batches.subtotal')} value={`${currency} ${fmt(order.subtotal)}`} bold />
              {(order.deliveryCharge || 0) > 0 && <Row label={t('batches.deliveryCharge')} value={`${currency} ${fmt(order.deliveryCharge)}`} />}
              {hasVat && <Row label={t('batches.vat')} value={`${currency} ${fmt(order.vatAmount)}`} />}
            </div>
            <div className="flex items-center justify-between bg-primary text-primary-foreground px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('batches.grandTotal')}</span>
              <span className="text-sm font-bold tabular-nums">{currency} {fmt(order.grandTotal)}</span>
            </div>
          </div>

          {(order.orderDate || order.deliveryDate || order.taxInvoiceId) && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2.5 space-y-0.5">
                {order.orderDate && <Row label={t('batches.orderDate')} value={fmtDate(order.orderDate)} />}
                {order.deliveryDate && <Row label={t('batches.deliveryDate')} value={fmtDate(order.deliveryDate)} />}
                {order.taxInvoiceId && <Row label={t('batches.taxInvoiceId')} value={order.taxInvoiceId} />}
              </div>
            </div>
          )}

          {hasDocuments && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.feedOrderDetail.documents')}
              </div>
              <div className="divide-y">
                {taxInvoiceDocs.map((doc) => <DocRow key={doc._id} label={t('batches.feedOrderDetail.taxInvoiceDoc')} doc={doc} />)}
                {transferProofs.map((doc) => <DocRow key={doc._id} label={t('batches.feedOrderDetail.transferProof')} doc={doc} />)}
                {deliveryNoteDocs.map((doc) => <DocRow key={doc._id} label={t('batches.feedOrderDetail.deliveryNoteDoc')} doc={doc} />)}
                <OtherDocsList docs={otherDocs} />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-1 pb-2">
            {t('batches.feedOrderDetail.createdAt')} {fmtDate(order.createdAt)} · {t('batches.feedOrderDetail.updatedAt')} {fmtDate(order.updatedAt)}
          </p>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 justify-between pt-2 border-t px-6 pb-4 shrink-0">
        {invoiceUrl ? (
          <Button variant="outline" asChild>
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" />
              {t('batches.feedOrderDetail.viewInvoice')}
            </a>
          </Button>
        ) : <div />}
        <Button onClick={() => onEdit?.(order)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t('batches.editFeedOrder')}
        </Button>
      </div>
    </div>
  );
}
