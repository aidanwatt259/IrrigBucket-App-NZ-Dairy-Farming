import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import {
  ApiError,
  getMyFarms,
  saveFarm,
  saveIrrigator,
} from '@workspace/api-client-react';
import type { FarmRecord, IrrigatorRecord } from '@workspace/api-client-react';
import { FarmDirectory } from '@workspace/sync';
import type {
  FarmDirectorySnapshot,
  FarmDirectoryTransport,
  FarmIdRemap,
  RemoteFarm,
  RemoteIrrigator,
} from '@workspace/sync';

import { fenced } from './transport';

/**
 * Mobile reports are not split by account (the device keeps them across
 * sign-ins), so farms live in one device-wide scope the same way.
 */
export const DEVICE_SCOPE = 'device';

const STORAGE_PREFIX = 'irrigbucket_farm_directory:';

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
  pushFarm(farm) {
    return fenced(async () => {
      const { farm: saved } = await saveFarm({
        id: farm.id,
        clientUpdatedAt: farm.clientUpdatedAt,
        name: farm.name,
        region: farm.region,
        contactName: farm.contactName,
        contactEmail: farm.contactEmail,
        contactPhone: farm.contactPhone,
        notes: farm.notes,
        deletedAt: farm.deletedAt,
      });
      return toRemoteFarm(saved);
    });
  },
  pushIrrigator(irrigator) {
    return fenced(async () => {
      const { irrigator: saved } = await saveIrrigator({
        id: irrigator.id,
        farmId: irrigator.farmId,
        clientUpdatedAt: irrigator.clientUpdatedAt,
        name: irrigator.name,
        type: irrigator.type,
        details: irrigator.details,
        testIntervalMonths: irrigator.testIntervalMonths,
        deletedAt: irrigator.deletedAt,
      });
      return toRemoteIrrigator(saved);
    });
  },
  pull() {
    return fenced(async () => {
      const envelope = await getMyFarms();
      return {
        farms: envelope.farms.map(toRemoteFarm),
        irrigators: envelope.irrigators.map(toRemoteIrrigator),
      };
    });
  },
};

let remapHandler: ((remap: FarmIdRemap) => Promise<void>) | null = null;

/** Set how reports are re-pointed when farms merge on first sync (see syncEngine). */
export function setFarmRemapHandler(handler: (remap: FarmIdRemap) => Promise<void>): void {
  remapHandler = handler;
}

/** The device's farms and saved irrigators. Opened and synced by `syncEngine`. */
export const farmDirectory = new FarmDirectory({
  store: {
    async load(scope) {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + scope);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as FarmDirectorySnapshot;
      } catch {
        return null;
      }
    },
    async save(scope, snapshot) {
      await AsyncStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(snapshot));
    },
  },
  transport,
  genId: () => Crypto.randomUUID(),
  isPermanentError: (err) => err instanceof ApiError && [400, 403, 404].includes(err.status),
  onRemap: (remap) => remapHandler?.(remap),
});

/** Subscribe a component to the farm directory snapshot. */
export function useFarmDirectory(): FarmDirectorySnapshot {
  return useSyncExternalStore(
    (listener) => farmDirectory.subscribe(listener),
    () => farmDirectory.getSnapshot(),
  );
}
