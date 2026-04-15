import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, ChevronRight, Link2, Receipt } from 'lucide-react';
import db from '@/lib/db';
import { fmt, fmtDate, Row, DocRow, OtherDocsList, CARD_CLS, PARTY_CLS, LINK_ROW_CLS, LABEL_CLS } from './shared';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';

export default function ExpenseDetail({ expenseId, onEdit, onViewSource, onViewFeedOrder, onViewSaleOrder, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const expense = useLocalRecord('expenses', expenseId);
  const accounting = useSettings('accounting');

  const rawReceipts = (expense?.receipts || []).filter(Boolean);
  const rawTransferProofs = (expense?.transferProofs || []).filter(Boolean);
  const rawOtherDocs = (expense?.otherDocs || []).filter(Boolean);

  const docFingerprint = JSON.stringify({ r: rawReceipts, t: rawTransferProofs, o: rawOtherDocs });
  const resolvedDocs = useLiveQuery(async () => {
    const resolveMedia = async (doc) => {
      if (typeof doc === 'object' && doc.url) return doc;
      const id = typeof doc === 'string' ? doc : doc?._id;
      if (!id) return null;
      return (await db.media.get(id)) || null;
    };
    const [rec, tp, oth] = await Promise.all([
      Promise.all(rawReceipts.map(resolveMedia)),
      Promise.all(rawTransferProofs.map(resolveMedia)),
      Promise.all(rawOtherDocs.map(async (doc) => {
        if (typeof doc === 'object' && doc.media_id) {
          const resolved = await resolveMedia(doc.media_id);
          return resolved ? { ...doc, media_id: resolved } : doc;
        }
        return doc;
      })),
    ]);
    return {
      receipts: rec.filter(Boolean),
      transferProofs: tp.filter(Boolean),
      otherDocs: oth.filter(Boolean),
    };
  }, [docFingerprint]) ?? { receipts: [], transferProofs: [], otherDocs: [] };

  if (!expense) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const currency = accounting?.currency || 'AED';
  const companyId = typeof expense.tradingCompany === 'object' ? expense.tradingCompany?._id : expense.tradingCompany;
  const hasVat = (expense.taxableAmount || 0) > 0;
  const isLinked = !!(expense.source || expense.feedOrder || expense.saleOrder);
  const sourceId = typeof expense.source === 'object' ? expense.source?._id : expense.source;
  const feedOrderId = typeof expense.feedOrder === 'object' ? expense.feedOrder?._id : expense.feedOrder;
  const saleOrderId = typeof expense.saleOrder === 'object' ? expense.saleOrder?._id : expense.saleOrder;
  const { receipts, transferProofs, otherDocs } = resolvedDocs;
  const hasDocuments = receipts.length > 0 || transferProofs.length > 0 || otherDocs.length > 0;

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
                {t(`batches.expenseCategories.${expense.category}`)}
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                {t(`batches.invoiceTypes.${expense.invoiceType}`)}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold truncate">
              {expense.description || t(`batches.expenseCategories.${expense.category}`)}
            </h3>
            <p className="text-xs text-muted-foreground">{fmtDate(expense.expenseDate)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            {!isLinked && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(expense)} title={t('common.edit')}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {expense.tradingCompany?.companyName && (
            <button type="button" onClick={handleNavBusiness} className={PARTY_CLS}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('batches.tradingCompany')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{expense.tradingCompany.companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          )}

          {expense.invoiceId && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2.5 space-y-0.5">
                <Row label={t('batches.invoiceIdLabel')} value={expense.invoiceId} />
              </div>
            </div>
          )}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('batches.grossAmount')} value={`${currency} ${fmt(expense.grossAmount)}`} bold />
              {hasVat && <Row label={t('batches.taxableAmount')} value={`${currency} ${fmt(expense.taxableAmount)}`} />}
            </div>
            <div className="flex items-center justify-between bg-primary text-primary-foreground px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('batches.totalAmount')}</span>
              <span className="text-sm font-bold tabular-nums">{currency} {fmt(expense.totalAmount)}</span>
            </div>
          </div>

          {isLinked && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.expenseDetail.linkedEntity')}
              </div>
              <div className="divide-y">
                {sourceId && (
                  <button type="button" onClick={() => onViewSource?.(sourceId)} className={LINK_ROW_CLS}>
                    <span className={LABEL_CLS}>{t('batches.linkedToSource')}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                {feedOrderId && (
                  <button type="button" onClick={() => onViewFeedOrder?.(feedOrderId)} className={LINK_ROW_CLS}>
                    <span className={LABEL_CLS}>{t('batches.linkedToFeedOrder')}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                {saleOrderId && (
                  <button type="button" onClick={() => onViewSaleOrder?.(saleOrderId)} className={LINK_ROW_CLS}>
                    <span className={LABEL_CLS}>{t('batches.linkedToSaleOrder')}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('batches.expenseDate')} value={fmtDate(expense.expenseDate)} />
            </div>
          </div>

          {expense.description && (
            <div className="rounded-md bg-muted/30 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('batches.expenseDescription')}</p>
              <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
            </div>
          )}

          {hasDocuments && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.expenseDetail.documents')}
              </div>
              <div className="divide-y">
                {receipts.map((doc) => <DocRow key={doc._id} label={t('batches.receipt')} doc={doc} />)}
                {transferProofs.map((doc) => <DocRow key={doc._id} label={t('batches.transferProof')} doc={doc} />)}
                <OtherDocsList docs={otherDocs} />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-1 pb-2">
            {t('batches.expenseDetail.createdAt')} {fmtDate(expense.createdAt)} · {t('batches.expenseDetail.updatedAt')} {fmtDate(expense.updatedAt)}
          </p>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 justify-end pt-2 border-t px-6 pb-4 shrink-0">
        {isLinked ? (
          <>
            {sourceId && (
              <Button variant="outline" onClick={() => onViewSource?.(sourceId)}>
                <Link2 className="mr-2 h-4 w-4" />
                {t('batches.editSourceEntry')}
              </Button>
            )}
            {feedOrderId && (
              <Button variant="outline" onClick={() => onViewFeedOrder?.(feedOrderId)}>
                <Link2 className="mr-2 h-4 w-4" />
                {t('batches.editFeedOrderEntry')}
              </Button>
            )}
            {saleOrderId && (
              <Button variant="outline" onClick={() => onViewSaleOrder?.(saleOrderId)}>
                <Link2 className="mr-2 h-4 w-4" />
                {t('batches.editSaleOrderEntry')}
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => onEdit?.(expense)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('batches.editExpense')}
          </Button>
        )}
      </div>
    </div>
  );
}
