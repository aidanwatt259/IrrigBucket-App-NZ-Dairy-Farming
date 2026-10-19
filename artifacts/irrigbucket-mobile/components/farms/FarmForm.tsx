import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FarmInput, LocalFarm } from '@workspace/sync';

import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';

type Value = {
  name: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

function toInput(value: Value): FarmInput {
  const opt = (s: string) => s.trim() || null;
  return {
    name: value.name.trim(),
    region: opt(value.region),
    contactName: opt(value.contactName),
    contactEmail: opt(value.contactEmail),
    contactPhone: opt(value.contactPhone),
    notes: opt(value.notes),
  };
}

/** Name + region + client contact fields; used for adding and editing farms. */
export function FarmForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  full = true,
}: {
  initial?: LocalFarm | null;
  submitLabel: string;
  onSubmit: (input: FarmInput) => Promise<void> | void;
  onCancel?: () => void;
  /** Show contact and notes fields (off for the quick "add farm" form). */
  full?: boolean;
}) {
  const [value, setValue] = useState<Value>({
    name: initial?.name ?? '',
    region: initial?.region ?? '',
    contactName: initial?.contactName ?? '',
    contactEmail: initial?.contactEmail ?? '',
    contactPhone: initial?.contactPhone ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Value) => (v: string) => setValue((prev) => ({ ...prev, [key]: v }));

  const submit = async () => {
    if (!value.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit(toInput(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <FormField label="Farm name" required value={value.name} onChangeText={set('name')} placeholder="e.g. Riverdale Dairies" autoFocus />
      <FormField label="Region" hint="Optional" value={value.region} onChangeText={set('region')} placeholder="e.g. Mid Canterbury" />
      {full && (
        <>
          <FormField label="Contact name" value={value.contactName} onChangeText={set('contactName')} placeholder="Farm owner or manager" />
          <FormField label="Phone" value={value.contactPhone} onChangeText={set('contactPhone')} keyboardType="phone-pad" />
          <FormField label="Email" value={value.contactEmail} onChangeText={set('contactEmail')} keyboardType="email-address" autoCapitalize="none" />
          <FormField
            label="Notes"
            value={value.notes}
            onChangeText={set('notes')}
            placeholder="Gate codes, water source, anything useful for the next visit"
            multiline
            style={{ height: 90, paddingTop: 12, textAlignVertical: 'top' }}
          />
        </>
      )}
      <View style={styles.actions}>
        {onCancel && <AppButton label="Cancel" variant="outline" onPress={onCancel} disabled={saving} style={{ flex: 1 }} />}
        <AppButton label={submitLabel} onPress={() => void submit()} disabled={!value.name.trim()} loading={saving} style={{ flex: 1 }} testID="farm-form-submit" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
