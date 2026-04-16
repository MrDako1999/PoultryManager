import { View, TextInput, Text } from 'react-native';
import { cn } from '@/lib/utils';

export default function PhoneInput({ value, onChange, className }) {
  return (
    <View className={cn('flex-row items-center', className)}>
      <View className="h-12 px-3 rounded-l-md border border-r-0 border-input bg-muted justify-center">
        <Text className="text-sm text-muted-foreground">+971</Text>
      </View>
      <TextInput
        className="flex-1 h-12 rounded-r-md border border-input bg-background px-3 text-sm text-foreground"
        value={value?.replace(/^\+971/, '') || ''}
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, '');
          onChange?.(digits ? `+971${digits}` : '');
        }}
        keyboardType="phone-pad"
        placeholder="50 123 4567"
        placeholderTextColor="hsl(150, 10%, 45%)"
      />
    </View>
  );
}
