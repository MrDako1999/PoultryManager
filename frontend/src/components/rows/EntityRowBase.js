import { cn } from '@/lib/utils';

export default function EntityRowBase({ onClick, selected, className, children, actions }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-accent/50',
        selected && 'bg-accent',
        className,
      )}
    >
      {children}
      {actions}
    </div>
  );
}
