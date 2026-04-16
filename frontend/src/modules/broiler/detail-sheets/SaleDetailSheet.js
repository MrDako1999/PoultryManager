import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import SaleDetail from '@/modules/broiler/details/SaleDetail';

export default function SaleDetailSheet({ open, onOpenChange, saleId, onEdit, onViewExpense, stacked }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('sm:max-w-lg flex flex-col p-0', stacked && 'z-[60]')}>
        <SaleDetail
          saleId={saleId}
          onEdit={onEdit}
          onViewExpense={onViewExpense}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
