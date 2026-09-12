import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';
import { duStatusRating, calculateTestResults } from '@/lib/calculations';

const TYPE_LABELS: Record<string, string> = {
  pivot: 'Centre Pivot', lateral: 'Lateral Move', kline: 'K-Line / Pods',
  gun: 'Travelling Gun', solid: 'Solid Set / Fixed', boom: 'Roto Rainer',
};

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const { savedReports, deleteReport } = useWizard();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="Saved Reports" showBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>
        {savedReports.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No saved reports</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Complete a bucket test to see your reports here.
            </Text>
            <AppButton label="Start a Test" onPress={() => router.push('/')} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <>
            <Text style={[styles.count, { color: colors.mutedForeground }]}>{savedReports.length} report{savedReports.length !== 1 ? 's' : ''}</Text>
            {savedReports.map((report) => {
              const results = calculateTestResults(report.volumes, report.systemParams.diameter, report.systemParams.targetDepth, report.sections);
              const duPct = results ? (results.du * 100).toFixed(1) : null;
              const duStatus = results ? results.duStatus : null;
              const date = new Date(report.savedAt);
              const dateStr = date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <TouchableOpacity
                  key={report.id}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
                  testID={`report-${report.id}`}
                >
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.cardFarm, { color: colors.foreground }]}>
                          {report.operationData.farmName || 'Unnamed Farm'}
                        </Text>
                        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                          {TYPE_LABELS[report.irrigatorType ?? ''] ?? report.irrigatorType} · {dateStr}
                        </Text>
                      </View>
                      {duPct && duStatus && (
                        <View style={styles.duCol}>
                          <Text style={[styles.duNum, { color: colors.primary }]}>{duPct}%</Text>
                          <StatusBadge status={duStatus} />
                        </View>
                      )}
                    </View>
                    <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                      <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                        <Feather name="droplet" size={12} /> {report.volumes.filter(v => v > 0).length} buckets
                        {report.operationData.assessorName ? `  ·  ${report.operationData.assessorName}` : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            'Delete report?',
                            `"${report.operationData.farmName || 'Unnamed Farm'}" will be removed from your device. This cannot be undone.`,
                            [
                              { text: 'Keep report', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteReport(report.id) },
                            ],
                          )
                        }
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        testID={`delete-${report.id}`}
                      >
                        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 260, lineHeight: 22 },
  count: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  cardFarm: { fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: -0.3 },
  cardMeta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  duCol: { alignItems: 'flex-end', gap: 4 },
  duNum: { fontSize: 22, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10 },
  footerText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
