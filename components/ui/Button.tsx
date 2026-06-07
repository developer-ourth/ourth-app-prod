import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT_STYLES = {
  primary: { container: 'bg-primary-600', text: 'text-white' },
  outline: { container: 'border border-primary-600 bg-transparent', text: 'text-primary-600' },
  ghost: { container: 'bg-transparent', text: 'text-primary-600' },
};

const SIZE_STYLES = {
  sm: { container: 'px-3 py-2', text: 'text-sm' },
  md: { container: 'px-4 py-3.5', text: 'text-base' },
  lg: { container: 'px-6 py-4', text: 'text-base' },
};

export function Button({
  title,
  loading = false,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  return (
    <TouchableOpacity
      className={`items-center justify-center rounded-xl ${v.container} ${s.container} ${disabled || loading ? 'opacity-60' : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#16a34a'} />
      ) : (
        <Text className={`font-semibold ${v.text} ${s.text}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
