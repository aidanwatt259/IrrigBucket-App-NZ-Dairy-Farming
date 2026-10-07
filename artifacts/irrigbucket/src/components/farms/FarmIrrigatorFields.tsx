import type { LocalIrrigator } from '@workspace/sync';
import { farmDirectory, useFarmDirectory } from '@/lib/farmDirectory';
import type { OperationData } from '@/lib/calculations';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const NEW = '__new__';
export const NONE = '';

/**
 * The farm/irrigator part of the setup form. Each choice is a saved record id,
 * {@link NEW} (type a new name) or {@link NONE} (not specified).
 */
export interface FarmIrrigatorValue {
  farmChoice: string;
  newFarmName: string;
  irrigatorChoice: string;
  newIrrigatorName: string;
}

const selectClass =
  'w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

export function FarmIrrigatorFields({
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
      <div className="space-y-3">
        <Label htmlFor="farmChoice">
          Farm <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        {farms.length > 0 && (
          <select
            id="farmChoice"
            value={value.farmChoice}
            onChange={(e) => pickFarm(e.target.value)}
            className={selectClass}
          >
            <option value={NONE}>Not specified</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value={NEW}>+ Add a new farm</option>
          </select>
        )}
        {showFarmName && (
          <Input
            id="farmName"
            aria-label="New farm name"
            placeholder="e.g. Wiper Farm Road"
            value={value.newFarmName}
            onChange={(e) => onChange({ ...value, newFarmName: e.target.value })}
          />
        )}
        {showFarmName && value.newFarmName.trim() && (
          <p className="text-sm text-muted-foreground">Saved to your farms for next time.</p>
        )}
      </div>
      <div className="space-y-3">
        <Label htmlFor="irrigatorChoice">
          {irrigatorLabel} <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        {irrigators.length > 0 && (
          <select
            id="irrigatorChoice"
            value={value.irrigatorChoice}
            onChange={(e) => pickIrrigator(e.target.value)}
            className={selectClass}
          >
            <option value={NONE}>Not specified</option>
            {irrigators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            <option value={NEW}>+ Add a new one</option>
          </select>
        )}
        {showIrrigatorName && (
          <Input
            id="irrigatorName"
            aria-label="New irrigator name"
            placeholder="e.g. Pivot 2 North"
            value={value.newIrrigatorName}
            onChange={(e) => onChange({ ...value, newIrrigatorName: e.target.value })}
          />
        )}
        {irrigators.length > 0 && value.irrigatorChoice !== NEW && value.irrigatorChoice !== NONE && (
          <p className="text-sm text-muted-foreground">Settings from its last test are filled in below.</p>
        )}
      </div>
    </>
  );
}
