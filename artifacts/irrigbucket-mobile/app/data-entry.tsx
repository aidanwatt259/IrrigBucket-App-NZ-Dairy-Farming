import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';

export default function DataEntryScreen() {
  const colors = useColors();
  const { plan, irrigatorType, volumes, setVolume, testDate, windSpeed, setTestConditions, sections } = useWizard();
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (!plan) router.replace('/setup');
  }, [plan]);

  const handleFocusNext = useCallback((index: number) => {
    const next = inputRefs.current[index + 1];
    if (next) next.focus();
  }, []);

  if (!plan) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;
  const currentStep = isPivot ? 5 : 4;
  const filledCount = volumes.filter(v => v > 0).length;

  const sectionBoundaries = sections.map(sec => ({ bucketIndex: sec.fromBucket - 1, label: `${sec.name} (buckets ${sec.fromBucket}–${sec.toBucket})` }));

  const handleCalculate = () => {
    const valid = volumes.filter(v => v > 0);
    if (valid.length < 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/results');
  };

  const renderBuckets = () => {
    const els: React.ReactNode[] = [];
    let i = 0;

    while (i < plan.bucketCount) {
      const boundary = sectionBoundaries.find(b => b.bucketIndex === i);
      const nextBoundaryIndex = sectionBoundaries.find(b => b.bucketIndex > i)?.bucketIndex ?? plan.bucketCount;

      if (boundary) {
        const sectionBuckets: React.ReactNode[] = [];
        for (let j = i; j < nextBoundaryIndex; j++) {
          sectionBuckets.push(renderInput(j));
        }
        els.push(
          <View key={`section-${i}`} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>{boundary.label}</Text>
            <View style={styles.bucketGrid}>{sectionBuckets}</View>
          </View>
        );
        i = nextBoundaryIndex;
      } else {
        els.push(renderInput(i));
        i++;
      }
    }
    return els;
  };

  const renderInput = (idx: number) => (
    <View key={idx} style={[styles.bucketItem, { backgroundColor: colors.card, borderColor: volumes[idx] > 0 ? colors.primary + '60' : colors.border }]}>
      <Text style={[styles.bucketNum, { color: colors.mutedForeground }]}>#{idx + 1}</Text>
      <TextInput
        ref={ref => { if (ref) inputRefs.current[idx] = ref; }}
        style={[styles.bucketInput, { color: colors.foreground, borderColor: volumes[idx] > 0 ? colors.primary + '80' : colors.muted }]}
        keyboardType="numeric"
        value={volumes[idx] > 0 ? String(volumes[idx]) : ''}
        onChangeText={v => {
          const n = parseInt(v);
          setVolume(idx, isNaN(n) ? 0 : n);
        }}
        onSubmitEditing={() => handleFocusNext(idx)}
        returnKeyType={idx < plan.bucketCount - 1 ? 'next' : 'done'}
        placeholder="mL"
        placeholderTextColor={colors.mutedForeground}
        selectTextOnFocus
        testID={`bucket-${idx + 1}`}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="Enter Bucket Volumes" step={currentStep} totalSteps={totalSteps} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Conditions row for non-pivot */}
          {!isPivot && (
            <View style={[styles.condCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.condField}>
                <Text style={[styles.condLabel, { color: colors.foreground }]}>Test Date</Text>
                <TextInput
                  style={[styles.condInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                  value={testDate}
                  onChangeText={v => setTestConditions(v, windSpeed)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.condField}>
                <Text style={[styles.condLabel, { color: colors.foreground }]}>Wind Speed (km/h)</Text>
                <TextInput
                  style={[styles.condInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                  keyboardType="numeric"
                  value={windSpeed != null ? String(windSpeed) : ''}
                  onChangeText={v => setTestConditions(testDate, v ? Number(v) : null)}
                  placeholder="e.g. 5"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
          )}

          {/* Pivot info */}
          {isPivot && (
            <View style={[styles.infoBanner, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                Number buckets <Text style={{ fontFamily: 'Inter_600SemiBold' }}>1 through {plan.bucketCount}</Text> in the field, starting from the innermost position and working outward.
              </Text>
            </View>
          )}

          {/* Header + counter */}
          <View style={styles.counterRow}>
            <Text style={[styles.gridTitle, { color: colors.foreground }]}>Bucket Volumes (mL)</Text>
            <View style={[styles.counterBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.counterText, { color: filledCount === plan.bucketCount ? colors.good : colors.mutedForeground }]}>
                {filledCount}/{plan.bucketCount}
              </Text>
            </View>
          </View>

          {/* Bucket grid */}
          <View style={styles.buckets}>
            {renderBuckets()}
          </View>

          <AppButton
            label={`Calculate Results (${filledCount}/${plan.bucketCount} entered)`}
            size="lg"
            onPress={handleCalculate}
            testID="calculate-button"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  condCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, flexDirection: 'row', gap: 12 },
  condField: { flex: 1, gap: 6 },
  condLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  condInput: { height: 40, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  infoBanner: { borderRadius: 12, borderWidth: 1, padding: 14 },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gridTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold' },
  counterBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  counterText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  buckets: { gap: 10 },
  section: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  bucketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bucketItem: { width: '22%', borderRadius: 10, borderWidth: 1.5, padding: 8, alignItems: 'center', gap: 4 },
  bucketNum: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  bucketInput: { width: '100%', height: 40, borderRadius: 8, borderWidth: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
