import { useState, useMemo } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeftRight, ShoppingCart, DollarSign, Wheat, Egg, FileText, Loader2,
} from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import TransferRow from '@/components/rows/TransferRow';
import SaleRow from '@/components/rows/SaleRow';
import ExpenseRow from '@/components/rows/ExpenseRow';
import TransferSheet from '@/components/TransferSheet';
import TransferDetailSheet from '@/components/TransferDetailSheet';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import api from '@/lib/api';
import { formatDateForInput } from '@/lib/format';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BusinessOverview() {
  const { id } = useParams();
  const { business } = useOutletContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [transferSheetOpen, setTransferSheetOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [viewingTransferId, setViewingTransferId] = useState(null);

  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState(formatDateForInput(new Date()));
  const [stmtLoading, setStmtLoading] = useState(false);

  const isTrader = business.businessType !== 'SUPPLIER';

  const transfers = useLocalQuery('transfers', { business: id });
  const allExpenses = useLocalQuery('expenses');
  const allSaleOrders = useLocalQuery('saleOrders');
  const allFeedOrders = useLocalQuery('feedOrders');
  const allSources = useLocalQuery('sources');

  const relatedExpenses = useMemo(
    () => allExpenses.filter((e) => {
      const tc = typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany;
      return tc === id;
    }),
    [allExpenses, id]
  );

  const relatedSales = useMemo(
    () => allSaleOrders.filter((s) => {
      const c = typeof s.customer === 'object' ? s.customer?._id : s.customer;
      return c === id;
    }),
    [allSaleOrders, id]
  );

  const relatedFeedOrders = useMemo(
    () => allFeedOrders.filter((f) => {
      const fc = typeof f.feedCompany === 'object' ? f.feedCompany?._id : f.feedCompany;
      return fc === id;
    }),
    [allFeedOrders, id]
  );

  const relatedSources = useMemo(
    () => allSources.filter((s) => {
      const sf = typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom;
      return sf === id;
    }),
    [allSources, id]
  );

  const totalTransfers = useMemo(() => transfers.reduce((s, x) => s + (x.amount || 0), 0), [transfers]);
  const totalExpenses = useMemo(() => relatedExpenses.reduce((s, x) => s + (x.totalAmount || 0), 0), [relatedExpenses]);
  const totalSales = useMemo(() => relatedSales.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0), [relatedSales]);
  const totalFeedCost = useMemo(() => relatedFeedOrders.reduce((s, x) => s + (x.grandTotal || 0), 0), [relatedFeedOrders]);
  const totalSourceCost = useMemo(() => relatedSources.reduce((s, x) => s + (x.grandTotal || 0), 0), [relatedSources]);

  const totalPurchases = totalExpenses + totalFeedCost + totalSourceCost;
  const balance = isTrader
    ? totalSales - totalExpenses - totalTransfers
    : totalPurchases - totalTransfers;

  const { mutate: deleteTransfer } = useOfflineMutation('transfers');

  const handleDeleteTransfer = (transfer) => {
    deleteTransfer({ action: 'delete', id: transfer._id }, {
      onSuccess: () => toast({ title: t('transfers.transferDeleted') }),
    });
  };

  const handleGenerateStatement = async () => {
    setStmtLoading(true);
    try {
      const { data } = await api.post(`/businesses/${id}/statement`, {
        dateFrom: stmtFrom || undefined,
        dateTo: stmtTo || undefined,
      });
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
      toast({ title: t('businesses.detail.statementGenerated') });
    } catch {
      toast({ title: t('businesses.detail.statementError'), variant: 'destructive' });
    } finally {
      setStmtLoading(false);
    }
  };

  return (
    <>
      {/* KPI Cards */}
      {isTrader ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fmt(totalSales)}</div>
              <p className="text-xs text-muted-foreground">{t('businesses.detail.totalSales')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fmt(totalExpenses)}</div>
              <p className="text-xs text-muted-foreground">{t('businesses.detail.totalExpenses')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fmt(totalTransfers)}</div>
              <p className="text-xs text-muted-foreground">{t('businesses.detail.totalTransfers')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold ${balance > 0 ? 'text-red-600 dark:text-red-400' : balance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                {fmt(Math.abs(balance))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('businesses.detail.balance')}
                {balance > 0 && ` · ${t('businesses.detail.theyOweYou')}`}
                {balance < 0 && ` · ${t('businesses.detail.settled')}`}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fmt(totalPurchases)}</div>
              <p className="text-xs text-muted-foreground">{t('businesses.detail.totalPurchases')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fmt(totalTransfers)}</div>
              <p className="text-xs text-muted-foreground">{t('businesses.detail.totalTransfers')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold ${balance > 0 ? 'text-red-600 dark:text-red-400' : balance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                {fmt(Math.abs(balance))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('businesses.detail.balance')}
                {balance > 0 && ` · ${t('businesses.detail.youOweThem')}`}
                {balance < 0 && ` · ${t('businesses.detail.settled')}`}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Statement generation */}
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('businesses.detail.generateStatement')}</h3>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('businesses.detail.dateFrom')}</Label>
              <Input
                type="date"
                value={stmtFrom}
                onChange={(e) => setStmtFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('businesses.detail.dateTo')}</Label>
              <Input
                type="date"
                value={stmtTo}
                onChange={(e) => setStmtTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={handleGenerateStatement} disabled={stmtLoading} size="sm">
              {stmtLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {stmtLoading ? t('businesses.detail.generating') : t('businesses.detail.generate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Sections */}
      <div className="space-y-4 mt-4">
        <CollapsibleSection
          variant="sources"
          title={t('businesses.detail.transfers')}
          icon={ArrowLeftRight}
          headerExtra={
            <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
              <span className="px-1.5 py-0">{fmt(totalTransfers)}</span>
              <span className="w-px self-stretch bg-border" />
              <span className="px-1.5 py-0">{transfers.length}</span>
            </span>
          }
          onAdd={() => { setEditingTransfer(null); setTransferSheetOpen(true); }}
          persistKey={`biz-${id}-transfers`}
          items={transfers}
          renderItem={(transfer) => (
            <TransferRow
              key={transfer._id}
              transfer={transfer}
              onClick={() => setViewingTransferId(transfer._id)}
            />
          )}
        />

        {isTrader && (
          <CollapsibleSection
            variant="sales"
            title={t('businesses.detail.relatedSales')}
            icon={ShoppingCart}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalSales)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{relatedSales.length}</span>
              </span>
            }
            expandTo={`/dashboard/directory/businesses/${id}/sales`}
            persistKey={`biz-${id}-sales`}
            items={relatedSales}
            renderItem={(sale) => (
              <SaleRow
                key={sale._id}
                sale={sale}
                onClick={() => navigate(`/dashboard/directory/businesses/${id}/sales/${sale._id}`)}
              />
            )}
          />
        )}

        <CollapsibleSection
          variant="expenses"
          title={t('businesses.detail.relatedExpenses')}
          icon={DollarSign}
          headerExtra={
            <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
              <span className="px-1.5 py-0">{fmt(totalExpenses)}</span>
              <span className="w-px self-stretch bg-border" />
              <span className="px-1.5 py-0">{relatedExpenses.length}</span>
            </span>
          }
          expandTo={`/dashboard/directory/businesses/${id}/expenses`}
          persistKey={`biz-${id}-expenses`}
          items={relatedExpenses}
          renderItem={(expense) => (
            <ExpenseRow
              key={expense._id}
              expense={expense}
              categoryLabel={expense.category}
              onClick={() => navigate(`/dashboard/directory/businesses/${id}/expenses/${expense._id}`)}
            />
          )}
        />

        {relatedFeedOrders.length > 0 && (
          <CollapsibleSection
            variant="feedOrders"
            title={t('businesses.detail.relatedFeedOrders')}
            icon={Wheat}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalFeedCost)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{relatedFeedOrders.length}</span>
              </span>
            }
            expandTo={`/dashboard/directory/businesses/${id}/feed-orders`}
            persistKey={`biz-${id}-feedOrders`}
            items={relatedFeedOrders}
            renderItem={(order) => (
              <div
                key={order._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/directory/businesses/${id}/feed-orders/${order._id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/dashboard/directory/businesses/${id}/feed-orders/${order._id}`); }}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 transition-colors cursor-pointer border-b last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate">{order.feedCompany?.companyName || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <span className="text-sm tabular-nums shrink-0">{fmt(order.grandTotal)}</span>
              </div>
            )}
          />
        )}

        {relatedSources.length > 0 && (
          <CollapsibleSection
            variant="sources"
            title={t('businesses.detail.relatedSourceOrders')}
            icon={Egg}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalSourceCost)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{relatedSources.length}</span>
              </span>
            }
            expandTo={`/dashboard/directory/businesses/${id}/sources`}
            persistKey={`biz-${id}-sources`}
            items={relatedSources}
            renderItem={(source) => (
              <div
                key={source._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/directory/businesses/${id}/sources/${source._id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/dashboard/directory/businesses/${id}/sources/${source._id}`); }}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 transition-colors cursor-pointer border-b last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate">{source.sourceFrom?.companyName || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.invoiceDate ? new Date(source.invoiceDate).toLocaleDateString() : '—'}
                    {source.totalChicks > 0 && ` · ${source.totalChicks.toLocaleString()} chicks`}
                  </p>
                </div>
                <span className="text-sm tabular-nums shrink-0">{fmt(source.grandTotal)}</span>
              </div>
            )}
          />
        )}
      </div>

      <TransferSheet
        open={transferSheetOpen}
        onOpenChange={(o) => { if (!o) { setTransferSheetOpen(false); setEditingTransfer(null); } }}
        editingTransfer={editingTransfer}
        preselectedBusinessId={id}
        onSuccess={() => {}}
      />

      <TransferDetailSheet
        open={!!viewingTransferId}
        onOpenChange={(o) => { if (!o) setViewingTransferId(null); }}
        transferId={viewingTransferId}
        onEdit={(transfer) => {
          setViewingTransferId(null);
          setEditingTransfer(transfer);
          setTransferSheetOpen(true);
        }}
      />
    </>
  );
}
