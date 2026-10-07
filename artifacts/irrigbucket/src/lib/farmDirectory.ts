import { useSyncExternalStore } from 'react';
import {
  ApiError,
  getMyFarms,
  saveFarm,
  saveIrrigator,
  type FarmRecord,
  type IrrigatorRecord,
} from '@workspace/api-client-react';
import {
  FarmDirectory,
  type FarmDirectorySnapshot,
  type FarmIdRemap,
  type FarmDirectoryTransport,
  type RemoteFarm,
  type RemoteIrrigator,
} from '@workspace/sync';
import { db } from './syncDb';

function toRemoteFarm(r: FarmRecord): RemoteFarm {
  return {
    id: r.id,
    name: r.name,
    region: r.region ?? null,
    contactName: r.contactName ?? null,
    contactEmail: r.contactEmail ?? null,
    contactPhone: r.contactPhone ?? null,
    notes: r.notes ?? null,
    role: r.role,
    clientUpdatedAt: r.clientUpdatedAt,
    deletedAt: r.deletedAt ?? null,
  };
}

function toRemoteIrrigator(r: IrrigatorRecord): RemoteIrrigator {
  return {
    id: r.id,
    farmId: r.farmId,
    name: r.name,
    type: r.type,
    details: r.details,
    testIntervalMonths: r.testIntervalMonths,
    clientUpdatedAt: r.clientUpdatedAt,
    deletedAt: r.deletedAt ?? null,
  };
}

const transport: FarmDirectoryTransport = {
  async pushFarm(farm) {
    const { farm: saved } = await saveFarm(
      {
        id: farm.id,
        clientUpdatedAt: farm.clientUpdatedAt,
        name: farm.name,
        region: farm.region,
        contactName: farm.contactName,
        contactEmail: farm.contactEmail,
        contactPhone: farm.contactPhone,
        notes: farm.notes,
        deletedAt: farm.deletedAt,
      },
      { credentials: 'include' },
    );
    return toRemoteFarm(saved);
  },
  async pushIrrigator(irrigator) {
    const { irrigator: saved } = await saveIrrigator(
      {
        id: irrigator.id,
        farmId: irrigator.farmId,
        clientUpdatedAt: irrigator.clientUpdatedAt,
        name: irrigator.name,
        type: irrigator.type,
        details: irrigator.details,
        testIntervalMonths: irrigator.testIntervalMonths,
        deletedAt: irrigator.deletedAt,
      },
      { credentials: 'include' },
    );
    return toRemoteIrrigator(saved);
  },
  async pull() {
    const envelope = await getMyFarms({ credentials: 'include' });
    return {
      farms: envelope.farms.map(toRemoteFarm),
      irrigators: envelope.irrigators.map(toRemoteIrrigator),
    };
  },
};

let remapHandler: ((remap: FarmIdRemap) => Promise<void>) | null = null;

/** Set how reports are re-pointed when farms merge on first sync (see syncEngine). */
export function setFarmRemapHandler(handler: (remap: FarmIdRemap) => Promise<void>): void {
  remapHandler = handler;
}

/**
 * The web app's farms and saved irrigators, stored per account in IndexedDB.
 * Opened for the signed-in account (or the guest) by `initSyncEngine`.
 */
export const farmDirectory = new FarmDirectory({
  onRemap: (remap) => remapHandler?.(remap),
  store: {
    async load(scope) {
      return (await db.farm_directory.get(scope))?.snapshot ?? null;
    },
    async save(scope, snapshot) {
      await db.farm_directory.put({ scope, snapshot });
    },
  },
  transport,
  genId: () => crypto.randomUUID(),
  isPermanentError: (err) =>
    err instanceof ApiError && [400, 403, 404].includes(err.status),
});

/** Subscribe a component to the farm directory snapshot. */
export function useFarmDirectory(): FarmDirectorySnapshot {
  return useSyncExternalStore(
    (listener) => farmDirectory.subscribe(listener),
    () => farmDirectory.getSnapshot(),
  );
}
