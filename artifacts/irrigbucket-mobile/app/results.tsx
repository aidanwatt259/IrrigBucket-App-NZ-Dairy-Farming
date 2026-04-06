import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';
import { calculateTestResults } from '@/lib/calculations';

export default function ResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const { volumes, systemParams, plan, sections, irrigatorType, operationData, saveCurrentReport, reset } = useWizard();
  const savedRef = useRef(false);

  useEffect(() => {
    if (!plan || volumes.length === 0) { router.replace('/'); return; }
  }, [plan, volumes]);

  const results = useMemo(
    () => plan ? calculateTestResults(volumes, systemParams.diameter, systemParams.targetDepth, sections) : null,
    [volumes, systemParams.diameter, systemParams.targetDepth, sections, plan]
  );

  useEffect(() => {
    if (results && !savedRef.current) {
      savedRef.current = true;
      saveCurrentReport();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [results]);

  if (!plan || !results) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;

  const handleNewTest = () => {
    reset();
    router.replace('/');
  };

  const duPct = (results.du * 100).toFixed(1);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="Test Results" step={totalSteps} totalSteps={totalSteps} showBack={false} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Main DU card */}
        <View style={[styles.duCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.duLabel, { color: colors.mutedForeground }]}>Distribution Uniformity</Text>
          <Text style={[styles.duValue, { color: colors.primary }]}>{duPct}%</Text>
          <StatusBadge status={results.duStatus} label={results.duStatus === 'good' ? 'Good ≥ 80%' : results.duStatus === 'fair' ? 'Fair 65–80%' : 'Poor < 65%'} />
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Avg Depth Applied', value: `${results.avgDepth.toFixed(1)} mm`, status: results.depthStatus },
            { label: 'Target Depth', value: `${results.targetDepth} mm`, status: null },
            { label: 'Depth Deviation', value: `${results.depthDiff.toFixed(1)}%`, status: results.depthStatus },
            { label: 'Avg Volume', value: `${(results.avgVolume * 1000).toFixed(0)} mL`, status: null },
            { label: 'Std Dev', value: `${(results.stdDev * 1000).toFixed(1)} mL`, status: null },
            { label: 'Buckets Used', value: `${results.validVolumes.length}`, status: null },
          ].map((item, i) => (
            <View key={i} style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{item.value}</Text>
              {item.status && <StatusBadge status={item.status} />}
            </View>
          ))}
        </View>

        {/* Sections */}
        {results.sections.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Section Results</Text>
            {results.sections.map((sec, i) => (
              <View key={i} style={[styles.secRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.secName, { color: colors.foreground }]}>{sec.name}</Text>
                  <Text style={[styles.secStats, { color: colors.mutedForeground }]}>
                    {sec.bucketCount} buckets · {sec.avgDepth.toFixed(1)}mm avg
                  </Text>
                </View>
                <StatusBadge status={sec.duStatus} label={`DU ${(sec.du * 100).toFixed(0)}%`} />
              </View>
            ))}
          </View>
        )}

        {/* Operation details */}
        {(operationData.farmName || operationData.assessorName) && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Test Details</Text>
            {operationData.farmName && (
              <View style={styles.detailRow}>
                <Feather name="home" size={14} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>{operationData.farmName}</Text>
              </View>
            )}
            {operationData.assessorName && (
              <View style={styles.detailRow}>
                <Feather name="user" size={14} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>{operationData.assessorName}</Text>
              </View>
            )}
            {operationData.irrigatorName && (
              <View style={styles.detailRow}>
                <Feather name="droplet" size={14} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>{operationData.irrigatorName}</Text>
              </View>
            )}
          </View>
        )}

        {/* Recommendation */}
        <View style={[
          styles.recCard,
          {
            backgroundColor: results.duStatus === 'good' ? colors.primary + '12' : results.duStatus === 'fair' ? colors.fair + '12' : colors.poor + '12',
            borderColor: results.duStatus === 'good' ? colors.primary + '40' : results.duStatus === 'fair' ? colors.fair + '40' : colors.poor + '40',
          }
        ]}>
          <Feather
            name={results.duStatus === 'good' ? 'check-circle' : results.duStatus === 'fair' ? 'alert-circle' : 'x-circle'}
            size={20}
            color={results.duStatus === 'good' ? colors.primary : results.duStatus === 'fair' ? colors.fair : colors.poor}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.recTitle, { color: colors.foreground }]}>
              {results.duStatus === 'good' ? 'Excellent uniformity' : results.duStatus === 'fair' ? 'Acceptable uniformity' : 'Poor uniformity — action required'}
            </Text>
            <Text style={[styles.recBody, { color: colors.mutedForeground }]}>
              {results.duStatus === 'good'
                ? 'Your irrigation system is performing well. Schedule the next test in 12 months.'
                : results.duStatus === 'fair'
                ? 'Monitor performance and consider maintenance. Retest in 6 months.'
                : 'Inspect nozzles, pressure regulators, and emitters. Contact your irrigation specialist.'
              }
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <AppButton label="View Saved Reports" variant="outline" onPress={() => router.push('/reports')} testID="view-reports" />
          <AppButton label="Start New Test" onPress={handleNewTest} testID="new-test" />
        </View>

        <Text style={[styles.savedNote, { color: colors.mutedForeground }]}>
          ✓ Report saved locally
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  duCard: { borderRadius: 20, borderWidth: 1.5, padding: 28, alignItems: 'center', gap: 12 },
  duLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  duValue: { fontSize: 64, fontFamily: 'Outfit_700Bold', letterSpacing: -2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { width: '47.5%', borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 4 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 20, gap: 0 },
  cardTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', marginBottom: 12 },
  secRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, gap: 12 },
  secName: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  secStats: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  detailText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  recCard: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  recTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  recBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  actions: { gap: 10 },
  savedNote: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
