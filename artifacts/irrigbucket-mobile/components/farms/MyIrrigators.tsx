import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { IrrigatorStatus, LocalFarm, LocalIrrigator, TestSummary } from '@workspace/sync';
import { describeDue, formatDate, irrigatorStatus, todayString } from '@workspace/sync';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { useColors } from '@/hooks/useColors';
import { useFarmDirectory } from '@/lib/sync/farmDirectory';

const TYPE_NAMES: Record<string, string> = {
  pivot: 'Centre Pivot',
  lateral: 'Lateral Move',
  kline: 'K-Line / Pods',
  gun: 'Travelling Gun',
  solid: 'Solid Set',
  boom: 'Roto Rainer',
};

export interface IrrigatorRow {
  farm: LocalFarm;
  irrigator: LocalIrrigator;
  status: IrrigatorStatus;
}

/** Sort: overdue first, then due soon, never tested, then by due date. */
function rowOrder(a: IrrigatorRow, b: IrrigatorRow): number {
  const rank = { overdue: 0, 'due-soon': 1, never: 2, ok: 3 } as const;
  const diff = rank[a.status.state] - rank[b.status.state];
  if (diff !== 0) return diff;
  if (a.status.nextDue && b.status.nextDue && a.status.nextDue !== b.status.nextDue) {
    return a.status.nextDue < b.status.nextDue ? -1 : 1;
  }
  return a.farm.name.localeCompare(b.farm.name) || a.irrigator.name.localeCompare(b.irrigator.name);
}

/** Every saved irrigator with its last result and next test, ready to render. */
export function useIrrigatorRows(tests: TestSummary[]): IrrigatorRow[] {
  const snapshot = useFarmDirectory();
  return useMemo(() => {
    const today = todayString();
    const farms = new Map(snapshot.farms.filter((f) => f.deletedAt === null).map((f) => [f.id, f]));
    const rows: IrrigatorRow[] = [];
    for (const irrigator of snapshot.irrigators) {
      const farm = farms.get(irrigator.farmId);
      if (!farm || irrigator.deletedAt !== null) continue;
      rows.push({ farm, irrigator, status: irrigatorStatus(irrigator, tests, today) });
    }
    return rows.sort(rowOrder);
  }, [snapshot, tests]);
}

/** The farmer's home dashboard: every saved irrigator, its last result and next test. */
export function MyIrrigators({
  rows,
  onTest,
  onOpenReport,
}: {
  rows: IrrigatorRow[];
  onTest: (row: IrrigatorRow) => void;
  onOpenReport: (reportId: string) => void;
}) {
  const colors = useColors();
  if (rows.length === 0) return null;

  const needingTest = rows.filter((r) => r.status.state === 'overdue' || r.status.state === 'due-soon').length;
  const showFarmNames = new Set(rows.map((r) => r.farm.id)).size > 1;
  const dueColor = (state: IrrigatorStatus['state']) =>
    state === 'overdue' ? colors.poor : state === 'due-soon' ? colors.fair : colors.mutedForeground;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground }]}>My irrigators</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {needingTest === 0
          ? 'All up to date.'
          : needingTest === 1
            ? '1 irrigator is due for a bucket test.'
            : `${needingTest} irrigators are due for a bucket test.`}
      </Text>
      <View style={styles.list}>
        {rows.map((row) => {
          const { irrigator, farm, status } = row;
          const last = status.lastTest;
          return (
            <View
              key={irrigator.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              testID={`irrigator-${irrigator.id}`}
            >
              <View style={styles.headRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {irrigator.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {showFarmNames ? `${farm.name} · ` : ''}
                    {TYPE_NAMES[irrigator.type] ?? irrigator.type}
                  </Text>
                </View>
                {last?.du != null && last.duStatus ? (
                  <StatusBadge status={last.duStatus} label={`DU ${Math.round(last.du * 100)}%`} />
                ) : null}
              </View>

              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {last ? `Last tested ${formatDate(last.testDate)}` : 'No test recorded yet'}
              </Text>
              <View style={styles.dueRow}>
                <Feather
                  name={status.state === 'overdue' ? 'alert-triangle' : status.state === 'ok' ? 'check-circle' : 'clock'}
                  size={14}
                  color={dueColor(status.state)}
                />
                <Text style={[styles.due, { color: dueColor(status.state) }]}>
                  {status.state === 'never' ? 'Run its first test' : describeDue(status)}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => onTest(row)}
                  activeOpacity={0.8}
                  testID={`test-${irrigator.id}`}
                  style={[styles.btn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="play" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Test now</Text>
                </TouchableOpacity>
                {last && (
                  <TouchableOpacity
                    onPress={() => onOpenReport(last.reportId)}
                    activeOpacity={0.8}
                    testID={`report-${irrigator.id}`}
                    style={[styles.btn, styles.btnOutline, { borderColor: colors.border }]}
                  >
                    <Feather name="file-text" size={14} color={colors.foreground} />
                    <Text style={[styles.btnText, { color: colors.foreground }]}>Last report</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  title: { fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  list: { gap: 10 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 15, fontFamily: 'Outfit_700Bold', letterSpacing: -0.2 },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  due: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  btnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
