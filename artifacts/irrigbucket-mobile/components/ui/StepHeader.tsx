import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';

interface StepHeaderProps {
  title: string;
  step?: number;
  totalSteps?: number;
  showBack?: boolean;
}

export function StepHeader({ title, step, totalSteps, showBack = true }: StepHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const progress = step && totalSteps ? step / totalSteps : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: topPad + 8 }]}>
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.muted }]}
            activeOpacity={0.7}
            testID="back-button"
          >
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        <View style={styles.backBtn} />
      </View>

      {step && totalSteps ? (
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
          </View>
          <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{step}/{totalSteps}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    minWidth: 28,
    textAlign: 'right',
  },
});
