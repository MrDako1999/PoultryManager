/**
 * BatchDetailPage — orchestrator for a single batch's detail view.
 *
 * DESIGN METHODOLOGY:
 *  This page follows the "orchestrator + entity-sheet" pattern:
 *  - The page fetches list-level data (batch, sources, expenses, feedOrders, saleOrders).
 *  - It renders a header, summary cards, and tab panels that display lists.
 *  - All CRUD *forms* are delegated to self-contained "sheet" components
 *    (SourceSheet, ExpenseSheet, FeedOrderSheet, SaleOrderSheet), each of which
 *    owns its own state, form, guard, mutations, and JSX.
 *  - The page manages only: which sheet is open, which item is being edited,
 *    delete mutations, and cross-sheet coordination callbacks.
 *
 * ADDING A NEW ENTITY TAB:
 *  1. Create a new sheet component following the entity-sheet contract
 *     (see SourceSheet.js header comment).
 *  2. Add a query, open/editing state pair, and delete mutation here.
 *  3. Add a TabsTrigger + TabsContent with list rendering.
 *  4. Render the new sheet and its ConfirmDeleteDialog at the bottom.
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft, Plus, MoreVertical, Pencil, Trash2, Loader2,
  Layers, Egg, DollarSign, Calendar, Warehouse, Link2,
  Wheat, ShoppingCart, FileText, Eye,
} from 'lucide-react';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import SourceSheet from '@/components/SourceSheet';
import ExpenseSheet from '@/components/ExpenseSheet';
import FeedOrderSheet from '@/components/FeedOrderSheet';
import SaleOrderSheet from '@/components/SaleOrderSheet';
import SaleDetailSheet from '@/components/SaleDetailSheet';
import SourceDetailSheet from '@/components/SourceDetailSheet';
import FeedOrderDetailSheet from '@/components/FeedOrderDetailSheet';
import ExpenseDetailSheet from '@/components/ExpenseDetailSheet';
import api from '@/lib/api';
import { STATUS_VARIANTS } from '@/lib/constants';

export default function BatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Sheet orchestration state ───
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [sourceStacked, setSourceStacked] = useState(false);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const [viewingSourceId, setViewingSourceId] = useState(null);

  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);
  const [viewingExpenseId, setViewingExpenseId] = useState(null);

  const [feedOrderSheetOpen, setFeedOrderSheetOpen] = useState(false);
  const [editingFeedOrder, setEditingFeedOrder] = useState(null);
  const [feedOrderToDelete, setFeedOrderToDelete] = useState(null);
  const [feedOrderStacked, setFeedOrderStacked] = useState(false);
  const [feedOrderDetailOpen, setFeedOrderDetailOpen] = useState(false);
  const [viewingFeedOrderId, setViewingFeedOrderId] = useState(null);

  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const [editingSaleOrder, setEditingSaleOrder] = useState(null);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);
  const [viewingSaleId, setViewingSaleId] = useState(null);

  // ─── Queries ───
  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['batch', id],
    queryFn: async () => { const { data } = await api.get(`/batches/${id}`); return data; },
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources', id],
    queryFn: async () => { const { data } = await api.get('/sources', { params: { batch: id } }); return data; },
    enabled: !!id,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => { const { data } = await api.get('/expenses', { params: { batch: id } }); return data; },
    enabled: !!id,
  });

  const { data: feedOrders = [], isLoading: feedOrdersLoading } = useQuery({
    queryKey: ['feedOrders', id],
    queryFn: async () => { const { data } = await api.get('/feed-orders', { params: { batch: id } }); return data; },
    enabled: !!id,
  });

  const { data: saleOrders = [], isLoading: saleOrdersLoading } = useQuery({
    queryKey: ['saleOrders', id],
    queryFn: async () => { const { data } = await api.get('/sale-orders', { params: { batch: id } }); return data; },
    enabled: !!id,
  });

  // ─── Computed summaries ───
  const totalSourceChicks = useMemo(
    () => sources.reduce((sum, s) => sum + (s.totalChicks || 0), 0), [sources]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0), [expenses]
  );
  const totalSalesRevenue = useMemo(
    () => saleOrders.reduce((sum, s) => sum + (s.totals?.grandTotal || 0), 0), [saleOrders]
  );

  // ─── Delete mutations ───
  const invalidateBatchQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['batch', id] });
  };

  const deleteSourceMutation = useMutation({
    mutationFn: (sId) => api.delete(`/sources/${sId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses', id] });
      invalidateBatchQueries();
      setSourceToDelete(null);
      toast({ title: t('batches.sourceDeleted') });
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.response?.data?.message || t('batches.sourceDeleteError'), variant: 'destructive' });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (eId) => api.delete(`/expenses/${eId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['sources', id] });
      queryClient.invalidateQueries({ queryKey: ['feedOrders', id] });
      queryClient.invalidateQueries({ queryKey: ['saleOrders', id] });
      invalidateBatchQueries();
      setExpenseToDelete(null);
      toast({ title: t('batches.expenseDeleted') });
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.response?.data?.message || t('batches.expenseDeleteError'), variant: 'destructive' });
    },
  });

  const deleteFeedOrderMutation = useMutation({
    mutationFn: (oId) => api.delete(`/feed-orders/${oId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedOrders', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses', id] });
      invalidateBatchQueries();
      setFeedOrderToDelete(null);
      toast({ title: t('batches.feedOrderDeleted') });
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.response?.data?.message || t('batches.feedOrderDeleteError'), variant: 'destructive' });
    },
  });

  const deleteSaleOrderMutation = useMutation({
    mutationFn: (saleId) => api.delete(`/sale-orders/${saleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saleOrders', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses', id] });
      invalidateBatchQueries();
      setSaleToDelete(null);
      toast({ title: t('batches.saleDeleted') });
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.response?.data?.message || t('batches.saleDeleteError'), variant: 'destructive' });
    },
  });

  // ─── Sheet open/edit helpers ───
  const openCreateSource = () => { setEditingSource(null); setSourceStacked(false); setSourceSheetOpen(true); };
  const openEditSource = (source) => { setEditingSource(source); setSourceStacked(false); setSourceSheetOpen(true); };
  const openSourceDetail = (id) => { setViewingSourceId(id); setSourceDetailOpen(true); };
  const handleEditFromSourceDetail = (source) => { setEditingSource(source); setSourceStacked(true); setSourceSheetOpen(true); };

  const openCreateExpense = () => { setEditingExpense(null); setExpenseSheetOpen(true); };
  const openEditExpense = (expense) => { setEditingExpense(expense); setExpenseSheetOpen(true); };
  const openExpenseDetail = (id) => { setViewingExpenseId(id); setExpenseDetailOpen(true); };
  const handleEditFromExpenseDetail = (expense) => { setEditingExpense(expense); setExpenseSheetOpen(true); };
  const handleViewSourceFromExpense = (sourceId) => { openSourceDetail(sourceId); };
  const handleViewFeedOrderFromExpense = (feedOrderId) => { openFeedOrderDetail(feedOrderId); };
  const handleViewSaleOrderFromExpense = (saleId) => { openSaleDetail(saleId); };

  const openCreateFeedOrder = () => { setEditingFeedOrder(null); setFeedOrderStacked(false); setFeedOrderSheetOpen(true); };
  const openEditFeedOrder = (order) => { setEditingFeedOrder(order); setFeedOrderStacked(false); setFeedOrderSheetOpen(true); };
  const openFeedOrderDetail = (id) => { setViewingFeedOrderId(id); setFeedOrderDetailOpen(true); };
  const handleEditFromFeedOrderDetail = (order) => { setEditingFeedOrder(order); setFeedOrderStacked(true); setFeedOrderSheetOpen(true); };

  const openCreateSale = () => { setEditingSaleOrder(null); setSaleSheetOpen(true); };
  const openEditSale = async (sale) => {
    try {
      const { data: full } = await api.get(`/sale-orders/${sale._id}`);
      setEditingSaleOrder(full);
    } catch {
      setEditingSaleOrder(sale);
    }
    setSaleSheetOpen(true);
  };
  const openSaleDetail = (saleId) => { setViewingSaleId(saleId); setSaleDetailOpen(true); };
  const handleEditFromDetail = (fullSale) => {
    setEditingSaleOrder(fullSale);
    setSaleSheetOpen(true);
  };
  const handleViewExpenseFromDetail = (expenseId) => {
    openExpenseDetail(expenseId);
  };

  // ─── Cross-sheet coordination ───
  const handleEditSourceFromExpense = (expense) => {
    if (!expense?.source) return;
    const sourceId = expense.source?._id ?? expense.source;
    const sourceObj = sources.find((s) => s._id === sourceId);
    if (sourceObj) {
      setEditingSource(sourceObj);
      setSourceStacked(true);
      setSourceSheetOpen(true);
    }
  };

  const handleEditFeedOrderFromExpense = (expense) => {
    if (!expense?.feedOrder) return;
    const foId = expense.feedOrder?._id ?? expense.feedOrder;
    const foObj = feedOrders.find((fo) => fo._id === foId);
    if (foObj) {
      setEditingFeedOrder(foObj);
      setFeedOrderStacked(true);
      setFeedOrderSheetOpen(true);
    }
  };

  const handleEditSaleOrderFromExpense = async (expense) => {
    if (!expense?.saleOrder) return;
    const soId = expense.saleOrder?._id ?? expense.saleOrder;
    try {
      const { data: full } = await api.get(`/sale-orders/${soId}`);
      setEditingSaleOrder(full);
    } catch {
      const soObj = saleOrders.find((s) => s._id === soId);
      if (soObj) setEditingSaleOrder(soObj);
    }
    setSaleSheetOpen(true);
  };

  const onSourceSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['sources', id] });
    queryClient.invalidateQueries({ queryKey: ['expenses', id] });
    invalidateBatchQueries();
  };

  const onExpenseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses', id] });
    invalidateBatchQueries();
  };

  const onFeedOrderSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['feedOrders', id] });
    queryClient.invalidateQueries({ queryKey: ['expenses', id] });
    invalidateBatchQueries();
  };

  // ─── Loading / not found ───
  if (batchLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('batches.notFound')}</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/batches')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('batches.backToBatches')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/batches')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold tracking-tight">{batch.batchName}</h1>
            <Badge variant={STATUS_VARIANTS[batch.status] || 'secondary'}>
              {t(`batches.statuses.${batch.status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {batch.farm?.farmName && (
              <span className="flex items-center gap-1">
                <Warehouse className="h-3.5 w-3.5" />
                {batch.farm.farmName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(batch.startDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
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
            <div className="text-2xl font-bold">{expenses.length}</div>
            <p className="text-xs text-muted-foreground">{t('batches.totalExpenses')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{t('batches.totalCost')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{t('batches.totalRevenue')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources" className="gap-2">
            <Egg className="h-4 w-4" />
            {t('batches.sourcesTab')} ({sources.length})
          </TabsTrigger>
          <TabsTrigger value="feedOrders" className="gap-2">
            <Wheat className="h-4 w-4" />
            {t('batches.feedOrdersTab')} ({feedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <DollarSign className="h-4 w-4" />
            {t('batches.expensesTab')} ({expenses.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('batches.salesTab')} ({saleOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── SOURCES TAB ─── */}
        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('batches.sourcesTitle')}</CardTitle>
                  <CardDescription>{t('batches.sourcesDesc')}</CardDescription>
                </div>
                <Button onClick={openCreateSource} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('batches.addSource')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sourcesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Egg className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{t('batches.noSources')}</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noSourcesDesc')}</p>
                  <Button onClick={openCreateSource} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('batches.addFirstSource')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div key={source._id} onClick={() => openSourceDetail(source._id)} className="cursor-pointer flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Egg className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {source.sourceFrom?.companyName || t('batches.unknownSupplier')}
                          </p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {(source.totalChicks || 0).toLocaleString()} {t('batches.chicks')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {source.deliveryDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(source.deliveryDate).toLocaleDateString()}
                            </span>
                          )}
                          <span>{t('batches.grandTotalLabel')}: {(source.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          {source.taxInvoiceId && <span>INV: {source.taxInvoiceId}</span>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openSourceDetail(source._id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('common.view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditSource(source)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setSourceToDelete(source)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── FEED ORDERS TAB ─── */}
        <TabsContent value="feedOrders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('batches.feedOrdersTab')}</CardTitle>
                  <CardDescription>{t('batches.addFeedOrderDesc')}</CardDescription>
                </div>
                <Button onClick={openCreateFeedOrder} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('batches.addFeedOrder')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {feedOrdersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : feedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Wheat className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{t('batches.noFeedOrders')}</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noFeedOrdersDesc')}</p>
                  <Button onClick={openCreateFeedOrder} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('batches.addFirstFeedOrder')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedOrders.map((order) => (
                    <div key={order._id} onClick={() => openFeedOrderDetail(order._id)} className="cursor-pointer flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Wheat className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {order.feedCompany?.companyName || t('batches.unknownSupplier')}
                          </p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {(order.items?.length || 0)} {t('batches.items')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {order.orderDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(order.orderDate).toLocaleDateString()}
                            </span>
                          )}
                          <span>{t('batches.grandTotalLabel')}: {(order.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openFeedOrderDetail(order._id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('common.view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditFeedOrder(order)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setFeedOrderToDelete(order)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── EXPENSES TAB ─── */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('batches.expensesTitle')}</CardTitle>
                  <CardDescription>{t('batches.expensesDesc')}</CardDescription>
                </div>
                <Button onClick={openCreateExpense} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('batches.addExpense')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{t('batches.noExpenses')}</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noExpensesDesc')}</p>
                  <Button onClick={openCreateExpense} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('batches.addFirstExpense')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map((expense) => (
                    <div key={expense._id} onClick={() => openExpenseDetail(expense._id)} className="cursor-pointer flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {expense.description || t(`batches.expenseCategories.${expense.category}`)}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {t(`batches.expenseCategories.${expense.category}`)}
                          </Badge>
                          {expense.source && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                              <Link2 className="h-3 w-3" />
                              {t('batches.linkedToSource')}
                            </Badge>
                          )}
                          {expense.feedOrder && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                              <Link2 className="h-3 w-3" />
                              {t('batches.linkedToFeedOrder')}
                            </Badge>
                          )}
                          {expense.saleOrder && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                              <Link2 className="h-3 w-3" />
                              {t('batches.linkedToSaleOrder')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {expense.expenseDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(expense.expenseDate).toLocaleDateString()}
                            </span>
                          )}
                          <span>{t('batches.total')}: {(expense.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          {expense.tradingCompany?.companyName && (
                            <span>{expense.tradingCompany.companyName}</span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openExpenseDetail(expense._id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('common.view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditExpense(expense)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setExpenseToDelete(expense)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SALES TAB ─── */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('batches.salesTitle')}</CardTitle>
                  <CardDescription>{t('batches.salesDesc')}</CardDescription>
                </div>
                <Button onClick={openCreateSale} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('batches.addSale')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {saleOrdersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : saleOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{t('batches.noSales')}</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noSalesDesc')}</p>
                  <Button onClick={openCreateSale} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('batches.addFirstSale')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {saleOrders.map((sale) => (
                    <div key={sale._id} onClick={() => openSaleDetail(sale._id)} className="cursor-pointer flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {sale.customer?.companyName || t('batches.unknownSupplier')}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {t(`batches.saleInvoiceTypes.${sale.invoiceType}`)}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {sale.saleNumber}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {sale.saleDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(sale.saleDate).toLocaleDateString()}
                            </span>
                          )}
                          <span className="font-medium text-foreground">
                            {(sale.totals?.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      {sale.invoiceDocs?.length > 0 && (
                        <a href={sale.invoiceDocs[0]?.url || sale.invoiceDocs[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="shrink-0" title={t('batches.viewInvoice')}>
                            <FileText className="h-4 w-4 text-primary" />
                          </Button>
                        </a>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => openSaleDetail(sale._id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('common.view')}
                          </DropdownMenuItem>
                          {sale.invoiceDocs?.length > 0 && (
                            <DropdownMenuItem asChild>
                              <a href={sale.invoiceDocs[0]?.url || sale.invoiceDocs[0]} target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-2 h-4 w-4" />
                                {t('batches.viewInvoice')}
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEditSale(sale)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setSaleToDelete(sale)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── SHEET COMPONENTS ─── */}
      <SourceSheet
        open={sourceSheetOpen}
        onOpenChange={(open) => { if (!open) { setSourceSheetOpen(false); setEditingSource(null); setSourceStacked(false); } }}
        batchId={id}
        editingSource={editingSource}
        stacked={sourceStacked || sourceDetailOpen}
        onSuccess={onSourceSuccess}
      />

      <SourceDetailSheet
        open={sourceDetailOpen}
        onOpenChange={(open) => { if (!open) { setSourceDetailOpen(false); setViewingSourceId(null); } }}
        sourceId={viewingSourceId}
        onEdit={handleEditFromSourceDetail}
        stacked={expenseDetailOpen}
      />

      <ExpenseSheet
        open={expenseSheetOpen}
        onOpenChange={(open) => { if (!open) { setExpenseSheetOpen(false); setEditingExpense(null); } }}
        batchId={id}
        editingExpense={editingExpense}
        stacked={expenseDetailOpen}
        onEditLinkedSource={handleEditSourceFromExpense}
        onEditLinkedFeedOrder={handleEditFeedOrderFromExpense}
        onEditLinkedSaleOrder={handleEditSaleOrderFromExpense}
        onSuccess={onExpenseSuccess}
      />

      <FeedOrderSheet
        open={feedOrderSheetOpen}
        onOpenChange={(open) => { if (!open) { setFeedOrderSheetOpen(false); setEditingFeedOrder(null); setFeedOrderStacked(false); } }}
        batchId={id}
        editingFeedOrder={editingFeedOrder}
        stacked={feedOrderStacked || feedOrderDetailOpen}
        onSuccess={onFeedOrderSuccess}
      />

      <FeedOrderDetailSheet
        open={feedOrderDetailOpen}
        onOpenChange={(open) => { if (!open) { setFeedOrderDetailOpen(false); setViewingFeedOrderId(null); } }}
        feedOrderId={viewingFeedOrderId}
        onEdit={handleEditFromFeedOrderDetail}
        stacked={expenseDetailOpen}
      />

      <ExpenseDetailSheet
        open={expenseDetailOpen}
        onOpenChange={(open) => { if (!open) { setExpenseDetailOpen(false); setViewingExpenseId(null); } }}
        expenseId={viewingExpenseId}
        onEdit={handleEditFromExpenseDetail}
        onViewSource={handleViewSourceFromExpense}
        onViewFeedOrder={handleViewFeedOrderFromExpense}
        onViewSaleOrder={handleViewSaleOrderFromExpense}
        stacked={saleDetailOpen}
      />

      <SaleOrderSheet
        open={saleSheetOpen}
        onOpenChange={(open) => { if (!open) { setSaleSheetOpen(false); setEditingSaleOrder(null); } }}
        batchId={id}
        editingSaleOrder={editingSaleOrder}
        stacked={saleDetailOpen || expenseSheetOpen}
      />

      <SaleDetailSheet
        open={saleDetailOpen}
        onOpenChange={(open) => { if (!open) { setSaleDetailOpen(false); setViewingSaleId(null); } }}
        saleId={viewingSaleId}
        stacked={expenseDetailOpen}
        batchId={id}
        onEdit={handleEditFromDetail}
        onViewExpense={handleViewExpenseFromDetail}
      />

      {/* ─── DELETE DIALOGS ─── */}
      <ConfirmDeleteDialog
        open={!!sourceToDelete}
        onOpenChange={(open) => !open && setSourceToDelete(null)}
        title={t('batches.deleteSourceTitle')}
        description={t('batches.deleteSourceWarning')}
        onConfirm={() => sourceToDelete && deleteSourceMutation.mutate(sourceToDelete._id)}
        isPending={deleteSourceMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title={t('batches.deleteExpenseTitle')}
        description={expenseToDelete?.source ? t('batches.deleteExpenseSourceWarning') : expenseToDelete?.feedOrder ? t('batches.deleteExpenseFeedOrderWarning') : expenseToDelete?.saleOrder ? t('batches.deleteExpenseSaleOrderWarning') : t('batches.deleteExpenseWarning')}
        onConfirm={() => expenseToDelete && deleteExpenseMutation.mutate(expenseToDelete._id)}
        isPending={deleteExpenseMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={!!feedOrderToDelete}
        onOpenChange={(open) => !open && setFeedOrderToDelete(null)}
        title={t('batches.deleteFeedOrderTitle')}
        description={t('batches.deleteFeedOrderWarning')}
        onConfirm={() => feedOrderToDelete && deleteFeedOrderMutation.mutate(feedOrderToDelete._id)}
        isPending={deleteFeedOrderMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={!!saleToDelete}
        onOpenChange={(open) => !open && setSaleToDelete(null)}
        title={t('batches.deleteSaleTitle')}
        description={t('batches.deleteSaleWarning')}
        onConfirm={() => saleToDelete && deleteSaleOrderMutation.mutate(saleToDelete._id)}
        isPending={deleteSaleOrderMutation.isPending}
      />
    </div>
  );
}
