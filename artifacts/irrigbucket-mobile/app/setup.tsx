import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';

const TYPE_LABELS: Record<string, string> = {
  pivot: 'Centre Pivot', lateral: 'Lateral Move', kline: 'K-Line / Pods',
  gun: 'Travelling Gun', solid: 'Solid Set / Fixed', boom: 'Roto Rainer',
};

export default function SetupScreen() {
  const colors = useColors();
  const { irrigatorType, systemParams, setSystemParams, generatePlan } = useWizard();

  const [values, setValues] = useState({
    diameter: String(systemParams.diameter || 250),
    targetDepth: String(systemParams.targetDepth || 20),
    armLength: String(systemParams.armLength || 400),
    spans: String(systemParams.spans || 8),
    hasEndGun: systemParams.hasEndGun ?? 'No',
    machineWidth: String(systemParams.machineWidth || 100),
    podSpacing: String(systemParams.podSpacing || 15),
    podsPerLateral: String(systemParams.podsPerLateral || 8),
    klineTestMinutes: systemParams.klineTestMinutes ? String(systemParams.klineTestMinutes) : '',
    klineSetHours: String(systemParams.klineSetHours || 24),
    gunRadius: String(systemParams.gunRadius || 40),
    laneSpacing: String(systemParams.laneSpacing || 60),
    gunNumBuckets: String(systemParams.gunNumBuckets || ''),
    sprinklerSpacing: String(systemParams.sprinklerSpacing || 18),
    boomWidth: String(systemParams.boomWidth || 30),
    nozzleSpacing: String(systemParams.nozzleSpacing || 2),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!irrigatorType) router.replace('/');
  }, [irrigatorType]);

  if (!irrigatorType) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;

  const set = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const num = (k: string, min: number, max: number, label: string) => {
      const v = Number(values[k as keyof typeof values]);
      if (isNaN(v) || v < min || v > max) next[k] = `${label} must be ${min}–${max}`;
    };
    num('diameter', 50, 1000, 'Diameter');
    num('targetDepth', 1, 100, 'Target depth');
    if (isPivot) num('armLength', 10, 5000, 'Arm length');
    if (irrigatorType === 'lateral') num('machineWidth', 10, 1000, 'Machine width');
    if (irrigatorType === 'kline') {
      num('podSpacing', 5, 50, 'Pod spacing');
      num('podsPerLateral', 2, 30, 'Pods per lateral');
      if (values.klineTestMinutes.trim() !== '') num('klineTestMinutes', 1, 1440, 'Test run time');
      if (values.klineSetHours.trim() !== '') num('klineSetHours', 0.1, 48, 'Set run time');
    }
    if (irrigatorType === 'gun') { num('gunRadius', 10, 200, 'Gun radius'); num('laneSpacing', 10, 200, 'Lane spacing'); }
    if (irrigatorType === 'solid') num('sprinklerSpacing', 5, 50, 'Sprinkler spacing');
    if (irrigatorType === 'boom') { num('boomWidth', 5, 100, 'Boom width'); num('nozzleSpacing', 0.5, 10, 'Nozzle spacing'); }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    setSystemParams({
      diameter: Number(values.diameter),
      targetDepth: Number(values.targetDepth),
      armLength: Number(values.armLength),
      spans: Number(values.spans) || undefined,
      hasEndGun: values.hasEndGun,
      machineWidth: Number(values.machineWidth),
      podSpacing: Number(values.podSpacing),
      podsPerLateral: Number(values.podsPerLateral),
      klineTestMinutes: values.klineTestMinutes.trim() ? Number(values.klineTestMinutes) : undefined,
      klineSetHours: values.klineSetHours.trim() ? Number(values.klineSetHours) : undefined,
      gunRadius: Number(values.gunRadius),
      laneSpacing: Number(values.laneSpacing),
      gunNumBuckets: values.gunNumBuckets ? Number(values.gunNumBuckets) : undefined,
      sprinklerSpacing: Number(values.sprinklerSpacing),
      boomWidth: Number(values.boomWidth),
      nozzleSpacing: Number(values.nozzleSpacing),
    });
    generatePlan();
    router.push('/plan');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="System Details" step={2} totalSteps={totalSteps} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>
              Bucket Settings
            </Text>
            <View style={styles.fieldGroup}>
              <FormField
                label="Bucket Top Diameter (mm)"
                hint="Standard 9L bucket is ~250mm"
                keyboardType="numeric"
                value={values.diameter}
                onChangeText={v => set('diameter', v)}
                error={errors.diameter}
                required
              />
              <FormField
                label="Target Application Depth (mm)"
                hint="How much water should be applied per pass"
                keyboardType="numeric"
                value={values.targetDepth}
                onChangeText={v => set('targetDepth', v)}
                error={errors.targetDepth}
                required
              />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border, marginTop: 24 }]}>
              {TYPE_LABELS[irrigatorType]} Settings
            </Text>
            <View style={styles.fieldGroup}>
              {isPivot && (
                <>
                  <FormField
                    label="Pivot Length / Radius (m)"
                    hint="Distance from pivot centre to the end tower"
                    keyboardType="numeric"
                    value={values.armLength}
                    onChangeText={v => set('armLength', v)}
                    error={errors.armLength}
                    required
                  />
                  <FormField
                    label="Number of Spans (optional)"
                    hint="Count of spans from centre to end tower"
                    keyboardType="numeric"
                    value={values.spans}
                    onChangeText={v => set('spans', v)}
                  />
                  <View style={styles.toggleRow}>
                    <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Has End Gun?</Text>
                    <View style={styles.toggleGroup}>
                      {['No', 'Yes'].map(opt => (
                        <React.Fragment key={opt}>
                          <View
                            style={[
                              styles.toggleOption,
                              {
                                backgroundColor: values.hasEndGun === opt ? colors.primary : colors.muted,
                                borderColor: values.hasEndGun === opt ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            <Text
                              onPress={() => set('hasEndGun', opt)}
                              style={[
                                styles.toggleText,
                                { color: values.hasEndGun === opt ? colors.primaryForeground : colors.foreground },
                              ]}
                            >
                              {opt}
                            </Text>
                          </View>
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.mutedForeground, borderBottomColor: colors.border, marginTop: 12, fontSize: 13 }]}>
                    Optional — for report detail
                  </Text>
                  <FormField label="Operating Pressure (bar)" keyboardType="numeric" value={values.diameter === '250' ? '' : ''} placeholder="e.g. 4.0" />
                  <FormField label="Full Revolution Time (hours)" keyboardType="numeric" placeholder="e.g. 48" />
                  <FormField label="Total Number of Sprinklers" keyboardType="numeric" placeholder="e.g. 120" />
                  <FormField label="System Flow Rate (L/s)" keyboardType="numeric" placeholder="e.g. 42" />
                </>
              )}
              {irrigatorType === 'lateral' && (
                <FormField label="Machine Width (m)" keyboardType="numeric" value={values.machineWidth} onChangeText={v => set('machineWidth', v)} error={errors.machineWidth} required />
              )}
              {irrigatorType === 'kline' && (
                <>
                  <FormField label="Pod Spacing (m)" keyboardType="numeric" value={values.podSpacing} onChangeText={v => set('podSpacing', v)} error={errors.podSpacing} required />
                  <FormField label="Pods Per Lateral" keyboardType="numeric" value={values.podsPerLateral} onChangeText={v => set('podsPerLateral', v)} error={errors.podsPerLateral} required />
                  <FormField label="Test Run Time (minutes)" hint="How long pods ran while buckets collected — required for application depth" keyboardType="numeric" value={values.klineTestMinutes} onChangeText={v => set('klineTestMinutes', v)} error={errors.klineTestMinutes} placeholder="e.g. 60" />
                  <FormField label="Set Run Time (hours)" hint="How long the K-Line runs per position (commonly 12–24 hrs)" keyboardType="numeric" value={values.klineSetHours} onChangeText={v => set('klineSetHours', v)} error={errors.klineSetHours} placeholder="e.g. 24" />
                </>
              )}
              {irrigatorType === 'gun' && (
                <>
                  <FormField label="Gun Wetted Radius (m)" keyboardType="numeric" value={values.gunRadius} onChangeText={v => set('gunRadius', v)} error={errors.gunRadius} required />
                  <FormField label="Lane Spacing (m)" keyboardType="numeric" value={values.laneSpacing} onChangeText={v => set('laneSpacing', v)} error={errors.laneSpacing} required />
                  <FormField label="Number of Buckets (optional)" hint="Leave blank to auto-calculate" keyboardType="numeric" value={values.gunNumBuckets} onChangeText={v => set('gunNumBuckets', v)} />
                </>
              )}
              {irrigatorType === 'solid' && (
                <FormField label="Sprinkler Spacing (m)" keyboardType="numeric" value={values.sprinklerSpacing} onChangeText={v => set('sprinklerSpacing', v)} error={errors.sprinklerSpacing} required />
              )}
              {irrigatorType === 'boom' && (
                <>
                  <FormField label="Boom Width (m)" keyboardType="numeric" value={values.boomWidth} onChangeText={v => set('boomWidth', v)} error={errors.boomWidth} required />
                  <FormField label="Nozzle Spacing (m)" keyboardType="decimal-pad" value={values.nozzleSpacing} onChangeText={v => set('nozzleSpacing', v)} error={errors.nozzleSpacing} required />
                </>
              )}
            </View>
          </View>

          <AppButton
            label={isPivot ? 'Calculate Bucket Test Setup →' : 'Calculate Test Plan →'}
            size="lg"
            onPress={handleNext}
            testID="next-button"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 20, gap: 0, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', borderBottomWidth: 1, paddingBottom: 10, marginBottom: 16 },
  fieldGroup: { gap: 14 },
  toggleRow: { gap: 8 },
  toggleLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  toggleGroup: { flexDirection: 'row', gap: 8 },
  toggleOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  toggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
