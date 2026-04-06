import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';

import { useColors } from '@/hooks/useColors';

interface AppButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function AppButton({ label, variant = 'primary', size = 'md', loading, disabled, style, ...rest }: AppButtonProps) {
  const colors = useColors();

  const bg = variant === 'primary' ? colors.primary
    : variant === 'destructive' ? colors.destructive
    : 'transparent';

  const borderColor = variant === 'outline' ? colors.border : 'transparent';
  const textColor = variant === 'primary' ? colors.primaryForeground
    : variant === 'destructive' ? colors.destructiveForeground
    : variant === 'outline' ? colors.foreground
    : colors.mutedForeground;

  const height = size === 'lg' ? 54 : size === 'sm' ? 36 : 46;
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 13 : 15;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled || loading}
      style={[
        styles.base,
        { backgroundColor: bg, borderColor, height, borderRadius: 12, opacity: disabled ? 0.5 : 1 },
        variant === 'outline' && { borderWidth: 1.5 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize, fontFamily: 'Inter_600SemiBold' }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    letterSpacing: -0.2,
  },
});
