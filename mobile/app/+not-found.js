import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-4">
      <Text className="text-xl font-semibold text-foreground mb-4">Page not found</Text>
      <Link href="/" className="text-primary">
        Go home
      </Link>
    </View>
  );
}
