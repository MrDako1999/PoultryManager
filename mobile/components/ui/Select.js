import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, Pressable, Modal, FlatList, TextInput,
  Dimensions, PanResponder, Animated, Keyboard,
} from 'react-native';
import { ChevronDown, Check, X, Search, Plus } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import useThemeStore from '@/stores/themeStore';
import * as Haptics from 'expo-haptics';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;
const DISMISS_THRESHOLD = 80;

export default function Select({
  value,
  onValueChange,
  options = [],
  placeholder = 'Select...',
  label,
  onCreateNew,
  createNewLabel,
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { resolvedTheme } = useThemeStore();
  const selected = options.find((o) => o.value === value);
  const mutedColor = 'hsl(150, 10%, 45%)';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
        slideOut();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
      }
    },
  }), []);

  const slideIn = useCallback(() => {
    slideAnim.setValue(SHEET_HEIGHT);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  const slideOut = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      setSearch('');
    });
  }, [slideAnim, backdropAnim]);

  const openSheet = useCallback(() => {
    setSearch('');
    setOpen(true);
    requestAnimationFrame(() => slideIn());
  }, [slideIn]);

  const handleSelect = useCallback((val) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(val);
    slideOut();
  }, [onValueChange, slideOut]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      o.label?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)
    );
  }, [options, search]);

  const showEmpty = search.trim().length > 0 && filtered.length === 0;
  const showSearch = searchable && options.length > 5;

  return (
    <>
      <Pressable
        onPress={openSheet}
        className="flex-row items-center justify-between border border-border rounded-md bg-background px-3 h-12"
      >
        <Text
          className={cn('text-sm flex-1', selected ? 'text-foreground' : 'text-muted-foreground')}
          numberOfLines={1}
        >
          {selected?.label || placeholder}
        </Text>
        <ChevronDown size={16} color={mutedColor} />
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={slideOut}>
        <View className="flex-1">
          <Animated.View
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropAnim }}
          >
            <Pressable style={{ flex: 1 }} onPress={slideOut} />
          </Animated.View>

          <Animated.View
            style={[{ height: SHEET_HEIGHT, transform: [{ translateY: slideAnim }] }]}
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl"
          >
            {/* Drag zone — generous 44pt touch target */}
            <View
              {...panResponder.panHandlers}
              className="items-center justify-center"
              style={{ height: 44 }}
            >
              <View className="w-10 h-1 rounded-full bg-border" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pb-3">
              <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
                {label || placeholder}
              </Text>
              <View className="flex-row items-center gap-2">
                {onCreateNew && (
                  <Pressable
                    onPress={() => { const s = search; slideOut(); setTimeout(() => onCreateNew(s), 250); }}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10"
                    hitSlop={8}
                  >
                    <Plus size={14} color={primaryColor} />
                    <Text className="text-xs font-semibold text-primary">
                      {createNewLabel || 'Add New'}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={slideOut} className="h-8 w-8 items-center justify-center rounded-full bg-muted" hitSlop={8}>
                  <X size={16} color={mutedColor} />
                </Pressable>
              </View>
            </View>

            {/* Search */}
            {showSearch && (
              <View className="px-4 pb-3">
                <View className="flex-row items-center gap-2.5 bg-muted/50 border border-border rounded-lg px-3 h-10">
                  <Search size={15} color={mutedColor} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={`Search ${(label || placeholder).toLowerCase()}...`}
                    placeholderTextColor={mutedColor}
                    className="flex-1 text-sm text-foreground"
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="done"
                  />
                  {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')} hitSlop={8}>
                      <X size={14} color={mutedColor} />
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Divider */}
            <View className="h-px bg-border" />

            {/* Options list — fills remaining space */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              className="flex-1"
              contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
              renderItem={({ item }) => {
                const isSelected = value === item.value;
                return (
                  <Pressable
                    onPress={() => handleSelect(item.value)}
                    className={cn(
                      'flex-row items-center px-4 py-3.5',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <View className="flex-1">
                      <Text className={cn('text-sm', isSelected ? 'text-primary font-semibold' : 'text-foreground')}>
                        {item.label}
                      </Text>
                      {item.description && (
                        <Text className="text-xs text-muted-foreground mt-0.5">{item.description}</Text>
                      )}
                    </View>
                    {isSelected && <Check size={18} color={primaryColor} strokeWidth={2.5} />}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View className="h-px bg-border mx-4" />}
              ListEmptyComponent={showEmpty ? (
                <View className="flex-1 items-center justify-center px-4 gap-3">
                  <Text className="text-sm text-muted-foreground">No results for &quot;{search}&quot;</Text>
                  {onCreateNew && (
                    <Pressable
                      onPress={() => { const s = search; slideOut(); setTimeout(() => onCreateNew(s), 250); }}
                      className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-lg border border-primary bg-primary/5"
                    >
                      <Plus size={15} color={primaryColor} />
                      <Text className="text-sm font-medium text-primary">
                        Create &quot;{search}&quot;
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            />

            {/* Bottom safe area */}
            <View className="h-8" />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
