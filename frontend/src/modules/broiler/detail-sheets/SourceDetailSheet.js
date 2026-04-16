import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import SourceDetail from '@/modules/broiler/details/SourceDetail';

export default function SourceDetailSheet({ open, onOpenChange, sourceId, onEdit, stacked }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('sm:max-w-lg flex flex-col p-0', stacked && 'z-[60]')}>
        <SourceDetail
          sourceId={sourceId}
          onEdit={onEdit}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
