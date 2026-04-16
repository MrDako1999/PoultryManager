import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import TransferDetail from '@/modules/broiler/details/TransferDetail';

export default function TransferDetailSheet({ open, onOpenChange, transferId, onEdit, stacked }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('sm:max-w-lg flex flex-col p-0', stacked && 'z-[60]')}>
        <TransferDetail
          transferId={transferId}
          onEdit={onEdit}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
