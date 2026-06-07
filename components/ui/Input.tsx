import { View, Text, TextInput, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...rest }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-sm font-medium text-gray-700">{label}</Text>}
      <TextInput
        className={`w-full rounded-xl border px-4 py-3.5 text-base text-gray-900 ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'} ${className ?? ''}`}
        placeholderTextColor="#9ca3af"
        {...rest}
      />
      {error && <Text className="text-xs text-red-500">{error}</Text>}
    </View>
  );
}
