import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import useThemeStore from '@/stores/themeStore';

export default function SearchInput({ value, onChangeText, placeholder = 'Search...', debounceMs = 300 }) {
  const { resolvedTheme } = useThemeStore();
  const [local, setLocal] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => { setLocal(value || ''); }, [value]);

  const handleChange = useCallback((text) => {
    setLocal(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeText?.(text), debounceMs);
  }, [onChangeText, debounceMs]);

  const clear = () => { setLocal(''); onChangeText?.(''); };

  const mutedColor = 'hsl(150, 10%, 45%)';
  const textColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';

  return (
    <View className="flex-row items-center border border-border rounded-md bg-background px-3 h-10">
      <Search size={16} color={mutedColor} />
      <TextInput
        value={local}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={mutedColor}
        className="flex-1 ml-2 text-sm"
        style={{ color: textColor, fontFamily: 'Poppins-Regular' }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {local.length > 0 && (
        <Pressable onPress={clear} hitSlop={8}>
          <X size={16} color={mutedColor} />
        </Pressable>
      )}
    </View>
  );
}
