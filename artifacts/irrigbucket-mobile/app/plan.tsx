import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';

const TYPE_LABELS: Record<string, string> = {
  pivot: 'Centre Pivot', lateral: 'Lateral Move', kline: 'K-Line / Pods',
  gun: 'Travelling Gun', solid: 'Solid Set / Fixed', boom: 'Roto Rainer',
};

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const { plan, irrigatorType } = useWizard();

  if (!plan) {
    router.replace('/setup');
    return null;
  }

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="Test Plan" step={isPivot ? 3 : 3} totalSteps={totalSteps} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>

        {/* System type pill */}
        <View style={[styles.typePill, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
          <Feather name="droplet" size={14} color={colors.primary} />
          <Text style={[styles.typeLabel, { color: colors.primary }]}>
            {TYPE_LABELS[irrigatorType ?? ''] ?? irrigatorType}
          </Text>
        </View>

        {/* Summary cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{plan.bucketCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Buckets</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{plan.spacing}m</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Spacing</Text>
          </View>
        </View>

        {/* Placement pattern */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Placement Pattern</Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.foreground }]}>{plan.pattern}</Text>
        </View>

        {/* Pivot sections table */}
        {isPivot && plan.pivotSections && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="layers" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Section Breakdown</Text>
            </View>
            <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.th, { color: colors.mutedForeground, flex: 2 }]}>Section</Text>
              <Text style={[styles.th, { color: colors.mutedForeground }]}>Range</Text>
              <Text style={[styles.th, { color: colors.mutedForeground }]}>Buckets</Text>
              <Text style={[styles.th, { color: colors.mutedForeground }]}>Spacing</Text>
            </View>
            {plan.pivotSections.map((sec, i) => (
              <View
                key={i}
                style={[
                  styles.tableRow,
                  { borderBottomColor: colors.border },
                  sec.isExcluded && { opacity: 0.5 },
                ]}
              >
                <Text style={[styles.td, { color: colors.foreground, flex: 2 }]} numberOfLines={2}>{sec.name}</Text>
                <Text style={[styles.td, { color: colors.foreground }]}>{sec.from}–{sec.to}m</Text>
                <Text style={[styles.td, { color: colors.foreground }]}>{sec.isExcluded ? '—' : sec.buckets}</Text>
                <Text style={[styles.td, { color: colors.foreground }]}>{sec.isExcluded ? '—' : `${sec.spacing}m`}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tip */}
        <View style={[styles.tipCard, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
          <Feather name="info" size={16} color={colors.secondary} style={{ marginTop: 1 }} />
          <Text style={[styles.tipText, { color: colors.foreground }]}>
            Number your buckets <Text style={{ fontFamily: 'Inter_600SemiBold' }}>1 to {plan.bucketCount}</Text> in the field before collecting volumes.
          </Text>
        </View>

        <AppButton
          label={isPivot ? 'Record Operation Details →' : 'Enter Bucket Volumes →'}
          size="lg"
          onPress={() => router.push(isPivot ? '/operation' : '/data-entry')}
          testID="next-button"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  typeLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 20, alignItems: 'center' },
  statNum: { fontSize: 36, fontFamily: 'Outfit_700Bold', letterSpacing: -1 },
  statLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 20, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold' },
  cardBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1 },
  th: { flex: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  tipCard: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
