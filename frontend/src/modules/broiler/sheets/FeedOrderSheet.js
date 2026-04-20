/**
 * FeedOrderSheet — self-contained sheet for creating / editing a Feed Order.
 *
 * CONTRACT (entity-sheet pattern):
 *  - Props: { open, onOpenChange, batchId, editingFeedOrder, stacked, onSuccess }
 *  - Owns its own controlled state (no react-hook-form here — line items are
 *    managed with useState), guard, file uploads, and mutations.
 *  - Fetches reference data (businesses, allFeedItems, accounting) via React Query.
 *  - Calls `onSuccess()` after a successful create/update so the parent can
 *    invalidate list-level queries or refresh linked sheets.
 *  - `stacked` controls z-index when opened on top of another sheet (e.g. from ExpenseSheet).
 */
import { useState, useEffect, useMemo } from 'react';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import { useTranslation } from 'react-i18next';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, X, Wheat, ChevronDown } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import DocumentsManager from '@/components/DocumentsManager';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';
import db from '@/lib/db';
import { formatDateForInput } from '@/lib/format';
import { FEED_TYPES, FEED_TYPE_ICONS } from '@/lib/constants';

export default function FeedOrderSheet({ open, onOpenChange, batchId, editingFeedOrder, stacked, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState('');
  const [taxInvoiceId, setTaxInvoiceId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [formDirty, setFormDirty] = useState(false);
  const [taxInvoiceIdError, setTaxInvoiceIdError] = useState('');

  const [taxInvoiceDocs, setTaxInvoiceDocs] = useState([]);
  const [transferProofs, setTransferProofs] = useState([]);
  const [deliveryNoteDocs, setDeliveryNoteDocs] = useState([]);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});

  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');

  const guard = useFormGuard(formDirty);

  const businesses = useLocalQuery('businesses');
  const allFeedItems = useLocalQuery('feedItems');
  const accounting = useSettings('accounting');

  const vatRate = accounting?.vatRate ?? 5;

  const feedCompanyIds = useMemo(() => {
    const ids = new Set();
    allFeedItems.forEach((fi) => {
      const cid = fi.feedCompany?._id ?? fi.feedCompany;
      if (cid) ids.add(cid);
    });
    return ids;
  }, [allFeedItems]);

  const feedCompanyPriorityOptions = useMemo(
    () => businesses.filter((b) => feedCompanyIds.has(b._id)).map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    })),
    [businesses, feedCompanyIds]
  );

  const feedCompanyOtherOptions = useMemo(
    () => businesses.filter((b) => !feedCompanyIds.has(b._id)).map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    })),
    [businesses, feedCompanyIds]
  );

  const feedTypeOptions = useMemo(
    () => FEED_TYPES.map((ft) => ({ value: ft, label: t(`feed.feedTypes.${ft}`), icon: FEED_TYPE_ICONS[ft] })),
    [t]
  );

  const companyFeedItems = useMemo(
    () => allFeedItems.filter((fi) => {
      const cid = fi.feedCompany?._id ?? fi.feedCompany;
      return cid === selectedCompany;
    }),
    [allFeedItems, selectedCompany]
  );

  // ─── Computed ───
  const foSubtotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + ((li.pricePerBag || 0) * (li.bags || 0)), 0),
    [lineItems]
  );
  const foVat = foSubtotal * (vatRate / 100);
  const foGrandTotal = foSubtotal + (deliveryCharge || 0) + foVat;
  const foTotalBags = useMemo(
    () => lineItems.reduce((sum, li) => sum + (li.bags || 0), 0),
    [lineItems]
  );

  // ─── Helpers ───
  const resetFiles = () => {
    setTaxInvoiceDocs([]);
    setTransferProofs([]);
    setDeliveryNoteDocs([]);
  };

  const closeSheet = () => {
    onOpenChange(false);
    setSelectedCompany('');
    setTaxInvoiceId('');
    setTaxInvoiceIdError('');
    setOrderDate('');
    setDeliveryDate('');
    setLineItems([]);
    setDeliveryCharge(0);
    setExpandedItems(new Set());
    setOtherDocs([]);
    setMediaMap({});
    resetFiles();
    setFormDirty(false);
    guard.resetGuard();
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  const markDirty = () => {
    setFormDirty(true);
    guard.markDirty();
  };

  // ─── Populate on edit ───
  useEffect(() => {
    if (!open || !editingFeedOrder) return;

    guard.resetGuard();
    const companyId = editingFeedOrder.feedCompany?._id ?? editingFeedOrder.feedCompany;
    setSelectedCompany(companyId || '');
    setTaxInvoiceId(editingFeedOrder.taxInvoiceId || '');
    setOrderDate(formatDateForInput(editingFeedOrder.orderDate));
    setDeliveryDate(formatDateForInput(editingFeedOrder.deliveryDate));
    setDeliveryCharge(editingFeedOrder.deliveryCharge || 0);
    setLineItems(
      (editingFeedOrder.items || []).map((item) => ({
        feedItem: item.feedItem?._id ?? item.feedItem,
        feedType: item.feedType || '',
        feedDescription: item.feedDescription || '',
        pricePerBag: item.pricePerBag || 0,
        quantitySize: item.quantitySize || 50,
        quantityUnit: item.quantityUnit || 'KG',
        bags: item.bags || 0,
      }))
    );
    setExpandedItems(new Set());

    (async () => {
      try {
        const { data: full } = await api.get(`/feed-orders/${editingFeedOrder._id}`);
        setTaxInvoiceDocs(full.taxInvoiceDocs || []);
        setTransferProofs(full.transferProofs || []);
        setDeliveryNoteDocs(full.deliveryNoteDocs || []);
        const map = {};
        if (full.otherDocs) {
          full.otherDocs.forEach((doc) => {
            if (doc.media_id && typeof doc.media_id === 'object') {
              map[doc.media_id._id] = doc.media_id;
            }
          });
        }
        setMediaMap(map);
        setOtherDocs(
          (full.otherDocs || []).map((d) => ({
            name: d.name,
            media_id: d.media_id?._id ?? d.media_id,
          }))
        );
      } catch {
        setOtherDocs([]);
        setMediaMap({});
        resetFiles();
      }
      setFormDirty(false);
      guard.armGuard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingFeedOrder?._id]);

  // Populate on create
  useEffect(() => {
    if (!open || editingFeedOrder) return;
    guard.resetGuard();
    setSelectedCompany('');
    setTaxInvoiceId('');
    setOrderDate('');
    setDeliveryDate('');
    setLineItems([]);
    setDeliveryCharge(0);
    setExpandedItems(new Set());
    setOtherDocs([]);
    setMediaMap({});
    resetFiles();
    setFormDirty(false);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!selectedCompany || businesses.some(b => b._id === selectedCompany)) return;
    db.idMap.get({ tempId: selectedCompany, entityType: 'businesses' }).then(mapping => {
      if (mapping) setSelectedCompany(mapping.realId);
    });
  }, [businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Line item helpers ───
  const addLineItem = () => {
    const newIdx = lineItems.length;
    setLineItems((prev) => [...prev, { feedItem: '', feedType: '', feedDescription: '', pricePerBag: 0, quantitySize: 50, quantityUnit: 'KG', bags: 0 }]);
    setExpandedItems((prev) => new Set([...prev, newIdx]));
    markDirty();
  };

  const updateLineItem = (index, field, value) => {
    setLineItems((prev) => prev.map((li, i) => i === index ? { ...li, [field]: value } : li));
    markDirty();
  };

  const removeLineItem = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setExpandedItems((prev) => {
      const next = new Set();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
    markDirty();
  };

  const { mutate, isPending: isMutating } = useOfflineMutation('feedOrders');

  const onSubmit = () => {
    setTaxInvoiceIdError('');

    const items = lineItems.map((li) => {
      const liSub = (li.pricePerBag || 0) * (li.bags || 0);
      const liVatAmt = liSub * (vatRate / 100);
      return {
        feedItem: li.feedItem,
        feedType: li.feedType,
        feedDescription: li.feedDescription,
        pricePerBag: li.pricePerBag || 0,
        quantitySize: li.quantitySize || 50,
        quantityUnit: li.quantityUnit || 'KG',
        bags: li.bags || 0,
        subtotal: liSub,
        vatAmount: liVatAmt,
        lineTotal: liSub + liVatAmt,
      };
    });

    const payload = {
      batch: batchId,
      feedCompany: selectedCompany || null,
      taxInvoiceId: taxInvoiceId || '',
      orderDate: orderDate || null,
      deliveryDate: deliveryDate || null,
      subtotal: foSubtotal,
      deliveryCharge: deliveryCharge || 0,
      vatAmount: foVat,
      grandTotal: foGrandTotal,
      items,
      taxInvoiceDocs: taxInvoiceDocs.map((m) => m._id),
      transferProofs: transferProofs.map((m) => m._id),
      deliveryNoteDocs: deliveryNoteDocs.map((m) => m._id),
      otherDocs,
    };

    mutate({
      action: editingFeedOrder ? 'update' : 'create',
      id: editingFeedOrder ? editingFeedOrder._id : undefined,
      data: payload,
      mediaFields: ['taxInvoiceDocs', 'transferProofs', 'deliveryNoteDocs'],
    }, {
      onSuccess: () => {
        toast({ title: editingFeedOrder ? t('batches.feedOrderUpdated') : t('batches.feedOrderCreated') });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent className={stacked ? 'z-[60]' : ''}>
          <SheetHeader>
            <SheetTitle>{editingFeedOrder ? t('batches.editFeedOrder') : t('batches.addFeedOrder')}</SheetTitle>
            <SheetDescription>{editingFeedOrder ? t('batches.editFeedOrderDesc') : t('batches.addFeedOrderDesc')}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-4 overflow-hidden">
              <div className="space-y-2">
                <Label>{t('batches.feedCompany')}</Label>
                <SearchableSelect
                  priorityOptions={feedCompanyPriorityOptions}
                  options={feedCompanyOtherOptions}
                  value={selectedCompany}
                  onChange={(val) => {
                    setSelectedCompany(val);
                    setLineItems([]);
                    markDirty();
                  }}
                  placeholder={t('batches.selectFeedCompany')}
                  searchPlaceholder={t('batches.searchFeedCompany')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('businesses.addBusiness')}
                  onCreate={(name) => {
                    setQabName(name || '');
                    setQabOpen(true);
                  }}
                />
                {feedCompanyPriorityOptions.length > 0 && (
                  <p className="text-xs text-muted-foreground">{t('batches.feedCompanyHint')}</p>
                )}
              </div>

              {selectedCompany && (
                <>
                  <div className="space-y-2">
                    <Label>{t('batches.orderDate')}</Label>
                    <Input
                      type="date"
                      value={orderDate}
                      onChange={(e) => { setOrderDate(e.target.value); markDirty(); }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('batches.taxInvoiceId')}</Label>
                    <Input
                      value={taxInvoiceId}
                      onChange={(e) => { setTaxInvoiceId(e.target.value); setTaxInvoiceIdError(''); markDirty(); }}
                      placeholder={t('batches.invoiceIdPlaceholder')}
                    />
                    {taxInvoiceIdError && (
                      <p className="text-sm text-destructive">{taxInvoiceIdError}</p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('batches.lineItems')}</Label>
                      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLineItem}>
                        <Plus className="h-3.5 w-3.5" />
                        {t('batches.addLineItem')}
                      </Button>
                    </div>

                    {lineItems.length === 0 && (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <Wheat className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">{t('batches.noLineItems')}</p>
                        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLineItem}>
                          <Plus className="h-3.5 w-3.5" />
                          {t('batches.addLineItem')}
                        </Button>
                      </div>
                    )}

                    {lineItems.map((lineItem, idx) => {
                      const isComplete = lineItem.feedItem && lineItem.bags > 0;
                      const isExpanded = expandedItems.has(idx);
                      const matchingItems = companyFeedItems.filter((fi) => !lineItem.feedType || fi.feedType === lineItem.feedType);
                      const productOptions = matchingItems.map((fi) => ({
                        value: fi._id,
                        label: fi.feedDescription,
                        description: `${fi.quantitySize}${fi.quantityUnit} — ${fi.pricePerQty?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                      }));
                      const liSub = (lineItem.pricePerBag || 0) * (lineItem.bags || 0);
                      const FtIcon = FEED_TYPE_ICONS[lineItem.feedType];

                      if (isComplete && !isExpanded) {
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50"
                            onClick={() => setExpandedItems((prev) => new Set([...prev, idx]))}
                          >
                            {FtIcon && <FtIcon className="h-4 w-4 text-primary shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lineItem.feedDescription}</p>
                              <p className="text-xs text-muted-foreground">
                                {lineItem.bags} {t('batches.bags')} × {(lineItem.pricePerBag || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} = {liSub.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                            <div className="flex items-center gap-1">
                              {isComplete && (
                                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setExpandedItems((prev) => { const n = new Set(prev); n.delete(idx); return n; })}>
                                  {t('common.close')}
                                </Button>
                              )}
                              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => removeLineItem(idx)}>
                                <X className="h-3 w-3 mr-0.5" />
                                {t('batches.removeLineItem')}
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {feedTypeOptions.map(({ value: ftVal, label: ftLabel, icon: FtOptIcon }) => {
                              const selected = lineItem.feedType === ftVal;
                              return (
                                <button
                                  key={ftVal}
                                  type="button"
                                  onClick={() => {
                                    updateLineItem(idx, 'feedType', ftVal);
                                    const filtered = companyFeedItems.filter((fi) => fi.feedType === ftVal);
                                    if (filtered.length === 1) {
                                      updateLineItem(idx, 'feedItem', filtered[0]._id);
                                      updateLineItem(idx, 'feedDescription', filtered[0].feedDescription);
                                      updateLineItem(idx, 'pricePerBag', filtered[0].pricePerQty || 0);
                                      updateLineItem(idx, 'quantitySize', filtered[0].quantitySize || 50);
                                      updateLineItem(idx, 'quantityUnit', filtered[0].quantityUnit || 'KG');
                                    } else {
                                      updateLineItem(idx, 'feedItem', '');
                                      updateLineItem(idx, 'feedDescription', '');
                                      updateLineItem(idx, 'pricePerBag', 0);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                                    selected
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-input bg-background text-foreground hover:bg-accent/50'
                                  }`}
                                >
                                  {FtOptIcon && <FtOptIcon className="h-3.5 w-3.5" />}
                                  {ftLabel}
                                </button>
                              );
                            })}
                          </div>

                          {lineItem.feedType && (
                            <>
                              {productOptions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('batches.noFeedProducts')}</p>
                              ) : productOptions.length === 1 ? (
                                <div className="rounded-md border p-2.5 bg-muted/30">
                                  <p className="text-sm font-medium">{productOptions[0].label}</p>
                                  <p className="text-xs text-muted-foreground">{productOptions[0].description}</p>
                                </div>
                              ) : (
                                <SearchableSelect
                                  options={productOptions}
                                  value={lineItem.feedItem}
                                  onChange={(val) => {
                                    const sel = companyFeedItems.find((fi) => fi._id === val);
                                    if (sel) {
                                      updateLineItem(idx, 'feedItem', val);
                                      updateLineItem(idx, 'feedDescription', sel.feedDescription);
                                      updateLineItem(idx, 'pricePerBag', sel.pricePerQty || 0);
                                      updateLineItem(idx, 'quantitySize', sel.quantitySize || 50);
                                      updateLineItem(idx, 'quantityUnit', sel.quantityUnit || 'KG');
                                    }
                                  }}
                                  placeholder={t('batches.selectFeedProduct')}
                                  searchPlaceholder={t('batches.searchFeedProduct')}
                                  emptyMessage={t('batches.noFeedProducts')}
                                />
                              )}

                              {lineItem.feedItem && (
                                <div className="grid gap-3 grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">{t('batches.bagsQuantity')}</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      className="h-9"
                                      value={lineItem.bags || ''}
                                      onChange={(e) => updateLineItem(idx, 'bags', parseInt(e.target.value, 10) || 0)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">{t('batches.pricePerBag')} <span className="text-muted-foreground font-normal">({t('batches.exVat')})</span></Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-9"
                                      value={lineItem.pricePerBag || ''}
                                      onChange={(e) => updateLineItem(idx, 'pricePerBag', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {lineItems.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('batches.deliveryCharge')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9"
                          placeholder="0.00"
                          value={deliveryCharge || ''}
                          onChange={(e) => { setDeliveryCharge(parseFloat(e.target.value) || 0); markDirty(); }}
                        />
                      </div>

                      <Separator />
                      <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                        <div className="flex justify-between text-sm font-medium">
                          <span>{t('batches.orderSummary')}</span>
                          <span>{t('batches.totalBags')}: {foTotalBags}</span>
                        </div>
                        <Separator />
                        {lineItems.map((li, idx) => {
                          const liSub = (li.pricePerBag || 0) * (li.bags || 0);
                          if (!li.feedItem || li.bags <= 0) return null;
                          return (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-muted-foreground truncate mr-2">
                                {li.feedDescription || t(`feed.feedTypes.${li.feedType}`)} — {li.bags} × {(li.pricePerBag || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="font-medium shrink-0">{liSub.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })}
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('batches.subtotal')}</span>
                          <span className="font-medium">{foSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {(deliveryCharge || 0) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('batches.deliveryCharge')}</span>
                            <span className="font-medium">{(deliveryCharge || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('batches.vat')} ({vatRate}%)</span>
                          <span className="font-medium">{foVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>{t('batches.grandTotal')}</span>
                          <span>{foGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <MultiFileUpload
                    label={t('batches.taxInvoiceDocLabel')}
                    files={taxInvoiceDocs}
                    onAdd={(media) => setTaxInvoiceDocs((prev) => [...prev, media])}
                    onRemove={(i) => setTaxInvoiceDocs((prev) => prev.filter((_, ix) => ix !== i))}
                    entityType="feedOrder"
                    entityId={editingFeedOrder?._id}
                    category="feed-orders"
                    guardMarkDirty={guard.markDirty}
                  />

                  <MultiFileUpload
                    label={t('batches.transferProof')}
                    files={transferProofs}
                    onAdd={(media) => setTransferProofs((prev) => [...prev, media])}
                    onRemove={(i) => setTransferProofs((prev) => prev.filter((_, ix) => ix !== i))}
                    entityType="feedOrder"
                    entityId={editingFeedOrder?._id}
                    category="feed-orders"
                    guardMarkDirty={guard.markDirty}
                  />

                  <MultiFileUpload
                    label={t('batches.deliveryNoteDocLabel')}
                    files={deliveryNoteDocs}
                    onAdd={(media) => setDeliveryNoteDocs((prev) => [...prev, media])}
                    onRemove={(i) => setDeliveryNoteDocs((prev) => prev.filter((_, ix) => ix !== i))}
                    entityType="feedOrder"
                    entityId={editingFeedOrder?._id}
                    category="feed-orders"
                    guardMarkDirty={guard.markDirty}
                  />

                  <Separator />

                  <DocumentsManager
                    entityType="feedOrder"
                    entityId={editingFeedOrder?._id}
                    category="feed-orders"
                    documents={otherDocs}
                    mediaMap={mediaMap}
                    onDocumentsChange={(docs, map) => {
                      setOtherDocs(docs);
                      setMediaMap(map);
                      guard.markDirty();
                    }}
                  />
                </>
              )}
            </div>
          </ScrollArea>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isMutating || lineItems.length === 0 || !selectedCompany}
            >
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFeedOrder ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddBusinessSheet
        open={qabOpen}
        onOpenChange={setQabOpen}
        onCreated={(biz) => {
          setSelectedCompany(biz._id);
          setLineItems([]);
          markDirty();
        }}
        initialName={qabName}
      />
    </>
  );
}
