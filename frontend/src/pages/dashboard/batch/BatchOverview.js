import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Egg, DollarSign, Wheat, ShoppingCart, ChevronsDownUp, ChevronsUpDown, Home } from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import SourceRow from '@/components/rows/SourceRow';
import ExpenseRow from '@/components/rows/ExpenseRow';
import FeedItemRow from '@/components/rows/FeedItemRow';
import SaleRow from '@/components/rows/SaleRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import SourceSheet from '@/components/SourceSheet';
import ExpenseSheet from '@/components/ExpenseSheet';
import FeedOrderSheet from '@/components/FeedOrderSheet';
import SaleOrderSheet from '@/components/SaleOrderSheet';
import useLocalQuery from '@/hooks/useLocalQuery';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BatchOverview() {
  const { id } = useParams();
  const { batch } = useOutletContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [feedOrderSheetOpen, setFeedOrderSheetOpen] = useState(false);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);

  const sources = useLocalQuery('sources', { batch: id });
  const expenses = useLocalQuery('expenses', { batch: id });
  const feedOrders = useLocalQuery('feedOrders', { batch: id });
  const saleOrders = useLocalQuery('saleOrders', { batch: id });

  const totalSourceChicks = useMemo(() => sources.reduce((s, x) => s + (x.totalChicks || 0), 0), [sources]);
  const totalSourceCost = useMemo(() => sources.reduce((s, x) => s + (x.grandTotal || 0), 0), [sources]);
  const totalExpenses = useMemo(() => expenses.reduce((s, x) => s + (x.totalAmount || 0), 0), [expenses]);
  const totalFeedCost = useMemo(() => feedOrders.reduce((s, x) => s + (x.grandTotal || 0), 0), [feedOrders]);
  const totalRevenue = useMemo(() => saleOrders.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0), [saleOrders]);
  const totalSaleChickens = useMemo(() => saleOrders.reduce((s, x) => {
    return s + (x.counts?.chickensSent || 0) + (x.live?.birdCount || 0);
  }, 0), [saleOrders]);
  const totalSaleTrucks = useMemo(() => saleOrders.reduce((s, x) => s + (x.transport?.truckCount || 0), 0), [saleOrders]);
  const netProfit = totalRevenue - totalExpenses;

  const sortedExpenseCategories = useMemo(() => {
    const groups = {};
    expenses.forEach((e) => {
      const cat = e.category || 'OTHER';
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(e);
      groups[cat].total += e.totalAmount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) =>
      t(`batches.expenseCategories.${a}`).localeCompare(t(`batches.expenseCategories.${b}`)),
    );
  }, [expenses, t]);

  const catStorageKey = `expense-cats-${id}`;
  const [categoryOpen, setCategoryOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(catStorageKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(categoryOpen).length > 0) {
      localStorage.setItem(catStorageKey, JSON.stringify(categoryOpen));
    }
  }, [categoryOpen, catStorageKey]);

  const toggleCategory = (cat) => setCategoryOpen((prev) => ({ ...prev, [cat]: !(prev[cat] ?? true) }));
  const allCategoriesExpanded = sortedExpenseCategories.every(([cat]) => categoryOpen[cat] ?? true);
  const toggleAllCategories = () => {
    const next = {};
    sortedExpenseCategories.forEach(([cat]) => { next[cat] = !allCategoriesExpanded; });
    setCategoryOpen(next);
  };

  const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };

  const { sortedFeedTypes, totalFeedKg } = useMemo(() => {
    const groups = {};
    let kg = 0;
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const itemKg = (item.bags || 0) * (item.quantitySize || 50);
        const itemCost = (item.bags || 0) * (item.pricePerBag || 0);
        if (!groups[type]) groups[type] = { items: [], totalKg: 0, totalCost: 0 };
        groups[type].items.push({
          ...item,
          orderDate: order.orderDate,
          companyName: order.feedCompany?.companyName,
          orderId: order._id,
        });
        groups[type].totalKg += itemKg;
        groups[type].totalCost += itemCost;
        kg += itemKg;
      });
    });
    const sorted = Object.entries(groups).sort(
      ([a], [b]) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99),
    );
    sorted.forEach(([, g]) => g.items.sort((a, b) => new Date(a.orderDate || 0) - new Date(b.orderDate || 0)));
    return { sortedFeedTypes: sorted, totalFeedKg: kg };
  }, [feedOrders]);

  const feedCatStorageKey = `feed-cats-${id}`;
  const [feedCatOpen, setFeedCatOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(feedCatStorageKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(feedCatOpen).length > 0) {
      localStorage.setItem(feedCatStorageKey, JSON.stringify(feedCatOpen));
    }
  }, [feedCatOpen, feedCatStorageKey]);

  const toggleFeedCat = (cat) => setFeedCatOpen((prev) => ({ ...prev, [cat]: !(prev[cat] ?? true) }));
  const allFeedCatsExpanded = sortedFeedTypes.every(([cat]) => feedCatOpen[cat] ?? true);
  const toggleAllFeedCats = () => {
    const next = {};
    sortedFeedTypes.forEach(([cat]) => { next[cat] = !allFeedCatsExpanded; });
    setFeedCatOpen(next);
  };

  const sortedSaleDates = useMemo(() => {
    const groups = {};
    saleOrders.forEach((sale) => {
      const key = sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 10) : 'no-date';
      if (!groups[key]) groups[key] = { items: [], revenue: 0, chickens: 0, trucks: 0 };
      groups[key].items.push(sale);
      groups[key].revenue += sale.totals?.grandTotal || 0;
      groups[key].chickens += (sale.counts?.chickensSent || 0) + (sale.live?.birdCount || 0);
      groups[key].trucks += sale.transport?.truckCount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [saleOrders]);

  const saleDateStorageKey = `sale-dates-${id}`;
  const [saleDateOpen, setSaleDateOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(saleDateStorageKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(saleDateOpen).length > 0) {
      localStorage.setItem(saleDateStorageKey, JSON.stringify(saleDateOpen));
    }
  }, [saleDateOpen, saleDateStorageKey]);

  const toggleSaleDate = (key) => setSaleDateOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  const allSaleDatesExpanded = sortedSaleDates.every(([key]) => saleDateOpen[key] ?? true);
  const toggleAllSaleDates = () => {
    const next = {};
    sortedSaleDates.forEach(([key]) => { next[key] = !allSaleDatesExpanded; });
    setSaleDateOpen(next);
  };

  const fmtDateLabel = (key) => {
    if (key === 'no-date') return t('common.noDate', 'No Date');
    return new Date(key + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSourceChicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t('batches.totalChicksReceived')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{sources.length}</div>
            <p className="text-xs text-muted-foreground">{t('batches.sourceEntries')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fmt(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{t('batches.totalCost')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fmt(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{t('batches.totalRevenue')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${netProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {fmt(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">{t('batches.netProfit', 'Net Profit')}</p>
          </CardContent>
        </Card>
      </div>

      {batch?.houses?.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('batches.housesBreakdown', 'Houses')}</span>
            <span className="text-xs text-muted-foreground">
              ({batch.houses.reduce((s, h) => s + (h.quantity || 0), 0).toLocaleString()} {t('farms.birds', 'birds')})
            </span>
          </div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {batch.houses.map((entry, i) => {
              const house = entry.house;
              const name = typeof house === 'object' ? house?.name : null;
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Home className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{name || t('batches.house', 'House')}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{(entry.quantity || 0).toLocaleString()} {t('farms.birds', 'birds')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        {/* Column 1: Sources */}
        <div className="space-y-4">
          <CollapsibleSection
            variant="sources"
            title={t('batches.sourcesTab')}
            icon={Egg}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalSourceCost)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalSourceChicks.toLocaleString()} {t('batches.chicks', 'chicks')}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{sources.length}</span>
              </span>
            }
            expandTo={`/dashboard/batches/${id}/sources`}
            onAdd={() => setSourceSheetOpen(true)}
            persistKey={`batch-${id}-sources`}
            items={sources}
            renderItem={(source) => (
              <SourceRow
                key={source._id}
                source={source}
                onClick={() => navigate(`/dashboard/batches/${id}/sources/${source._id}`)}
              />
            )}
          />

          <CollapsibleSection
            variant="feedOrders"
            title={t('batches.feedOrdersTab')}
            icon={Wheat}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalFeedCost)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalFeedKg.toLocaleString()} KG</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{feedOrders.length}</span>
                {sortedFeedTypes.length > 1 && (
                  <>
                    <span className="w-px self-stretch bg-border" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleAllFeedCats}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllFeedCats(); } }}
                      className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                    >
                      {allFeedCatsExpanded
                        ? <ChevronsDownUp className="h-2.5 w-2.5" />
                        : <ChevronsUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </>
                )}
              </span>
            }
            expandTo={`/dashboard/batches/${id}/feed-orders`}
            onAdd={() => setFeedOrderSheetOpen(true)}
            persistKey={`batch-${id}-feedOrders`}
          >
            {sortedFeedTypes.map(([type, { items, totalKg, totalCost }]) => (
              <ExpenseCategoryGroup
                key={type}
                label={t(`feed.feedTypes.${type}`)}
                pills={[
                  { value: fmt(totalCost) },
                  { value: `${totalKg.toLocaleString()} KG` },
                  { value: items.length },
                ]}
                open={feedCatOpen[type] ?? true}
                onToggle={() => toggleFeedCat(type)}
              >
                {items.map((item, i) => (
                  <FeedItemRow
                    key={item._id || i}
                    item={item}
                    onClick={() => navigate(`/dashboard/batches/${id}/feed-orders/${item.orderId}`)}
                  />
                ))}
              </ExpenseCategoryGroup>
            ))}
          </CollapsibleSection>
        </div>

        {/* Column 2: Expenses (grouped) */}
        <div className="space-y-4">
          <CollapsibleSection
            variant="expenses"
            title={t('batches.expensesTab')}
            icon={DollarSign}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalExpenses)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{expenses.length}</span>
                {sortedExpenseCategories.length > 1 && (
                  <>
                    <span className="w-px self-stretch bg-border" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleAllCategories}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllCategories(); } }}
                      className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                    >
                      {allCategoriesExpanded
                        ? <ChevronsDownUp className="h-2.5 w-2.5" />
                        : <ChevronsUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </>
                )}
              </span>
            }
            expandTo={`/dashboard/batches/${id}/expenses`}
            onAdd={() => setExpenseSheetOpen(true)}
            persistKey={`batch-${id}-expenses`}
          >
            <div>
              {sortedExpenseCategories.map(([category, { items, total }]) => (
                <ExpenseCategoryGroup
                  key={category}
                  label={t(`batches.expenseCategories.${category}`)}
                  total={total}
                  count={items.length}
                  open={categoryOpen[category] ?? true}
                  onToggle={() => toggleCategory(category)}
                >
                  {items.map((expense) => (
                    <ExpenseRow
                      key={expense._id}
                      expense={expense}
                      categoryLabel={t(`batches.expenseCategories.${expense.category}`)}
                      onClick={() => navigate(`/dashboard/batches/${id}/expenses/${expense._id}`)}
                    />
                  ))}
                </ExpenseCategoryGroup>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        {/* Column 3: Sales */}
        <div className="space-y-4">
          <CollapsibleSection
            variant="sales"
            title={t('batches.salesTab')}
            icon={ShoppingCart}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalRevenue)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalSaleChickens.toLocaleString()} {t('batches.birds', 'birds')}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalSaleTrucks} {t('batches.trucks', 'trucks')}</span>
                {sortedSaleDates.length > 1 && (
                  <>
                    <span className="w-px self-stretch bg-border" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleAllSaleDates}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllSaleDates(); } }}
                      className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                    >
                      {allSaleDatesExpanded
                        ? <ChevronsDownUp className="h-2.5 w-2.5" />
                        : <ChevronsUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </>
                )}
              </span>
            }
            expandTo={`/dashboard/batches/${id}/sales`}
            onAdd={() => setSaleSheetOpen(true)}
            persistKey={`batch-${id}-sales`}
          >
            {sortedSaleDates.map(([dateKey, { items, revenue, chickens, trucks }]) => (
              <ExpenseCategoryGroup
                key={dateKey}
                label={fmtDateLabel(dateKey)}
                pills={[
                  { value: fmt(revenue) },
                  { value: `${chickens.toLocaleString()} ${t('batches.birds', 'birds')}` },
                  { value: `${trucks} ${t('batches.trucks', 'trucks')}` },
                ]}
                open={saleDateOpen[dateKey] ?? true}
                onToggle={() => toggleSaleDate(dateKey)}
              >
                {items.map((sale) => (
                  <SaleRow
                    key={sale._id}
                    sale={sale}
                    onClick={() => navigate(`/dashboard/batches/${id}/sales/${sale._id}`)}
                  />
                ))}
              </ExpenseCategoryGroup>
            ))}
          </CollapsibleSection>
        </div>
      </div>

      <SourceSheet
        open={sourceSheetOpen}
        onOpenChange={(open) => { if (!open) setSourceSheetOpen(false); }}
        batchId={id}
        editingSource={null}
        onSuccess={() => {}}
      />
      <ExpenseSheet
        open={expenseSheetOpen}
        onOpenChange={(open) => { if (!open) setExpenseSheetOpen(false); }}
        batchId={id}
        editingExpense={null}
        onSuccess={() => {}}
      />
      <FeedOrderSheet
        open={feedOrderSheetOpen}
        onOpenChange={(open) => { if (!open) setFeedOrderSheetOpen(false); }}
        batchId={id}
        editingFeedOrder={null}
        onSuccess={() => {}}
      />
      <SaleOrderSheet
        open={saleSheetOpen}
        onOpenChange={(open) => { if (!open) setSaleSheetOpen(false); }}
        batchId={id}
        editingSaleOrder={null}
      />
    </>
  );
}
