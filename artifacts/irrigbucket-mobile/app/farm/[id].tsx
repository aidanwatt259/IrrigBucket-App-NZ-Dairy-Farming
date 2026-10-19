import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FarmInput } from '@workspace/sync';
import { DEFAULT_TEST_INTERVAL_MONTHS, formatDate } from '@workspace/sync';

import { FarmForm } from '@/components/farms/FarmForm';
import { IrrigatorCard, TYPE_NAMES, useIrrigatorRows, type IrrigatorRow } from '@/components/farms/MyIrrigators';
import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';
import { calculateTestResults, type SystemParams } from '@/lib/calculations';
import { summarizeReports } from '@/lib/irrigatorStatus';
import { farmDirectory, useFarmDirectory } from '@/lib/sync/farmDirectory';
import { requestFarmSync } from '@/lib/sync/syncEngine';

const TYPE_ORDER = ['pivot', 'lateral', 'kline', 'gun', 'solid', 'boom'];

export default function FarmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;
  const { savedReports, startRetest, startFarmTest } = useWizard();

  const [editing, setEditing] = useState(false);
  const [addingIrrigator, setAddingIrrigator] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('pivot');
  const [newInterval, setNewInterval] = useState(String(DEFAULT_TEST_INTERVAL_MONTHS));

  useFarmDirectory();
  const farm = id ? farmDirectory.getFarm(id) : null;
  const tests = useMemo(() => summarizeReports(savedReports), [savedReports]);
  const rows = useIrrigatorRows(tests, id);
  const recentReports = useMemo(
    () =>
      savedReports
        .filter((r) => r.operationData?.farmId === id)
        .slice(0, 10)
        .map((r) => ({
          report: r,
          results: calculateTestResults(r.volumes, r.systemParams.diameter, r.systemParams.targetDepth, r.sections),
        })),
    [savedReports, id],
  );

  const header = (title: string) => (
    <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.iconBtn, { backgroundColor: colors.muted }]}
        activeOpacity={0.7}
        testID="farm-back"
      >
        <Feather name="arrow-left" size={18} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (!farm) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {header('Farm')}
        <View style={styles.missing}>
          <Text style={[styles.missingTitle, { color: colors.foreground }]}>Farm not found</Text>
          <Text style={[styles.missingText, { color: colors.mutedForeground }]}>
            It may have been removed, or hasn't synced to this device yet.
          </Text>
        </View>
      </View>
    );
  }

  const handleSaveFarm = async (input: FarmInput) => {
    await farmDirectory.updateFarm(farm.id, input);
    void requestFarmSync().catch(() => {});
    setEditing(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      `Remove ${farm.name}?`,
      `The farm and its ${rows.length === 1 ? 'irrigator' : `${rows.length} irrigators`} are removed from your farms list. Saved reports are kept.`,
      [
        { text: 'Keep farm', style: 'cancel' },
        {
          text: 'Remove farm',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await farmDirectory.deleteFarm(farm.id);
              void requestFarmSync().catch(() => {});
              router.replace('/');
            })();
          },
        },
      ],
    );
  };

  const handleAddIrrigator = async () => {
    const name = newName.trim();
    if (!name) return;
    const months = Number(newInterval);
    await farmDirectory.createIrrigator({
      farmId: farm.id,
      name,
      type: newType,
      testIntervalMonths: Number.isFinite(months) && months >= 1 ? Math.round(months) : DEFAULT_TEST_INTERVAL_MONTHS,
    });
    void requestFarmSync().catch(() => {});
    setNewName('');
    setAddingIrrigator(false);
  };

  const handleTestRow = ({ farm: f, irrigator }: IrrigatorRow) => {
    startRetest({
      irrigatorType: irrigator.type,
      details: irrigator.details as Partial<SystemParams>,
      farmId: f.id,
      farmName: f.name,
      irrigatorId: irrigator.id,
      irrigatorName: irrigator.name,
    });
    router.push('/setup');
  };

  const handleStartTest = (irrigatorType: string) => {
    startFarmTest({ irrigatorType, farmId: farm.id, farmName: farm.name });
    router.push('/setup');
  };

  const chip = (label: string, selected: boolean, onPress: () => void, testID?: string) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      activeOpacity={0.8}
      testID={testID}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.primary : colors.muted, borderColor: selected ? colors.primary : colors.border },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {header(farm.name)}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Farm details */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editing ? (
              <FarmForm initial={farm} submitLabel="Save changes" onSubmit={handleSaveFarm} onCancel={() => setEditing(false)} />
            ) : (
              <>
                <View style={styles.farmHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.farmName, { color: colors.foreground }]}>{farm.name}</Text>
                    {!!farm.region && (
                      <View style={styles.detailRow}>
                        <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{farm.region}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setEditing(true)} style={[styles.iconBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7} testID="edit-farm">
                    <Feather name="edit-2" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
                {!!farm.contactName && (
                  <View style={styles.detailRow}>
                    <Feather name="user" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.detailText, { color: colors.foreground }]}>{farm.contactName}</Text>
                  </View>
                )}
                {!!farm.contactPhone && (
                  <TouchableOpacity style={styles.detailRow} onPress={() => void Linking.openURL(`tel:${farm.contactPhone}`)}>
                    <Feather name="phone" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.detailText, { color: colors.primary }]}>{farm.contactPhone}</Text>
                  </TouchableOpacity>
                )}
                {!!farm.contactEmail && (
                  <TouchableOpacity style={styles.detailRow} onPress={() => void Linking.openURL(`mailto:${farm.contactEmail}`)}>
                    <Feather name="mail" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.detailText, { color: colors.primary }]}>{farm.contactEmail}</Text>
                  </TouchableOpacity>
                )}
                {!!farm.notes && <Text style={[styles.notes, { color: colors.mutedForeground }]}>{farm.notes}</Text>}
              </>
            )}
          </View>

          {/* Start a test */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Start a new test here</Text>
            <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
              Tap an irrigator below to re-test it, or choose a type to test something new.
            </Text>
            <View style={styles.chips}>
              {TYPE_ORDER.map((type) => chip(TYPE_NAMES[type], false, () => handleStartTest(type), `start-${type}`))}
            </View>
          </View>

          {/* Irrigators */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Irrigators{rows.length > 0 ? ` · ${rows.length}` : ''}
            </Text>
            {!addingIrrigator && (
              <TouchableOpacity onPress={() => setAddingIrrigator(true)} activeOpacity={0.7} testID="add-irrigator" style={styles.linkBtn}>
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={[styles.linkText, { color: colors.primary }]}>Add irrigator</Text>
              </TouchableOpacity>
            )}
          </View>
          {addingIrrigator && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FormField label="Name / ID" required value={newName} onChangeText={setNewName} placeholder="e.g. Pivot 2 North" autoFocus />
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>Type</Text>
                <View style={styles.chips}>
                  {TYPE_ORDER.map((type) => chip(TYPE_NAMES[type], newType === type, () => setNewType(type)))}
                </View>
              </View>
              <FormField label="Test every (months)" keyboardType="numeric" value={newInterval} onChangeText={setNewInterval} />
              <View style={styles.formActions}>
                <AppButton label="Cancel" variant="outline" onPress={() => setAddingIrrigator(false)} style={{ flex: 1 }} />
                <AppButton label="Add" onPress={() => void handleAddIrrigator()} disabled={!newName.trim()} style={{ flex: 1 }} testID="add-irrigator-submit" />
              </View>
            </View>
          )}
          {rows.length === 0 ? (
            <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
              No irrigators saved for this farm yet. Add one, or start a test and it will be saved automatically.
            </Text>
          ) : (
            <View style={styles.list}>
              {rows.map((row) => (
                <IrrigatorCard
                  key={row.irrigator.id}
                  row={row}
                  showFarmName={false}
                  onTest={handleTestRow}
                  onOpenReport={(reportId) => router.push(`/report/${reportId}`)}
                />
              ))}
            </View>
          )}

          {/* Recent tests */}
          {recentReports.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Recent tests</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0 }]}>
                {recentReports.map(({ report, results }, i) => (
                  <TouchableOpacity
                    key={report.id}
                    onPress={() => router.push(`/report/${report.id}`)}
                    activeOpacity={0.7}
                    style={[styles.reportRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                  >
                    <Feather name="file-text" size={16} color={colors.primary} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.reportName, { color: colors.foreground }]} numberOfLines={1}>
                        {report.operationData?.irrigatorName || TYPE_NAMES[report.irrigatorType ?? ''] || 'Test'}
                      </Text>
                      <Text style={[styles.reportMeta, { color: colors.mutedForeground }]}>
                        {formatDate(report.testDate || report.savedAt.slice(0, 10))}
                        {report.operationData?.assessorName ? ` · ${report.operationData.assessorName}` : ''}
                      </Text>
                    </View>
                    {results && <StatusBadge status={results.duStatus} label={`DU ${Math.round(results.du * 100)}%`} />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} testID="delete-farm" style={styles.deleteLink}>
            <Text style={[styles.deleteText, { color: colors.mutedForeground }]}>Remove this farm</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: -0.3 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 14 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  missingTitle: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  missingText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
  cardHint: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  farmHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  farmName: { fontSize: 24, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  detailText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  notes: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: -0.3 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  linkText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  list: { gap: 10 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  reportName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reportMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  deleteLink: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  deleteText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
