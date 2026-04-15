import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import ExpenseDetail from '@/components/details/ExpenseDetail';

export default function ExpenseDetailSheet({ open, onOpenChange, expenseId, onEdit, onViewSource, onViewFeedOrder, onViewSaleOrder, stacked }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('sm:max-w-lg flex flex-col p-0', stacked && 'z-[60]')}>
        <ExpenseDetail
          expenseId={expenseId}
          onEdit={onEdit}
          onViewSource={onViewSource}
          onViewFeedOrder={onViewFeedOrder}
          onViewSaleOrder={onViewSaleOrder}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
