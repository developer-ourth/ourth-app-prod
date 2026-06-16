import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, type TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
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
  style,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], styles[size], disabled || loading ? styles.disabled : null, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#16a34a'} />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  primary: { backgroundColor: '#16a34a' },
  outline: { borderWidth: 1, borderColor: '#16a34a', backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  sm: { paddingHorizontal: 12, paddingVertical: 8 },
  md: { paddingHorizontal: 16, paddingVertical: 14 },
  lg: { paddingHorizontal: 24, paddingVertical: 16 },
  disabled: { opacity: 0.6 },
  text: { fontWeight: '600' },
  primaryText: { color: '#fff' },
  outlineText: { color: '#16a34a' },
  ghostText: { color: '#16a34a' },
  smText: { fontSize: 14 },
  mdText: { fontSize: 16 },
  lgText: { fontSize: 16 },
});
