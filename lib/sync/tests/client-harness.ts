import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as apiErrors from "../../api-client-react/src/custom-fetch.ts";

// Execute the complete production wiring module in a fresh realm per test.
// Only platform/storage dependencies and the underlying engine are replaced;
// retry loops, guards, entry points, and error classifiers remain production code.
export async function clientHarness(platform: "web" | "mobile") {
  let now = 0;
  let calls = 0;
  let drains = 0;
  let result: () => Promise<void> = async () => {};
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
    "@workspace/sync": { SyncEngine: class { constructor() { return engine; } } },
    "@workspace/api-client-react": apiErrors,
    "./syncDb": { db: {}, savedReportToSyncReport: () => {} },
    "./dexieAdapter": { dexieAdapter: {} },
    "./transport": { transport: {}, createTransport: () => ({}) },
    "./sqliteAdapter": {
      createSqliteAdapter: async () => ({ rekeyAnonymousIds: async () => {} }),
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
  };
  // A host event-loop turn drains all guest async continuations without sleeps.
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  return {
    get calls() { return calls; },
    get drains() { return drains; },
    get pendingTimers() { return timers.length; },
    respond(fn: typeof result) { result = fn; },
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
