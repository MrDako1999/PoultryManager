import { View } from 'react-native';
import { cn } from '@/lib/utils';

export default function Separator({ className, orientation = 'horizontal' }) {
  return (
    <View
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        className
      )}
    />
  );
}
