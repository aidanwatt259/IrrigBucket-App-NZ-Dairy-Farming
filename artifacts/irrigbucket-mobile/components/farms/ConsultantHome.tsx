import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { FarmInput, FarmSummary, LocalFarm, TestSummary } from '@workspace/sync';
import { describeFarm, formatDate, summarizeFarm, todayString } from '@workspace/sync';

import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { farmDirectory, useFarmDirectory } from '@/lib/sync/farmDirectory';
import { requestFarmSync } from '@/lib/sync/syncEngine';

import { FarmForm } from './FarmForm';

interface FarmRow {
  farm: LocalFarm;
  summary: FarmSummary;
}

function farmOrder(a: FarmRow, b: FarmRow): number {
  const urgency = (s: FarmSummary) => (s.overdue ? 0 : s.dueSoon ? 1 : s.neverTested ? 2 : 3);
  return urgency(a.summary) - urgency(b.summary) || a.farm.name.localeCompare(b.farm.name);
}

/** The consultant's Home: every client farm and what needs testing. */
export function ConsultantHome({ tests }: { tests: TestSummary[] }) {
  const colors = useColors();
  const snapshot = useFarmDirectory();
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const today = todayString();
    const live = snapshot.irrigators.filter((i) => i.deletedAt === null);
    return snapshot.farms
      .filter((f) => f.deletedAt === null)
      .map((farm) => ({
        farm,
        summary: summarizeFarm(live.filter((i) => i.farmId === farm.id), tests, today),
      }))
      .sort(farmOrder);
  }, [snapshot, tests]);

  const totals = rows.reduce(
    (acc, { summary }) => ({
      irrigators: acc.irrigators + summary.irrigatorCount,
      due: acc.due + summary.overdue + summary.dueSoon,
    }),
    { irrigators: 0, due: 0 },
  );

  const handleAdd = async (input: FarmInput) => {
    const farm = await farmDirectory.createFarm(input);
    void requestFarmSync().catch(() => {});
    setAdding(false);
    router.push(`/farm/${farm.id}`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Your farms</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Bucket testing across every client.</Text>
        </View>
        {!adding && (
          <TouchableOpacity
            onPress={() => setAdding(true)}
            activeOpacity={0.8}
            testID="add-farm"
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add farm</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.stats}>
        {[
          { label: 'Farms', value: rows.length, icon: 'home' as const, color: colors.primary },
          { label: 'Irrigators', value: totals.irrigators, icon: 'droplet' as const, color: colors.primary },
          { label: 'Due', value: totals.due, icon: 'alert-triangle' as const, color: totals.due > 0 ? colors.poor : colors.good },
        ].map((s) => (
          <View key={s.label} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={s.icon} size={16} color={s.color} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {adding && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Add a farm</Text>
          <FarmForm full={false} submitLabel="Add farm" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </View>
      )}

      {rows.length === 0 ? (
        !adding && (
          <View style={[styles.card, styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="home" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: 'center' }]}>No farms yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add your first client farm. You'll then add its irrigators and start bucket tests from the farm's page.
            </Text>
            <AppButton label="Add your first farm" onPress={() => setAdding(true)} />
          </View>
        )
      ) : (
        <View style={styles.list}>
          {rows.map(({ farm, summary }) => {
            const attention = summary.overdue > 0 || summary.dueSoon > 0;
            return (
              <TouchableOpacity
                key={farm.id}
                onPress={() => router.push(`/farm/${farm.id}`)}
                activeOpacity={0.8}
                testID={`farm-${farm.id}`}
                style={[styles.farmRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.farmName, { color: colors.foreground }]} numberOfLines={1}>
                    {farm.name}
                  </Text>
                  {!!farm.region && (
                    <Text style={[styles.farmMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {farm.region}
                    </Text>
                  )}
                  <Text style={[styles.farmMeta, { marginTop: 4 }]}>
                    <Text style={{ color: colors.mutedForeground }}>
                      {summary.irrigatorCount === 1 ? '1 irrigator' : `${summary.irrigatorCount} irrigators`} ·{' '}
                    </Text>
                    <Text style={{ color: attention ? colors.poor : colors.mutedForeground, fontFamily: attention ? 'Inter_600SemiBold' : 'Inter_400Regular' }}>
                      {describeFarm(summary)}
                    </Text>
                  </Text>
                  {summary.lastTestDate && (
                    <Text style={[styles.farmMeta, { color: colors.mutedForeground, fontSize: 11, marginTop: 2 }]}>
                      Last visit {formatDate(summary.lastTestDate)}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 12 },
  addBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 4 },
  statValue: { fontSize: 22, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  list: { gap: 10 },
  farmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14 },
  farmName: { fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: -0.2 },
  farmMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
