import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppKeyboardToolbar } from '@/components/ui/AppKeyboardToolbar';

import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';

const TYPE_LABELS: Record<string, string> = {
  pivot: 'Centre Pivot', lateral: 'Lateral Move', kline: 'K-Line / Pods',
  gun: 'Travelling Gun', solid: 'Solid Set / Fixed', boom: 'Roto Rainer',
};

const irrigatorNameLabel: Record<string, string> = {
  pivot: 'Pivot Name / ID',
  lateral: 'Machine Name / ID',
  kline: 'K-Line Name / ID',
  gun: 'Gun Name / ID',
  solid: 'System Name / ID',
  boom: 'Machine Name / ID',
};

// Parse an optional numeric field: blank or non-finite input becomes undefined
// rather than persisting NaN.
const optNum = (s: string): number | undefined => {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

export default function SetupScreen() {
  const colors = useColors();
  const {
    irrigatorType, systemParams, setSystemParams, generatePlan,
    operationData, setOperationData, testDate, windSpeed, setTestConditions,
  } = useWizard();

  const [values, setValues] = useState({
    farmName: operationData.farmName ?? '',
    irrigatorName: operationData.irrigatorName ?? '',
    assessorName: operationData.assessorName ?? '',
    testDate: testDate || new Date().toISOString().split('T')[0],
    diameter: String(systemParams.diameter || 250),
    targetDepth: String(systemParams.targetDepth || 15),
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
    operatingPressure: systemParams.operatingPressure != null ? String(systemParams.operatingPressure) : '',
    pressureUnit: (systemParams.pressureUnit === 'psi' ? 'psi' : 'kPa') as 'kPa' | 'psi',
    testRunMinutes: systemParams.testRunMinutes ? String(systemParams.testRunMinutes) : '',
    revolutionTime: systemParams.revolutionTime != null ? String(systemParams.revolutionTime) : '',
    numSprinklers: systemParams.numSprinklers != null ? String(systemParams.numSprinklers) : '',
    flowRate: systemParams.flowRate != null ? String(systemParams.flowRate) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Ordered list of the editable numeric fields for the current irrigator type,
  // used to wire "press enter → jump to next box" (and the keyboard toolbar's
  // prev/next arrows follow the same on-screen order automatically).
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const orderedFields = useMemo<string[]>(() => {
    const info = ['farmName', 'irrigatorName', 'assessorName', 'testDate'];
    const bucket = ['diameter', 'targetDepth'];
    let typeFields: string[] = [];
    switch (irrigatorType) {
      case 'pivot': typeFields = ['armLength', 'spans', 'revolutionTime', 'numSprinklers', 'flowRate']; break;
      case 'lateral': typeFields = ['machineWidth']; break;
      case 'kline': typeFields = ['podSpacing', 'podsPerLateral', 'klineTestMinutes', 'klineSetHours']; break;
      case 'gun': typeFields = ['gunRadius', 'laneSpacing', 'gunNumBuckets']; break;
      case 'solid': typeFields = ['sprinklerSpacing']; break;
      case 'boom': typeFields = ['boomWidth', 'nozzleSpacing']; break;
    }
    const conditions = irrigatorType === 'kline'
      ? ['operatingPressure']
      : ['operatingPressure', 'testRunMinutes'];
    return [...info, ...bucket, ...typeFields, ...conditions];
  }, [irrigatorType]);

  useEffect(() => {
    if (!irrigatorType) router.replace('/');
  }, [irrigatorType]);

  if (!irrigatorType) return <View style={[styles.root, { backgroundColor: colors.background }]} />;

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
    if (values.operatingPressure.trim() !== '') num('operatingPressure', 0, 10000, 'Pressure');
    if (irrigatorType !== 'kline' && values.testRunMinutes.trim() !== '') num('testRunMinutes', 1, 1440, 'Test run time');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    const klineMins = values.klineTestMinutes.trim() ? Number(values.klineTestMinutes) : undefined;
    setSystemParams({
      diameter: Number(values.diameter),
      targetDepth: Number(values.targetDepth),
      armLength: Number(values.armLength),
      spans: Number(values.spans) || undefined,
      hasEndGun: values.hasEndGun,
      machineWidth: Number(values.machineWidth),
      podSpacing: Number(values.podSpacing),
      podsPerLateral: Number(values.podsPerLateral),
      klineTestMinutes: klineMins,
      klineSetHours: values.klineSetHours.trim() ? Number(values.klineSetHours) : undefined,
      gunRadius: Number(values.gunRadius),
      laneSpacing: Number(values.laneSpacing),
      gunNumBuckets: values.gunNumBuckets ? Number(values.gunNumBuckets) : undefined,
      sprinklerSpacing: Number(values.sprinklerSpacing),
      boomWidth: Number(values.boomWidth),
      nozzleSpacing: Number(values.nozzleSpacing),
      operatingPressure: optNum(values.operatingPressure),
      pressureUnit: values.pressureUnit === 'psi' ? 'psi' : 'kPa',
      testRunMinutes: irrigatorType === 'kline' ? klineMins : optNum(values.testRunMinutes),
      revolutionTime: optNum(values.revolutionTime),
      numSprinklers: optNum(values.numSprinklers),
      flowRate: optNum(values.flowRate),
    });
    setOperationData({
      farmName: values.farmName.trim(),
      irrigatorName: values.irrigatorName.trim(),
      assessorName: values.assessorName.trim(),
    });
    if (values.testDate) setTestConditions(values.testDate, windSpeed);
    generatePlan();
    router.push('/plan');
  };

  // Enter on a field jumps focus to the next field; Enter on the last field
  // submits. Props are spread onto each FormField in `orderedFields`.
  const focusNext = (name: string) => {
    const i = orderedFields.indexOf(name);
    if (i >= 0 && i < orderedFields.length - 1) {
      inputRefs.current[orderedFields[i + 1]]?.focus();
    } else {
      handleNext();
    }
  };
  const reg = (name: string) => ({
    ref: (r: TextInput | null) => { inputRefs.current[name] = r; },
    returnKeyType: (orderedFields[orderedFields.length - 1] === name ? 'done' : 'next') as 'done' | 'next',
    onSubmitEditing: () => focusNext(name),
    blurOnSubmit: false,
  });

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
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>
              Test Information
            </Text>
            <View style={styles.fieldGroup}>
              <FormField
                label="Farm Name"
                hint="Optional"
                value={values.farmName}
                onChangeText={v => set('farmName', v)}
                placeholder="e.g. Wiper Farm Road"
                {...reg('farmName')}
              />
              <FormField
                label={irrigatorNameLabel[irrigatorType] ?? 'Irrigator Name / ID'}
                hint="Optional"
                value={values.irrigatorName}
                onChangeText={v => set('irrigatorName', v)}
                placeholder="e.g. Pivot 2 North"
                {...reg('irrigatorName')}
              />
              <FormField
                label="Assessor Name"
                hint="Optional"
                value={values.assessorName}
                onChangeText={v => set('assessorName', v)}
                placeholder="e.g. John Smith"
                {...reg('assessorName')}
              />
              <FormField
                label="Test Date"
                hint="Optional — YYYY-MM-DD"
                value={values.testDate}
                onChangeText={v => set('testDate', v)}
                placeholder="YYYY-MM-DD"
                {...reg('testDate')}
              />
            </View>
          </View>

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
                {...reg('diameter')}
              />
              <FormField
                label="Target Application Depth (mm)"
                hint="How much water should be applied per pass"
                keyboardType="numeric"
                value={values.targetDepth}
                onChangeText={v => set('targetDepth', v)}
                error={errors.targetDepth}
                required
                {...reg('targetDepth')}
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
                    {...reg('armLength')}
                  />
                  <FormField
                    label="Number of Spans (optional)"
                    hint="Count of spans from centre to end tower"
                    keyboardType="numeric"
                    value={values.spans}
                    onChangeText={v => set('spans', v)}
                    {...reg('spans')}
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
                  <FormField label="Full Revolution Time (hours)" keyboardType="decimal-pad" value={values.revolutionTime} onChangeText={v => set('revolutionTime', v)} placeholder="e.g. 48" {...reg('revolutionTime')} />
                  <FormField label="Total Number of Sprinklers" keyboardType="numeric" value={values.numSprinklers} onChangeText={v => set('numSprinklers', v)} placeholder="e.g. 120" {...reg('numSprinklers')} />
                  <FormField label="System Flow Rate (L/s)" keyboardType="decimal-pad" value={values.flowRate} onChangeText={v => set('flowRate', v)} placeholder="e.g. 42" {...reg('flowRate')} />
                </>
              )}
              {irrigatorType === 'lateral' && (
                <FormField label="Machine Width (m)" keyboardType="numeric" value={values.machineWidth} onChangeText={v => set('machineWidth', v)} error={errors.machineWidth} required {...reg('machineWidth')} />
              )}
              {irrigatorType === 'kline' && (
                <>
                  <FormField label="Pod Spacing (m)" keyboardType="numeric" value={values.podSpacing} onChangeText={v => set('podSpacing', v)} error={errors.podSpacing} required {...reg('podSpacing')} />
                  <FormField label="Pods Per Lateral" keyboardType="numeric" value={values.podsPerLateral} onChangeText={v => set('podsPerLateral', v)} error={errors.podsPerLateral} required {...reg('podsPerLateral')} />
                  <FormField label="Test Run Time (minutes)" hint="How long the pods ran while water collected in the buckets. Needed to calculate application depth; leave blank if you only need DU." keyboardType="numeric" value={values.klineTestMinutes} onChangeText={v => set('klineTestMinutes', v)} error={errors.klineTestMinutes} placeholder="e.g. 60" {...reg('klineTestMinutes')} />
                  <FormField label="Set Run Time (hours)" hint="How long the K-Line runs per position (commonly 12–24 hrs)" keyboardType="numeric" value={values.klineSetHours} onChangeText={v => set('klineSetHours', v)} error={errors.klineSetHours} placeholder="e.g. 24" {...reg('klineSetHours')} />
                </>
              )}
              {irrigatorType === 'gun' && (
                <>
                  <FormField label="Gun Wetted Radius (m)" keyboardType="numeric" value={values.gunRadius} onChangeText={v => set('gunRadius', v)} error={errors.gunRadius} required {...reg('gunRadius')} />
                  <FormField label="Lane Spacing (m)" keyboardType="numeric" value={values.laneSpacing} onChangeText={v => set('laneSpacing', v)} error={errors.laneSpacing} required {...reg('laneSpacing')} />
                  <FormField label="Number of Buckets (optional)" hint="Leave blank to auto-calculate" keyboardType="numeric" value={values.gunNumBuckets} onChangeText={v => set('gunNumBuckets', v)} {...reg('gunNumBuckets')} />
                </>
              )}
              {irrigatorType === 'solid' && (
                <FormField label="Sprinkler Spacing (m)" keyboardType="numeric" value={values.sprinklerSpacing} onChangeText={v => set('sprinklerSpacing', v)} error={errors.sprinklerSpacing} required {...reg('sprinklerSpacing')} />
              )}
              {irrigatorType === 'boom' && (
                <>
                  <FormField label="Boom Width (m)" keyboardType="numeric" value={values.boomWidth} onChangeText={v => set('boomWidth', v)} error={errors.boomWidth} required {...reg('boomWidth')} />
                  <FormField label="Nozzle Spacing (m)" keyboardType="decimal-pad" value={values.nozzleSpacing} onChangeText={v => set('nozzleSpacing', v)} error={errors.nozzleSpacing} required {...reg('nozzleSpacing')} />
                </>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border, marginTop: 24 }]}>
              Test Conditions
            </Text>
            <View style={styles.fieldGroup}>
              <FormField
                label="Water Input Pressure"
                hint="Water pressure measured at the irrigator. Enter in kPa or psi."
                keyboardType="decimal-pad"
                value={values.operatingPressure}
                onChangeText={v => set('operatingPressure', v)}
                error={errors.operatingPressure}
                placeholder="e.g. 400"
                {...reg('operatingPressure')}
              />
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Pressure unit</Text>
                <View style={styles.toggleGroup}>
                  {(['kPa', 'psi'] as const).map(opt => (
                    <View
                      key={opt}
                      style={[
                        styles.toggleOption,
                        {
                          backgroundColor: values.pressureUnit === opt ? colors.primary : colors.muted,
                          borderColor: values.pressureUnit === opt ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        onPress={() => set('pressureUnit', opt)}
                        style={[
                          styles.toggleText,
                          { color: values.pressureUnit === opt ? colors.primaryForeground : colors.foreground },
                        ]}
                      >
                        {opt}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              {irrigatorType !== 'kline' && (
                <FormField
                  label="Test Run Time (minutes)"
                  hint={['pivot', 'lateral', 'gun', 'boom'].includes(irrigatorType)
                    ? 'How long one full pass over the bucket line took. Used to calculate application intensity (mm/hr).'
                    : 'How long the system ran while water collected in the buckets (min ~60 min). Used to calculate application intensity (mm/hr).'}
                  keyboardType="numeric"
                  value={values.testRunMinutes}
                  onChangeText={v => set('testRunMinutes', v)}
                  error={errors.testRunMinutes}
                  placeholder="e.g. 60"
                  {...reg('testRunMinutes')}
                />
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
      <AppKeyboardToolbar />
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
