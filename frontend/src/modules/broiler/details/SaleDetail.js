import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, FileText, ChevronRight, ChevronDown, TrendingUp, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import db from '@/lib/db';
import { fmt, fmtDate, Row, DocRow, OtherDocsList, CARD_CLS, PARTY_CLS, LINK_ROW_CLS, VALUE_CLS, LABEL_CLS, TABLE_HEADER_CLS, TABLE_ROW_CLS } from './shared';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';

export default function SaleDetail({ saleId, onEdit, onViewExpense, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [countsOpen, setCountsOpen] = useState(false);

  const sale = useLocalRecord('saleOrders', saleId);
  const accounting = useSettings('accounting');
  const relatedExpenseId = sale?.slaughter?.relatedExpense
    ? (sale.slaughter.relatedExpense?._id ?? sale.slaughter.relatedExpense)
    : null;
  const relatedExpense = useLocalRecord('expenses', relatedExpenseId);

  const rawInvoiceDocs = (sale?.invoiceDocs || []).filter(Boolean);
  const rawTransferProofs = (sale?.transferProofs || []).filter(Boolean);
  const rawReportDocs = (sale?.slaughter?.reportDocs || []).filter(Boolean);
  const rawOtherDocs = (sale?.otherDocs || []).filter(Boolean);

  const docFingerprint = JSON.stringify({ i: rawInvoiceDocs, t: rawTransferProofs, r: rawReportDocs, o: rawOtherDocs });
  const resolvedDocs = useLiveQuery(async () => {
    const resolveMedia = async (doc) => {
      if (typeof doc === 'object' && doc.url) return doc;
      const id = typeof doc === 'string' ? doc : doc?._id;
      if (!id) return null;
      return (await db.media.get(id)) || null;
    };
    const [inv, tp, rpt, oth] = await Promise.all([
      Promise.all(rawInvoiceDocs.map(resolveMedia)),
      Promise.all(rawTransferProofs.map(resolveMedia)),
      Promise.all(rawReportDocs.map(resolveMedia)),
      Promise.all(rawOtherDocs.map(async (doc) => {
        if (typeof doc === 'object' && doc.media_id) {
          const resolved = await resolveMedia(doc.media_id);
          return resolved ? { ...doc, media_id: resolved } : doc;
        }
        return doc;
      })),
    ]);
    return {
      invoiceDocs: inv.filter(Boolean),
      transferProofs: tp.filter(Boolean),
      reportDocs: rpt.filter(Boolean),
      otherDocs: oth.filter(Boolean),
    };
  }, [docFingerprint]) ?? { invoiceDocs: [], transferProofs: [], reportDocs: [], otherDocs: [] };

  if (!sale) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const currency = accounting?.currency || 'AED';
  const isSlaughtered = sale.saleMethod === 'SLAUGHTERED';
  const isLiveByPiece = sale.saleMethod === 'LIVE_BY_PIECE';
  const isLiveByWeight = sale.saleMethod === 'LIVE_BY_WEIGHT';
  const isLive = isLiveByPiece || isLiveByWeight;
  const showVat = sale.invoiceType === 'VAT_INVOICE';

  const sl = sale.slaughter || {};
  const cn_ = sale.counts || {};
  const tr = sale.transport || {};
  const totals = sale.totals || {};
  const lv = sale.live || {};

  const losses = (cn_.condemnation || 0) + (cn_.deathOnArrival || 0) + (cn_.rejections || 0) + (cn_.shortage || 0);
  const netProcessed = (cn_.chickensSent || 0) - losses;
  const wholeChickenCount = Math.max(0, netProcessed - (cn_.bGrade || 0));

  const filledPortions = (sale.portions || []).filter((p) => p.quantity > 0);

  const processingCost = isSlaughtered ? (sl.processingCost || 0) : 0;
  const netRevenue = (totals.grandTotal || 0) - processingCost;
  const chickenCount = isSlaughtered ? wholeChickenCount : (lv.birdCount || 0);
  const profitPerChicken = chickenCount > 0 ? netRevenue / chickenCount : 0;

  const customerId = typeof sale.customer === 'object' ? sale.customer?._id : sale.customer;
  const slaughterhouseId = typeof sl.slaughterhouse === 'object' ? sl.slaughterhouse?._id : sl.slaughterhouse;
  const sameParty = isSlaughtered && slaughterhouseId && slaughterhouseId === customerId;
  const hasDistinctSlaughterhouse = isSlaughtered && sl.slaughterhouse?.companyName && !sameParty;

  const { invoiceDocs, transferProofs, reportDocs, otherDocs } = resolvedDocs;
  const invoiceUrl = invoiceDocs?.[0]?.url || null;

  const saleDocIds = new Set([
    ...invoiceDocs, ...transferProofs, ...reportDocs,
  ].map((d) => d?._id).filter(Boolean));

  const expenseReceipts = (relatedExpense?.receipts || []).filter((d) => d && !saleDocIds.has(d._id));
  const expenseTransferProofs = (relatedExpense?.transferProofs || []).filter((d) => d && !saleDocIds.has(d._id));
  const expenseOtherDocs = (relatedExpense?.otherDocs || []).filter(Boolean);
  const hasExpenseDocs = expenseReceipts.length > 0 || expenseTransferProofs.length > 0 || expenseOtherDocs.length > 0;

  const handleNavBusiness = (id) => {
    onClose?.();
    navigate(`/dashboard/directory/businesses/${id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {sale.invoiceType === 'VAT_INVOICE' ? t('batches.saleInvoiceTypes.VAT_INVOICE') : t('batches.saleInvoiceTypes.CASH_MEMO')}
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {t(`batches.saleMethods.${sale.saleMethod}`)}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold truncate">{sale.saleNumber || '—'}</h3>
            <p className="text-xs text-muted-foreground">{fmtDate(sale.saleDate)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            {invoiceUrl && (
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" title={t('batches.viewInvoice')}>
                  <FileText className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(sale)} title={t('common.edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {sale.customer?.companyName && (
            <button type="button" onClick={() => handleNavBusiness(customerId)} className={PARTY_CLS}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {sameParty ? `${t('batches.saleDetail.billTo')} / ${t('batches.saleDetail.slaughterhouse')}` : t('batches.saleDetail.billTo')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{sale.customer.companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          )}

          {hasDistinctSlaughterhouse && (
            <button type="button" onClick={() => handleNavBusiness(slaughterhouseId)} className={PARTY_CLS}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('batches.saleDetail.slaughterhouse')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{sl.slaughterhouse.companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          )}

          {isSlaughtered && cn_.chickensSent > 0 && (
            <div className={CARD_CLS}>
              <button type="button" onClick={() => setCountsOpen((v) => !v)} className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !countsOpen && '-rotate-90')} />
                  {cn_.chickensSent.toLocaleString('en-US')} {t('batches.saleForm.chickensSent').toLowerCase()}
                  {losses > 0 && <span className="text-red-500 dark:text-red-400">(-{losses})</span>}
                </span>
                <span className="text-sm font-semibold text-primary">{wholeChickenCount.toLocaleString('en-US')} {t('batches.saleDetail.gradeA')}</span>
              </button>
              {countsOpen && (
                <div className="px-3 pb-2.5 pt-1 space-y-0.5 border-t">
                  <Row label={t('batches.saleForm.chickensSent')} value={(cn_.chickensSent || 0).toLocaleString('en-US')} bold />
                  {cn_.condemnation > 0 && <Row label={t('batches.saleForm.condemnation')} value={`-${cn_.condemnation.toLocaleString('en-US')}`} negative />}
                  {cn_.deathOnArrival > 0 && <Row label={t('batches.saleForm.deathOnArrival')} value={`-${cn_.deathOnArrival.toLocaleString('en-US')}`} negative />}
                  {cn_.rejections > 0 && <Row label={t('batches.saleForm.rejections')} value={`-${cn_.rejections.toLocaleString('en-US')}`} negative />}
                  {cn_.shortage > 0 && <Row label={t('batches.saleForm.shortage')} value={`-${cn_.shortage.toLocaleString('en-US')}`} negative />}
                  {cn_.bGrade > 0 && <Row label={t('batches.saleForm.bGradeCount')} value={`-${cn_.bGrade.toLocaleString('en-US')}`} negative />}
                  <Separator className="my-1" />
                  <Row label={t('batches.saleForm.netProcessed')} value={netProcessed.toLocaleString('en-US')} bold />
                  <Row label={t('batches.saleDetail.wholeChickenGradeA')} value={wholeChickenCount.toLocaleString('en-US')} bold highlight />
                </div>
              )}
            </div>
          )}

          {isSlaughtered && sale.wholeChickenItems?.length > 0 && (
            <div className={CARD_CLS}>
              <div className={cn('grid grid-cols-[1fr_62px_62px_74px] gap-0', TABLE_HEADER_CLS)}>
                <span>{t('batches.saleForm.description')}</span>
                <span className="text-right">{t('batches.saleDetail.kgShort')}</span>
                <span className="text-right">{t('batches.saleDetail.rateShort')}</span>
                <span className="text-right">{t('batches.saleForm.amount')}</span>
              </div>
              {sale.wholeChickenItems.map((item, i) => (
                <div key={i} className={cn('grid grid-cols-[1fr_62px_62px_74px] gap-0', TABLE_ROW_CLS, i % 2 === 1 && 'bg-muted/30')}>
                  <span className="truncate">{item.description || t('batches.saleForm.wholeChickensDefault')}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(item.weightKg)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(item.ratePerKg)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'font-medium')}>{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {isSlaughtered && filledPortions.length > 0 && (
            <div className={CARD_CLS}>
              <div className={cn('grid grid-cols-[1fr_50px_55px_74px] gap-0', TABLE_HEADER_CLS)}>
                <span>{t('batches.saleDetail.portions')}</span>
                <span className="text-right">{t('batches.saleDetail.qtyShort')}</span>
                <span className="text-right">{t('batches.saleDetail.rateShort')}</span>
                <span className="text-right">{t('batches.saleForm.amount')}</span>
              </div>
              {filledPortions.map((p, i) => (
                <div key={p.partType} className={cn('grid grid-cols-[1fr_50px_55px_74px] gap-0', TABLE_ROW_CLS, i % 2 === 1 && 'bg-muted/30')}>
                  <span>{t(`settings.portionLabels.${p.partType}`)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{p.quantity.toLocaleString('en-US')}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(p.rate)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'font-medium')}>{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {isLive && (
            <div className={CARD_CLS}>
              <div className={cn('grid grid-cols-[1fr_62px_62px_74px] gap-0', TABLE_HEADER_CLS)}>
                <span>{t('batches.saleForm.description')}</span>
                <span className="text-right">{isLiveByPiece ? t('batches.saleDetail.qtyShort') : t('batches.saleDetail.kgShort')}</span>
                <span className="text-right">{t('batches.saleDetail.rateShort')}</span>
                <span className="text-right">{t('batches.saleForm.amount')}</span>
              </div>
              {isLiveByPiece && (
                <div className={cn('grid grid-cols-[1fr_62px_62px_74px] gap-0', TABLE_ROW_CLS)}>
                  <span>{t('batches.saleForm.liveWeightDefault')}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{(lv.birdCount || 0).toLocaleString('en-US')}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(lv.ratePerBird)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'font-medium')}>{fmt((lv.birdCount || 0) * (lv.ratePerBird || 0))}</span>
                </div>
              )}
              {isLiveByWeight && lv.weightItems?.map((item, i) => (
                <div key={i} className={cn('grid grid-cols-[1fr_62px_62px_74px] gap-0', TABLE_ROW_CLS, i % 2 === 1 && 'bg-muted/30')}>
                  <span className="truncate">{item.description || t('batches.saleForm.liveWeightDefault')}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(item.weightKg)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'text-muted-foreground')}>{fmt(item.ratePerKg)}</span>
                  <span className={cn('text-right', VALUE_CLS, 'font-medium')}>{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('batches.saleForm.grossSales')} value={`${currency} ${fmt(totals.grossSales)}`} bold />
              {(totals.transportDeduction || 0) > 0 && (
                <Row label={`${t('batches.saleForm.transportDeduction')} (${tr.truckCount} × ${fmt(tr.ratePerTruck)})`} value={`-${currency} ${fmt(totals.transportDeduction)}`} negative />
              )}
              {sale.discounts?.map((d, i) => (
                <Row key={i} label={d.description || t('batches.saleForm.discountsSection')} value={`-${currency} ${fmt(d.amount)}`} negative />
              ))}
              {showVat && (
                <>
                  <Separator className="my-1.5" />
                  <Row label={t('batches.saleForm.invoiceTotal')} value={`${currency} ${fmt(totals.subtotal)}`} bold />
                  <Row label={t('batches.saleForm.vat')} value={`${currency} ${fmt(totals.vat)}`} />
                </>
              )}
            </div>
            <div className="flex items-center justify-between bg-primary text-primary-foreground px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('batches.saleForm.grandTotal')}</span>
              <span className="text-sm font-bold tabular-nums">{currency} {fmt(totals.grandTotal)}</span>
            </div>
          </div>

          {processingCost > 0 && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.saleForm.farmersView')}
              </div>
              <div className="px-3 py-2.5 space-y-0.5">
                <Row label={t('batches.saleForm.grandTotal')} value={`${currency} ${fmt(totals.grandTotal)}`} />
                <Row label={t('batches.saleForm.processingFee')} value={`-${currency} ${fmt(processingCost)}`} negative />
                <Separator className="my-1.5" />
                <Row label={t('batches.saleForm.netRevenue')} value={`${currency} ${fmt(netRevenue)}`} bold highlight />
                {chickenCount > 0 && <Row label={t('batches.saleDetail.profitPerChicken')} value={`${currency} ${fmt(profitPerChicken)}`} />}
              </div>
              {sl.relatedExpense && (
                <div className="border-t">
                  <button type="button" onClick={() => onViewExpense?.(sl.relatedExpense?._id ?? sl.relatedExpense)} className={LINK_ROW_CLS}>
                    <span className={LABEL_CLS}>{t('batches.saleDetail.viewProcessingExpense')}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          )}

          {(invoiceDocs.length > 0 || transferProofs.length > 0 || reportDocs.length > 0 || otherDocs.length > 0 || hasExpenseDocs) && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.saleDetail.documents')}
              </div>
              <div className="divide-y">
                {invoiceDocs.map((doc, i) => <DocRow key={doc._id || `inv-${i}`} label={t('batches.saleDetail.invoiceDoc')} doc={doc} />)}
                {reportDocs.map((doc, i) => <DocRow key={doc._id || `rpt-${i}`} label={t('batches.saleDetail.processingReport')} doc={doc} />)}
                {transferProofs.map((doc, i) => <DocRow key={doc._id || `tp-${i}`} label={t('batches.saleDetail.transferProof')} doc={doc} />)}
                {expenseReceipts.map((doc, i) => <DocRow key={doc._id || `er-${i}`} label={t('batches.saleDetail.processingReceipt', 'Processing Receipt')} doc={doc} />)}
                {expenseTransferProofs.map((doc, i) => <DocRow key={doc._id || `etp-${i}`} label={t('batches.saleDetail.processingTransferProof', 'Processing Transfer Proof')} doc={doc} />)}
                <OtherDocsList docs={otherDocs} />
                {expenseOtherDocs.length > 0 && <OtherDocsList docs={expenseOtherDocs} />}
              </div>
            </div>
          )}

          {sale.notes && (
            <div className="rounded-md bg-muted/30 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('common.description')}</p>
              <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-1 pb-2">
            {t('batches.saleDetail.createdAt')} {fmtDate(sale.createdAt)} · {t('batches.saleDetail.updatedAt')} {fmtDate(sale.updatedAt)}
          </p>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 justify-between pt-2 border-t px-6 pb-4 shrink-0">
        {invoiceUrl ? (
          <Button variant="outline" asChild>
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" />
              {t('batches.viewInvoice')}
            </a>
          </Button>
        ) : <div />}
        <Button onClick={() => onEdit?.(sale)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t('batches.editSale')}
        </Button>
      </div>
    </div>
  );
}
