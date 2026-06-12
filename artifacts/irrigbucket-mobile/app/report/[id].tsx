import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';
import { calculateTestResults, calcKlineApplication } from '@/lib/calculations';

const TYPE_LABELS: Record<string, string> = {
  pivot: 'Centre Pivot', lateral: 'Lateral Move', kline: 'K-Line / Pods',
  gun: 'Travelling Gun', solid: 'Solid Set / Fixed', boom: 'Roto Rainer',
};

export default function ReportDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { savedReports } = useWizard();

  const report = useMemo(() => savedReports.find(r => r.id === id), [savedReports, id]);

  const results = useMemo(
    () => report ? calculateTestResults(report.volumes, report.systemParams.diameter, report.systemParams.targetDepth, report.sections) : null,
    [report]
  );

  const klineApp = useMemo(
    () => report && report.irrigatorType === 'kline' && results
      ? calcKlineApplication(results.avgDepth, report.systemParams.targetDepth, report.systemParams.klineTestMinutes, report.systemParams.klineSetHours)
      : null,
    [report, results]
  );

  if (!report || !results) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StepHeader title="Report" showBack />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Report not found.</Text>
        </View>
      </View>
    );
  }

  const date = new Date(report.savedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
  const duPct = (results.du * 100).toFixed(1);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="Report Detail" showBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Farm header */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}>
          <Text style={[styles.heroFarm, { color: colors.foreground }]}>{report.operationData.farmName || 'Unnamed Farm'}</Text>
          <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
            {TYPE_LABELS[report.irrigatorType ?? ''] ?? report.irrigatorType} · {date}
          </Text>
          {report.operationData.assessorName && (
            <View style={styles.heroMetaRow}>
              <Feather name="user" size={13} color={colors.mutedForeground} />
              <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>{report.operationData.assessorName}</Text>
            </View>
          )}
        </View>

        {/* DU */}
        <View style={[styles.duCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.duLabel, { color: colors.mutedForeground }]}>Distribution Uniformity</Text>
          <Text style={[styles.duValue, { color: colors.primary }]}>{duPct}%</Text>
          <StatusBadge status={results.duStatus} label={results.duStatus === 'good' ? 'Good ≥ 80%' : results.duStatus === 'fair' ? 'Fair 65–80%' : 'Poor < 65%'} />
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {(klineApp
            ? [
                { label: 'Application Depth / Set', value: `${klineApp.perSetDepth.toFixed(1)} mm` },
                { label: 'Application Rate', value: `${klineApp.applicationRate.toFixed(2)} mm/hr` },
                { label: 'Target Depth', value: `${results.targetDepth} mm` },
                { label: 'Depth Deviation', value: `${klineApp.depthDiff.toFixed(1)}%` },
                { label: 'Set Run Time', value: `${klineApp.setHours} hr` },
                { label: 'Buckets Used', value: `${results.validVolumes.length}` },
              ]
            : [
                { label: 'Avg Depth Applied', value: `${results.avgDepth.toFixed(1)} mm` },
                { label: 'Target Depth', value: `${results.targetDepth} mm` },
                { label: 'Depth Deviation', value: `${results.depthDiff.toFixed(1)}%` },
                { label: 'Avg Volume', value: `${(results.avgVolume * 1000).toFixed(0)} mL` },
                { label: 'Std Dev', value: `${(results.stdDev * 1000).toFixed(1)} mL` },
                { label: 'Buckets Used', value: `${results.validVolumes.length}` },
              ]
          ).map((item, i) => (
            <View key={i} style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {klineApp && (
          <View style={[styles.card, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>How this was calculated</Text>
            <Text style={[styles.klineNote, { color: colors.mutedForeground }]}>
              Buckets caught {klineApp.caughtDepth.toFixed(2)} mm in {klineApp.testMinutes} min = {klineApp.applicationRate.toFixed(2)} mm/hr.
              Over a {klineApp.setHours}-hour set this applies {klineApp.perSetDepth.toFixed(1)} mm (target {results.targetDepth} mm).
              Method: IrrigationNZ / DairyNZ bucket test.
            </Text>
          </View>
        )}

        {/* Section results */}
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

        {/* Raw volumes */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Raw Volumes (mL)</Text>
          <View style={styles.volumeGrid}>
            {report.volumes.map((v, i) => (
              <View
                key={i}
                style={[
                  styles.volumeChip,
                  { backgroundColor: v > 0 ? colors.primary + '15' : colors.muted, borderColor: v > 0 ? colors.primary + '40' : colors.border }
                ]}
              >
                <Text style={[styles.volumeNum, { color: colors.mutedForeground }]}>#{i + 1}</Text>
                <Text style={[styles.volumeVal, { color: v > 0 ? colors.foreground : colors.mutedForeground }]}>
                  {v > 0 ? v : '—'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16 },
  heroCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 4 },
  heroFarm: { fontSize: 22, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  heroMeta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  duCard: { borderRadius: 20, borderWidth: 1.5, padding: 24, alignItems: 'center', gap: 10 },
  duLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  duValue: { fontSize: 56, fontFamily: 'Outfit_700Bold', letterSpacing: -2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { width: '47.5%', borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 4 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 20 },
  cardTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', marginBottom: 12 },
  klineNote: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  secRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, gap: 12 },
  secName: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  secStats: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  volumeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  volumeChip: { width: '22%', borderRadius: 10, borderWidth: 1, padding: 8, alignItems: 'center', gap: 2 },
  volumeNum: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  volumeVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
