import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/useColors';

interface StatusBadgeProps {
  status: 'good' | 'fair' | 'poor';
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = useColors();

  const color = status === 'good' ? colors.good : status === 'fair' ? colors.fair : colors.poor;
  const defaultLabel = status === 'good' ? 'Good' : status === 'fair' ? 'Fair' : 'Poor';

  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label ?? defaultLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
