import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as apiErrors from "../../api-client-react/src/custom-fetch.ts";
import { SyncEngine } from "../src/engine.ts";
import { FakeTransport, InMemoryStorageAdapter } from "../src/testHelpers.ts";
import type { SyncEngineOptions, SyncStatus, Transport } from "../src/types.ts";

// Execute the complete production wiring module in a fresh realm per test.
// Default mode isolates wiring with a stub engine. Integration mode keeps the
// real engine and replaces only native storage/connectivity and the server.
export async function clientHarness(
  platform: "web" | "mobile",
  options: { integration?: boolean } = {},
) {
  assert.ok(!options.integration || platform === "mobile", "Integration mode supports mobile only");
  let now = 0;
  let sequence = 0;
  let calls = 0;
  let drains = 0;
  let result: () => Promise<void> = async () => {};
  let writeResult: () => Promise<void> = async () => {};
  let onStatus: (status: SyncStatus) => void = () => {};
  let transport: Transport;
  let realEngine: SyncEngine | undefined;
  const storage = new InMemoryStorageAdapter();
  const server = new FakeTransport();
  const timers: { at: number; run: () => void }[] = [];
  const events = new Map<string, () => void>();
  let netListener: (state: { isConnected: boolean }) => void = () => {};
  const navigator = { onLine: true };
  const engine = {
    reconcilePull: () => { calls++; return result(); },
    drain: async () => { drains++; },
    setOnline: () => {},
  };
  const imports: Record<string, Record<string, unknown>> = {
    "@workspace/sync": { SyncEngine: class {
      constructor(engineOptions: SyncEngineOptions) {
        onStatus = engineOptions.onStatus ?? (() => {});
        transport = engineOptions.transport;
        if (options.integration) {
          realEngine = new class extends SyncEngine {
            override async drain() {
              drains++;
              await super.drain();
            }
          }({
            ...engineOptions,
            now: () => now,
            rand: () => 0,
            genId: () => `enqueue-${++sequence}`,
          });
          return realEngine;
        }
        return engine;
      }
    } },
    "@workspace/api-client-react": apiErrors,
    "./syncDb": {
      db: {
        reports: { toArray: async () => [] },
        report_owners: { toArray: async () => [] },
        sync_queue: { toArray: async () => [] },
      },
      savedReportToSyncReport: () => {},
    },
    "./account": {
      GUEST_ACCOUNT: "guest",
      getCurrentAccount: async () => "test-account",
      resolveAccount: async () => ({ current: "test-account", previous: "test-account" }),
      clearAccountSessionState: () => {},
      setAccountSetup: () => {},
    },
    "./farmDirectory": {
      DEVICE_SCOPE: "device",
      setFarmRemapHandler: () => {},
      farmDirectory: {
        open: async () => {},
        sync: async () => {},
        clear: async () => {},
        adoptScope: async () => ({ farms: new Map(), irrigators: new Map() }),
        getSnapshot: () => ({ backfilled: true, pulledAt: null }),
      },
    },
    "./dexieAdapter": { dexieAdapter: {} },
    "./transport": {
      transport: {},
      createTransport: () => ({
        pushReport: async (report: Parameters<Transport["pushReport"]>[0]) => {
          await writeResult();
          return options.integration ? server.pushReport(report) : null;
        },
        deleteReport: async (report: Parameters<Transport["deleteReport"]>[0]) => {
          await writeResult();
          return options.integration ? server.deleteReport(report) : null;
        },
        pullReports: async () => { calls++; await result(); return server.pullReports(); },
      }),
    },
    "./sqliteAdapter": {
      createSqliteAdapter: async () => Object.assign(storage, {
        rekeyAnonymousIds: async () => {},
      }),
    },
    "@react-native-async-storage/async-storage": {
      default: { getItem: async () => "1" },
    },
    "@react-native-community/netinfo": {
      default: {
        addEventListener: (listener: typeof netListener) => { netListener = listener; },
        fetch: async () => ({ isConnected: true }),
      },
    },
    "expo-crypto": { randomUUID: () => "unused" },
    "@/lib/calculations": { calculateTestResults: () => null },
  };
  const context = createContext({
    navigator,
    localStorage: { getItem: () => "1" },
    window: { addEventListener: (name: string, fn: () => void) => events.set(name, fn) },
    setTimeout: (run: () => void, delay: number) => {
      timers.push({ at: now + delay, run });
    },
  });
  const path = platform === "web"
    ? "../../../artifacts/irrigbucket/src/lib/syncEngine.ts"
    : "../../../artifacts/irrigbucket-mobile/lib/sync/syncEngine.ts";
  const url = new URL(path, import.meta.url);
  const module = new SourceTextModule(
    stripTypeScriptTypes(await readFile(url, "utf8")), { context, identifier: url.href },
  );
  await module.link((specifier) => {
    const values = imports[specifier];
    assert.ok(values, `Unmocked dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const api = module.namespace as unknown as {
    initSyncEngine(): void;
    initSync(): Promise<void>;
    enableSync(): Promise<void>;
    disableSync(): Promise<void>;
    getStatus(): SyncStatus;
    subscribeStatus(listener: (status: SyncStatus) => void): () => void;
    saveReport(saved: Record<string, unknown>): Promise<void>;
    deleteReport(id: string): Promise<void>;
  };
  // A host event-loop turn drains all guest async continuations without sleeps.
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  return {
    get calls() { return calls; },
    get drains() { return drains; },
    get pendingTimers() { return timers.length; },
    storage,
    server,
    async drain() {
      assert.ok(realEngine, "Requires integration mode");
      await realEngine.drain();
    },
    async saveReport(id: string) {
      assert.ok(realEngine, "Requires integration mode");
      await api.saveReport({
        id, savedAt: new Date(now).toISOString(), volumes: [],
        systemParams: {}, sections: [],
      });
      await settle();
    },
    async deleteReport(id: string) {
      assert.ok(realEngine, "Requires integration mode");
      await api.deleteReport(id);
      await settle();
    },
    respond(fn: typeof result) { result = fn; },
    respondToWrite(fn: typeof writeResult) { writeResult = fn; },
    get status() { return api.getStatus(); },
    subscribeStatus(listener: (status: SyncStatus) => void) {
      return api.subscribeStatus(listener);
    },
    emitStatus(status: SyncStatus) {
      assert.ok(!options.integration, "Integration statuses must come from the real engine");
      onStatus(status);
    },
    async write(op: "pushReport" | "deleteReport") {
      // The transport stub ignores the record; exercise the production wrapper.
      await transport[op]({} as Parameters<Transport["pushReport"]>[0]);
      await settle();
    },
    async start() {
      if (platform === "web") api.initSyncEngine();
      else { await api.initSync(); await api.enableSync(); }
      await settle();
    },
    async connect(connected: boolean) {
      navigator.onLine = connected;
      if (platform === "web") events.get(connected ? "online" : "offline")!();
      else netListener({ isConnected: connected });
      await settle();
    },
    async signOut() { await api.disableSync(); await settle(); },
    async advance(ms: number) {
      const target = now + ms;
      while (true) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > target) break;
        const timer = timers.shift()!;
        now = timer.at;
        timer.run();
        await settle();
      }
      now = target;
      await settle();
    },
    settle,
  };
}
