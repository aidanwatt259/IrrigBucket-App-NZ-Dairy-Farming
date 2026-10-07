import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalIrrigator } from '@workspace/sync';

import { FormField } from '@/components/ui/FormField';
import { useColors } from '@/hooks/useColors';
import type { OperationData } from '@/lib/calculations';
import { farmDirectory, useFarmDirectory } from '@/lib/sync/farmDirectory';

export const NEW = '__new__';
export const NONE = '';

/**
 * The farm/irrigator part of the setup screen. Each choice is a saved record
 * id, {@link NEW} (type a new name) or {@link NONE} (not specified).
 */
export interface FarmIrrigatorValue {
  farmChoice: string;
  newFarmName: string;
  irrigatorChoice: string;
  newIrrigatorName: string;
}

/** Initial picker state for a test's operation data and irrigator type. */
export function initialFarmIrrigatorValue(
  operationData: OperationData,
  irrigatorType: string,
): FarmIrrigatorValue {
  const farm =
    (operationData.farmId && farmDirectory.getFarm(operationData.farmId)) ||
    (operationData.farmName ? farmDirectory.findFarmByName(operationData.farmName) : null);
  const irrigator =
    farm &&
    ((operationData.irrigatorId && farmDirectory.getIrrigator(operationData.irrigatorId)) ||
      (operationData.irrigatorName
        ? farmDirectory.findIrrigator(farm.id, operationData.irrigatorName, irrigatorType)
        : null));
  const matchingIrrigator =
    irrigator && irrigator.farmId === farm?.id && irrigator.type === irrigatorType ? irrigator : null;
  const hasFarms = farmDirectory.listFarms().length > 0;

  return {
    farmChoice: farm ? farm.id : operationData.farmName || !hasFarms ? NEW : NONE,
    newFarmName: farm ? '' : operationData.farmName ?? '',
    irrigatorChoice: matchingIrrigator ? matchingIrrigator.id : NEW,
    newIrrigatorName: matchingIrrigator ? '' : operationData.irrigatorName ?? '',
  };
}

/**
 * Resolve the picker into operation data, creating the farm/irrigator records
 * when new names were typed. An irrigator is only saved as a record when it
 * belongs to a farm; otherwise its name is kept as plain text on the test.
 */
export async function resolveFarmIrrigator(
  value: FarmIrrigatorValue,
  irrigatorType: string,
  details: Record<string, unknown>,
): Promise<Pick<OperationData, 'farmId' | 'farmName' | 'irrigatorId' | 'irrigatorName'>> {
  let farm =
    value.farmChoice && value.farmChoice !== NEW ? farmDirectory.getFarm(value.farmChoice) : null;
  if (!farm && value.farmChoice === NEW && value.newFarmName.trim()) {
    farm = await farmDirectory.ensureFarm(value.newFarmName);
  }

  let irrigator: LocalIrrigator | null = null;
  const typedName = value.newIrrigatorName.trim();
  if (farm) {
    irrigator =
      value.irrigatorChoice && value.irrigatorChoice !== NEW
        ? farmDirectory.getIrrigator(value.irrigatorChoice)
        : null;
    if (!irrigator && value.irrigatorChoice === NEW && typedName) {
      irrigator = await farmDirectory.ensureIrrigator({
        farmId: farm.id,
        name: typedName,
        type: irrigatorType,
        details,
      });
    }
  }

  return {
    farmId: farm?.id,
    farmName: farm?.name ?? '',
    irrigatorId: irrigator?.id,
    irrigatorName: irrigator?.name ?? (value.irrigatorChoice === NEW ? typedName : ''),
  };
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FarmIrrigatorPicker({
  value,
  onChange,
  irrigatorType,
  irrigatorLabel,
  onIrrigatorPicked,
}: {
  value: FarmIrrigatorValue;
  onChange: (next: FarmIrrigatorValue) => void;
  irrigatorType: string;
  irrigatorLabel: string;
  onIrrigatorPicked: (irrigator: LocalIrrigator) => void;
}) {
  const colors = useColors();
  useFarmDirectory();
  const farms = farmDirectory.listFarms();
  const selectedFarm =
    value.farmChoice && value.farmChoice !== NEW ? farmDirectory.getFarm(value.farmChoice) : null;
  const irrigators = selectedFarm
    ? farmDirectory.listIrrigators(selectedFarm.id).filter((i) => i.type === irrigatorType)
    : [];
  const showFarmName = farms.length === 0 || value.farmChoice === NEW;
  const showIrrigatorName = irrigators.length === 0 || value.irrigatorChoice === NEW;

  const pickFarm = (farmChoice: string) => {
    const farm = farmChoice && farmChoice !== NEW ? farmDirectory.getFarm(farmChoice) : null;
    const options = farm
      ? farmDirectory.listIrrigators(farm.id).filter((i) => i.type === irrigatorType)
      : [];
    onChange({ ...value, farmChoice, irrigatorChoice: options.length > 0 ? NONE : NEW });
  };

  const pickIrrigator = (irrigatorChoice: string) => {
    onChange({ ...value, irrigatorChoice });
    const irrigator =
      irrigatorChoice && irrigatorChoice !== NEW ? farmDirectory.getIrrigator(irrigatorChoice) : null;
    if (irrigator) onIrrigatorPicked(irrigator);
  };

  return (
    <>
      <View style={styles.group}>
        {farms.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Farm</Text>
            <View style={styles.chips}>
              {farms.map((f) => (
                <Chip
                  key={f.id}
                  label={f.name}
                  selected={value.farmChoice === f.id}
                  onPress={() => pickFarm(value.farmChoice === f.id ? NONE : f.id)}
                />
              ))}
              <Chip label="+ New farm" selected={value.farmChoice === NEW} onPress={() => pickFarm(NEW)} />
            </View>
          </>
        )}
        {showFarmName && (
          <FormField
            label={farms.length > 0 ? 'New farm name' : 'Farm Name'}
            hint={value.newFarmName.trim() ? 'Saved to your farms for next time.' : 'Optional'}
            value={value.newFarmName}
            onChangeText={(v) => onChange({ ...value, newFarmName: v })}
            placeholder="e.g. Wiper Farm Road"
          />
        )}
      </View>
      <View style={styles.group}>
        {irrigators.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{irrigatorLabel}</Text>
            <View style={styles.chips}>
              {irrigators.map((i) => (
                <Chip
                  key={i.id}
                  label={i.name}
                  selected={value.irrigatorChoice === i.id}
                  onPress={() => pickIrrigator(value.irrigatorChoice === i.id ? NONE : i.id)}
                />
              ))}
              <Chip label="+ New" selected={value.irrigatorChoice === NEW} onPress={() => pickIrrigator(NEW)} />
            </View>
            {value.irrigatorChoice !== NEW && value.irrigatorChoice !== NONE && (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Settings from its last test are filled in below.
              </Text>
            )}
          </>
        )}
        {showIrrigatorName && (
          <FormField
            label={irrigators.length > 0 ? `New ${irrigatorLabel.toLowerCase()}` : irrigatorLabel}
            hint="Optional"
            value={value.newIrrigatorName}
            onChangeText={(v) => onChange({ ...value, newIrrigatorName: v })}
            placeholder="e.g. Pivot 2 North"
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
