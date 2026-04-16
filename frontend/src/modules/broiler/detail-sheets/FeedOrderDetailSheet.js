import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import FeedOrderDetail from '@/modules/broiler/details/FeedOrderDetail';

export default function FeedOrderDetailSheet({ open, onOpenChange, feedOrderId, onEdit, stacked }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('sm:max-w-lg flex flex-col p-0', stacked && 'z-[60]')}>
        <FeedOrderDetail
          feedOrderId={feedOrderId}
          onEdit={onEdit}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
