import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function SidebarTooltip({ label, rtl, show, children, sideOffset = 8 }) {
  if (!show) return children;
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={rtl ? 'left' : 'right'} sideOffset={sideOffset}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
