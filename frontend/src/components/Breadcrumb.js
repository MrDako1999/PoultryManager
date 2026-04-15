import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Breadcrumb({ items, className }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className={cn('flex items-center gap-1 text-sm text-muted-foreground mb-4 min-w-0 overflow-x-auto', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.to || i} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">{item.label}</span>
            ) : (
              <Link
                to={item.to}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
