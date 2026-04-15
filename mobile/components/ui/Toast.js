import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../../lib/utils';

const ToastContext = createContext(null);

function ToastItem({ toast: t, onDismiss }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [anim]);

  const animatedStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  return (
    <Animated.View
      style={animatedStyle}
      className={cn(
        'mb-2 rounded-lg border p-4 flex-row items-start',
        t.variant === 'destructive'
          ? 'bg-destructive border-destructive'
          : 'bg-card border-border'
      )}
    >
      <View className="flex-1">
        {t.title && (
          <Text
            className={cn(
              'text-sm font-semibold',
              t.variant === 'destructive' ? 'text-destructive-foreground' : 'text-card-foreground'
            )}
          >
            {t.title}
          </Text>
        )}
        {t.description && (
          <Text
            className={cn(
              'text-sm mt-1',
              t.variant === 'destructive' ? 'text-destructive-foreground/90' : 'text-muted-foreground'
            )}
          >
            {t.description}
          </Text>
        )}
      </View>
      <Pressable onPress={() => onDismiss(t.id)} hitSlop={8} className="ml-2">
        <X
          size={16}
          color={t.variant === 'destructive' ? '#ffffff' : 'hsl(150, 10%, 45%)'}
        />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const insets = useSafeAreaInsets();
  const counterRef = useRef(0);

  const toast = useCallback(({ title, description, variant = 'default', duration = 4000 }) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <View
        className="absolute left-4 right-4 z-50"
        style={{ top: insets.top + 8 }}
        pointerEvents="box-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
