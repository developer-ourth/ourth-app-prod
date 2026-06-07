import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  message?: string;
}

export function LoadingSpinner({ size = 'large', message }: LoadingSpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size={size} color="#16a34a" />
      {message && <Text className="mt-3 text-sm text-gray-500">{message}</Text>}
    </View>
  );
}
