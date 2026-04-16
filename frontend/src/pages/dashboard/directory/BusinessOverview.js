import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeftRight, ShoppingCart, DollarSign, Wheat, Egg, FileText, Loader2,
  Building2, MapPin, ExternalLink, ContactRound, Warehouse, Scale,
} from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import TransferRow from '@/components/rows/TransferRow';
import SaleRow from '@/components/rows/SaleRow';
import ExpenseRow from '@/components/rows/ExpenseRow';
import TransferSheet from '@/components/TransferSheet';
import TransferDetailSheet from '@/components/TransferDetailSheet';
import { DocRow, OtherDocsList } from '@/components/details/shared';
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
  const [bizDocs, setBizDocs] = useState(null);

  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState(formatDateForInput(new Date()));
  const [stmtLoading, setStmtLoading] = useState(false);

  const isTrader = business.businessType !== 'SUPPLIER';

  const transfers = useLocalQuery('transfers', { business: id });
  const allExpenses = useLocalQuery('expenses');
  const allSaleOrders = useLocalQuery('saleOrders');
  const allFeedOrders = useLocalQuery('feedOrders');
  const allSources = useLocalQuery('sources');
  const allFarms = useLocalQuery('farms');

  useEffect(() => {
    let cancelled = false;
    api.get(`/businesses/${id}`).then(({ data }) => {
      if (!cancelled) setBizDocs(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const linkedFarms = useMemo(
    () => allFarms.filter((f) => {
      const bId = typeof f.business === 'object' ? f.business?._id : f.business;
      return bId === id;
    }),
    [allFarms, id],
  );

  const relatedExpenses = useMemo(
    () => allExpenses.filter((e) => {
      const tc = typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany;
      return tc === id;
    }),
    [allExpenses, id],
  );

  const relatedSales = useMemo(
    () => allSaleOrders.filter((s) => {
      const c = typeof s.customer === 'object' ? s.customer?._id : s.customer;
      return c === id;
    }),
    [allSaleOrders, id],
  );

  const relatedFeedOrders = useMemo(
    () => allFeedOrders.filter((f) => {
      const fc = typeof f.feedCompany === 'object' ? f.feedCompany?._id : f.feedCompany;
      return fc === id;
    }),
    [allFeedOrders, id],
  );

  const relatedSources = useMemo(
    () => allSources.filter((s) => {
      const sf = typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom;
      return sf === id;
    }),
    [allSources, id],
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

  const contacts = business.contacts || [];
  const hasDocuments = bizDocs && (
    bizDocs.logo ||
    bizDocs.trnCertificate ||
    bizDocs.tradeLicense ||
    (bizDocs.otherDocs && bizDocs.otherDocs.length > 0)
  );

  const traderKpis = [
    { label: t('businesses.detail.totalSales'), value: `${currency} ${fmt(totalSales)}`, icon: ShoppingCart, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: t('businesses.detail.totalExpenses'), value: `${currency} ${fmt(totalExpenses)}`, icon: DollarSign, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    { label: t('businesses.detail.totalTransfers'), value: `${currency} ${fmt(totalTransfers)}`, icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    {
      label: `${t('businesses.detail.balance')}${balance > 0 ? ` · ${t('businesses.detail.theyOweYou')}` : balance < 0 ? ` · ${t('businesses.detail.settled')}` : ''}`,
      value: `${currency} ${fmt(Math.abs(balance))}`,
      icon: Scale,
      color: balance > 0 ? 'text-red-600 dark:text-red-400' : balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
      bg: balance > 0 ? 'bg-red-100 dark:bg-red-900/30' : balance < 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted',
    },
  ];

  const supplierKpis = [
    { label: t('businesses.detail.totalPurchases'), value: `${currency} ${fmt(totalPurchases)}`, icon: DollarSign, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    { label: t('businesses.detail.totalTransfers'), value: `${currency} ${fmt(totalTransfers)}`, icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    {
      label: `${t('businesses.detail.balance')}${balance > 0 ? ` · ${t('businesses.detail.youOweThem')}` : balance < 0 ? ` · ${t('businesses.detail.settled')}` : ''}`,
      value: `${currency} ${fmt(Math.abs(balance))}`,
      icon: Scale,
      color: balance > 0 ? 'text-red-600 dark:text-red-400' : balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
      bg: balance > 0 ? 'bg-red-100 dark:bg-red-900/30' : balance < 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted',
    },
  ];

  const kpis = isTrader ? traderKpis : supplierKpis;

  return (
    <>
      {/* KPI Cards */}
      <div className={`grid gap-3 grid-cols-2 ${isTrader ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg} shrink-0`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-lg font-bold tabular-nums truncate">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business Info */}
      <Card className="mt-4">
        <CardContent className="pt-5 pb-4">
          <h3 className="text-sm font-semibold mb-3">{t('businesses.detail.businessInfo', 'Business Info')}</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{t('businesses.businessType')}</p>
                <p className="text-sm font-medium">{isTrader ? t('businesses.trader') : t('businesses.supplier')}</p>
              </div>

              {business.trnNumber && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{t('businesses.trnNumber')}</p>
                  <p className="text-sm font-medium">{business.trnNumber}</p>
                </div>
              )}

              {business.tradeLicenseNumber && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{t('businesses.tradeLicenseNumber')}</p>
                  <p className="text-sm font-medium">{business.tradeLicenseNumber}</p>
                </div>
              )}

              {business.address?.formattedAddress && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{t('businesses.addressSection')}</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm truncate">{business.address.formattedAddress}</p>
                  </div>
                  {business.address?.lat != null && business.address?.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${business.address.lat},${business.address.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('businesses.detail.openInMaps', 'Open in Maps')}
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Associated contacts */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('businesses.detail.associatedContacts', 'Associated Contacts')}</p>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('businesses.detail.noContacts', 'No contacts linked')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {contacts.map((c) => {
                      const contact = typeof c === 'object' ? c : null;
                      if (!contact) return null;
                      return (
                        <div key={contact._id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <ContactRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {contact.firstName} {contact.lastName}
                            </span>
                            {contact.email && (
                              <span className="text-xs text-muted-foreground truncate block">{contact.email}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Linked farms */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('businesses.detail.linkedFarms', 'Linked Farms')}</p>
                {linkedFarms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('businesses.detail.noFarms', 'No farms linked')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedFarms.map((farm) => (
                      <button
                        key={farm._id}
                        onClick={() => navigate(`/dashboard/directory/farms/${farm._id}`)}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 w-full text-left hover:bg-muted/30 transition-colors"
                      >
                        <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium truncate block">{farm.farmName}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {t(`farms.farmTypes.${farm.farmType || 'broiler'}`)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      {hasDocuments && (
        <Card className="mt-4">
          <CardContent className="pt-5 pb-2">
            <h3 className="text-sm font-semibold mb-2">{t('documents.otherDocs', 'Documents')}</h3>
            <div className="divide-y">
              {bizDocs.logo && <DocRow label={t('businesses.logo')} doc={bizDocs.logo} />}
              {bizDocs.trnCertificate && <DocRow label={t('businesses.trnCertificate')} doc={bizDocs.trnCertificate} />}
              {bizDocs.tradeLicense && <DocRow label={t('businesses.tradeLicense')} doc={bizDocs.tradeLicense} />}
              <OtherDocsList docs={bizDocs.otherDocs} />
            </div>
          </CardContent>
        </Card>
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
