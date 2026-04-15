import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import { usePanelRef, useDefaultLayout } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useMediaQuery from '@/hooks/useMediaQuery';
import SwipeablePanel from '@/components/SwipeablePanel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export default function MasterDetail({
  list,
  detail,
  hasSelection,
  onBack,
  emptyIcon: EmptyIcon,
  emptyMessage,
  className,
  subDetail,
  hasSubDetail,
  onCloseSubDetail,
  persistId = 'master-detail',
  detailLabel,
  subDetailLabel,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isWide = useMediaQuery('(min-width: 1280px)');

  const listPanelRef = usePanelRef();
  const [listCollapsed, setListCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');

  const showSubPanel = hasSubDetail && isWide;
  const showSubTabs = hasSubDetail && !isWide && isDesktop;

  useEffect(() => {
    if (hasSubDetail && !isWide) {
      setActiveTab('sub-detail');
    }
  }, [hasSubDetail, isWide]);

  useEffect(() => {
    if (!hasSubDetail) {
      setActiveTab('detail');
    }
  }, [hasSubDetail]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onPrev?.(); }
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNext?.(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, onPrev, onNext]);

  const layoutId = showSubPanel
    ? `${persistId}-3p`
    : `${persistId}-2p`;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: layoutId });

  const handleExpand = useCallback(() => {
    listPanelRef.current?.collapse();
    setListCollapsed(true);
  }, [listPanelRef]);

  const handleRestore = useCallback(() => {
    listPanelRef.current?.expand();
    setListCollapsed(false);
  }, [listPanelRef]);

  const handleCloseSubTab = useCallback(() => {
    setActiveTab('detail');
    onCloseSubDetail?.();
  }, [onCloseSubDetail]);

  if (isDesktop) {
    return (
      <div className={cn('h-[calc(100vh-9rem)]', className)}>
        <ResizablePanelGroup
          orientation="horizontal"
          id={layoutId}
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          {/* List panel */}
          <ResizablePanel
            id={`${layoutId}-list`}
            panelRef={listPanelRef}
            defaultSize={showSubPanel ? '22%' : '30%'}
            minSize="15%"
            maxSize="50%"
            collapsible
            collapsedSize="0%"
            className={cn('rounded-lg border bg-card', listCollapsed && 'overflow-hidden')}
          >
            <div className="h-full overflow-y-auto">
              {list}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Detail panel */}
          <ResizablePanel
            id={`${layoutId}-detail`}
            defaultSize={showSubPanel ? '40%' : '70%'}
            minSize="30%"
            className="rounded-lg border bg-card"
          >
            <div className="flex flex-col h-full">
              {hasSelection && (
                <div className="flex items-center gap-1 border-b shrink-0 bg-muted/30">
                  {showSubTabs ? (
                    <div className="flex items-center flex-1 min-w-0 px-1 pt-1">
                      <button
                        onClick={() => setActiveTab('detail')}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors truncate max-w-[180px]',
                          activeTab === 'detail'
                            ? 'bg-background text-foreground border border-b-0 border-border'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        <span className="truncate">{detailLabel || 'Detail'}</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('sub-detail')}
                        className={cn(
                          'group inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors max-w-[180px]',
                          activeTab === 'sub-detail'
                            ? 'bg-background text-foreground border border-b-0 border-border'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        <span className="truncate">{subDetailLabel || 'Sub-detail'}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="inline-flex items-center justify-center h-4 w-4 rounded-sm shrink-0 opacity-50 hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleCloseSubTab(); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleCloseSubTab(); } }}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <div className="flex items-center gap-0.5 px-2 py-1">
                    {(hasPrev || hasNext) && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={onPrev}
                          disabled={!hasPrev}
                          title="Previous"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={onNext}
                          disabled={!hasNext}
                          title="Next"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {listCollapsed ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleRestore}
                        title="Restore split view"
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleExpand}
                        title="Expand to full width"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {hasSelection ? (
                  showSubTabs
                    ? (activeTab === 'sub-detail' ? subDetail : detail)
                    : detail
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    {EmptyIcon && (
                      <div className="rounded-full bg-muted p-4 mb-4">
                        <EmptyIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {emptyMessage || 'Select an item to view details'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          {/* Sub-detail panel (wide screens only) */}
          {showSubPanel && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id={`${layoutId}-sub`}
                defaultSize="38%"
                minSize="25%"
                className="rounded-lg border bg-card"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between gap-1 px-2 py-1 border-b shrink-0 bg-muted/30">
                    {subDetailLabel && (
                      <span className="text-xs font-medium text-muted-foreground truncate pl-1">
                        {subDetailLabel}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto"
                      onClick={onCloseSubDetail}
                      title="Close"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {subDetail}
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    );
  }

  // Mobile layout
  return (
    <div className={cn('relative h-[calc(100vh-7rem)] overflow-hidden', className)}>
      <div
        className={cn(
          'absolute inset-0 overflow-y-auto transition-all duration-300',
          hasSelection && 'opacity-0 pointer-events-none',
        )}
      >
        {list}
      </div>

      <SwipeablePanel open={hasSelection} onSwipeRight={onBack}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            {(hasPrev || hasNext) && (
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev} disabled={!hasPrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={!hasNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {detail}
          </div>
        </div>
      </SwipeablePanel>

      {hasSubDetail && (
        <SwipeablePanel open={hasSubDetail} onSwipeRight={onCloseSubDetail}>
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseSubDetail}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {subDetail}
            </div>
          </div>
        </SwipeablePanel>
      )}
    </div>
  );
}
