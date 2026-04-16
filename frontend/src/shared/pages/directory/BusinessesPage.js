import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Building2,
  Search,
  X,
  RotateCcw,
  ContactRound,
  FileText,
  Eye,
  Warehouse,
} from 'lucide-react';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import BusinessEditSheet from '@/shared/sheets/BusinessEditSheet';
import usePersistedState from '@/hooks/usePersistedState';

const BUSINESS_TYPES = ['TRADER', 'SUPPLIER'];

export default function BusinessesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);

  const businessesList = useLocalQuery('businesses');
  const allFarms = useLocalQuery('farms');

  const [search, setSearch] = usePersistedState('dir-biz-search', '');
  const [typeFilter, setTypeFilter] = usePersistedState('dir-biz-type', []);

  const farmCountByBusiness = useMemo(() => {
    const map = {};
    allFarms.forEach((f) => {
      const bId = typeof f.business === 'object' ? f.business?._id : f.business;
      if (bId) map[bId] = (map[bId] || 0) + 1;
    });
    return map;
  }, [allFarms]);

  const { mutate: deleteBusiness } = useOfflineMutation('businesses');

  const openCreateSheet = () => {
    setEditingBusiness(null);
    setSheetOpen(true);
  };

  const openEditSheet = (business) => {
    setEditingBusiness(business);
    setSheetOpen(true);
  };

  useEffect(() => {
    if (routerLocation.state?.editBusinessId) {
      const biz = businessesList.find((b) => b._id === routerLocation.state.editBusinessId);
      if (biz) {
        openEditSheet(biz);
        navigate(routerLocation.pathname, { replace: true, state: {} });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state?.editBusinessId, businessesList]);

  const typeOptions = useMemo(
    () => BUSINESS_TYPES.map((bt) => ({
      value: bt,
      label: t(`businesses.types.${bt}`, bt === 'TRADER' ? 'Trader' : 'Supplier'),
    })),
    [t],
  );

  const filtered = useMemo(() => {
    let list = businessesList;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.companyName?.toLowerCase().includes(q) ||
          b.tradeLicenseNumber?.toLowerCase().includes(q) ||
          b.trnNumber?.toLowerCase().includes(q),
      );
    }

    if (typeFilter.length > 0) {
      list = list.filter((b) => typeFilter.includes(b.businessType || 'TRADER'));
    }

    return [...list].sort((a, b) => (b.isAccountBusiness ? 1 : 0) - (a.isAccountBusiness ? 1 : 0));
  }, [businessesList, search, typeFilter]);

  const hasFilters = !!(search || typeFilter.length);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter([]);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="pb-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t('businesses.title', 'Businesses')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('businesses.subtitle', 'Manage your business directory')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground leading-none">{t('businesses.totalBusinesses', 'Total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
                </div>
              </div>
              <Button onClick={openCreateSheet} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('businesses.addBusiness', 'Add Business')}
              </Button>
            </div>
          </div>

          {/* Search + Reset */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('businesses.searchPlaceholder', 'Search businesses...')}
                className="pl-8 h-9 bg-white dark:bg-card"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs shrink-0"
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2">
            <SearchableMultiSelect
              variant="dropdown"
              options={typeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder={t('businesses.businessType', 'Business Type')}
              className="flex-1 min-w-0 max-w-[220px]"
            />
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {businessesList.length} {t('businesses.title', 'businesses').toLowerCase()}
            </p>
          )}
        </div>

        {/* Business list */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {filtered.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('businesses.noBusinesses')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('businesses.noBusinessesDesc')}
              </p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('businesses.addFirstBusiness')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('common.noResults')}
            </p>
          ) : (
            filtered.map((biz) => {
              const farmCount = farmCountByBusiness[biz._id] || 0;
              const isTrader = biz.businessType !== 'SUPPLIER';
              return (
                <div
                  key={biz._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/dashboard/directory/businesses/${biz._id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/dashboard/directory/businesses/${biz._id}`); } }}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50 cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{biz.companyName}</p>
                      <Badge variant={isTrader ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {isTrader ? t('businesses.trader') : t('businesses.supplier')}
                      </Badge>
                      {biz.isAccountBusiness && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {t('businesses.yourBusiness')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      {biz.trnNumber && <span>TRN: {biz.trnNumber}</span>}
                      {biz.tradeLicenseNumber && <span>TL: {biz.tradeLicenseNumber}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {biz.contacts?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <ContactRound className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{biz.contacts.length}</span>
                        </div>
                      )}
                      {farmCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {farmCount} {farmCount === 1 ? t('businesses.detail.farm', 'farm') : t('businesses.detail.farmsPlural', 'farms')}
                          </span>
                        </div>
                      )}
                      {biz.otherDocs?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{biz.otherDocs.length}</span>
                        </div>
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
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/directory/businesses/${biz._id}`); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('common.view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditSheet(biz); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      {!biz.isAccountBusiness && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteBusiness(
                              { action: 'delete', id: biz._id },
                              { onSuccess: () => toast({ title: t('businesses.businessDeleted') }) },
                            ); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BusinessEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingBusiness={editingBusiness}
      />
    </>
  );
}
