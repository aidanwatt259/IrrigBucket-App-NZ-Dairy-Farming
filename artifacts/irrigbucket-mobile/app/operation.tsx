import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';
import { StepHeader } from '@/components/ui/StepHeader';
import { useWizard } from '@/context/WizardContext';
import { useColors } from '@/hooks/useColors';

export default function OperationScreen() {
  const colors = useColors();
  const { irrigatorType, operationData, setOperationData } = useWizard();

  useEffect(() => {
    if (!irrigatorType) router.replace('/');
  }, [irrigatorType]);

  if (!irrigatorType) return null;

  const isPivot = irrigatorType === 'pivot';
  const set = (key: string) => (val: string) => setOperationData({ [key]: val });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StepHeader title="Operation Details" step={isPivot ? 4 : 3} totalSteps={isPivot ? 6 : 5} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Farm & Assessor</Text>
            <View style={styles.fields}>
              <FormField label="Farm Name" value={operationData.farmName || ''} onChangeText={set('farmName')} placeholder="e.g. Fernvale Farm" />
              <FormField label="Assessor Name" value={operationData.assessorName || ''} onChangeText={set('assessorName')} placeholder="e.g. John Smith" />
              <FormField label="Irrigator Name / ID" value={operationData.irrigatorName || ''} onChangeText={set('irrigatorName')} placeholder="e.g. Pivot 1" />
            </View>
          </View>

          {isPivot && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Pivot Settings</Text>
              <View style={styles.fields}>
                <FormField label="% Timer Setting" value={operationData.percentTimer || ''} onChangeText={set('percentTimer')} keyboardType="numeric" placeholder="e.g. 75" />
                <FormField label="Inlet Pressure (bar)" value={operationData.inletPressure || ''} onChangeText={set('inletPressure')} keyboardType="decimal-pad" placeholder="e.g. 4.2" />
                <FormField label="Wetted Width (m)" value={operationData.wettedWidth || ''} onChangeText={set('wettedWidth')} keyboardType="numeric" placeholder="e.g. 25" />
                <FormField label="Corner Arm" value={operationData.cornerArm || ''} onChangeText={set('cornerArm')} placeholder="Yes / No" />
              </View>
            </View>
          )}

          {!isPivot && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Machine Settings</Text>
              <View style={styles.fields}>
                <FormField label="Actual Speed (m/h)" value={operationData.actualSpeed || ''} onChangeText={set('actualSpeed')} keyboardType="decimal-pad" placeholder="e.g. 12.5" />
                <FormField label="Inlet Pressure (bar)" value={operationData.inletPressure || ''} onChangeText={set('inletPressure')} keyboardType="decimal-pad" placeholder="e.g. 3.5" />
                <FormField label="Speed Test Time (sec)" value={operationData.speedTestTime || ''} onChangeText={set('speedTestTime')} keyboardType="numeric" />
                <FormField label="Speed Test Distance (m)" value={operationData.speedTestDistance || ''} onChangeText={set('speedTestDistance')} keyboardType="numeric" />
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Test Conditions</Text>
            <View style={styles.fields}>
              <FormField label="Weather Conditions" value={operationData.weatherConditions || ''} onChangeText={set('weatherConditions')} placeholder="e.g. Fine, light breeze" />
              <FormField label="Wind Direction" value={operationData.windDirection || ''} onChangeText={set('windDirection')} placeholder="e.g. NW" />
              <FormField label="Test Start Time" value={operationData.testStartTime || ''} onChangeText={set('testStartTime')} placeholder="e.g. 09:30" />
              <FormField label="Test End Time" value={operationData.testEndTime || ''} onChangeText={set('testEndTime')} placeholder="e.g. 11:45" />
            </View>
          </View>

          <AppButton
            label="Enter Bucket Volumes →"
            size="lg"
            onPress={() => router.push('/data-entry')}
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
  card: { borderRadius: 16, borderWidth: 1.5, padding: 20 },
  sectionTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', borderBottomWidth: 1, paddingBottom: 10, marginBottom: 16 },
  fields: { gap: 14 },
});
