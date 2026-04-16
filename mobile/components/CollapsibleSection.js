import { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, UIManager, Platform } from 'react-native';
import { ChevronDown, ChevronRight, Plus, ArrowRight } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CollapsibleSection({
  title,
  icon: Icon,
  headerExtra,
  onAdd,
  addLabel,
  expandTo,
  onExpand,
  persistKey,
  items,
  renderItem,
  maxItems,
  itemCount,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const mutedColor = 'hsl(150, 10%, 45%)';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const displayItems = items && maxItems != null ? items.slice(0, maxItems) : items;
  const totalCount = itemCount ?? items?.length ?? 0;
  const isLimited = maxItems != null && totalCount > maxItems;
  const content = children || (displayItems?.map(renderItem) ?? null);
  const hasContent = displayItems ? displayItems.length > 0 : !!children;
  const showFooter = expandTo && onExpand;

  const toggleOpen = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  }, [open]);

  return (
    <View className="rounded-lg border border-border bg-card overflow-hidden">
      <Pressable
        onPress={toggleOpen}
        className="flex-row items-center px-3 py-2.5"
      >
        {open
          ? <ChevronDown size={16} color={iconColor} />
          : <ChevronRight size={16} color={iconColor} />
        }
        {Icon && <Icon size={14} color={mutedColor} style={{ marginLeft: 6 }} />}
        <Text className="text-sm font-semibold text-foreground ml-1.5 flex-1" numberOfLines={1}>
          {title}
        </Text>
        {headerExtra}
      </Pressable>

      {open && (
        <>
          {hasContent ? content : (
            <View className="px-3 py-6 items-center">
              <Text className="text-xs text-muted-foreground">No entries yet</Text>
            </View>
          )}
          {(showFooter || onAdd) && (
            <View className="flex-row items-center border-t border-border">
              {onAdd && (
                <Pressable
                  onPress={onAdd}
                  className="flex-1 flex-row items-center justify-center py-2.5 active:bg-accent/50"
                >
                  <Plus size={14} color={primaryColor} />
                  <Text className="text-xs text-primary font-medium ml-1">
                    {addLabel || 'Add'}
                  </Text>
                </Pressable>
              )}
              {onAdd && showFooter && (
                <View className="w-px self-stretch bg-border" />
              )}
              {showFooter && (
                <Pressable
                  onPress={onExpand}
                  className="flex-1 flex-row items-center justify-center py-2.5 active:bg-accent/50"
                >
                  <Text className="text-xs text-primary font-medium mr-1">
                    {isLimited ? `View All (${totalCount})` : 'View All'}
                  </Text>
                  <ArrowRight size={12} color={primaryColor} />
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}
