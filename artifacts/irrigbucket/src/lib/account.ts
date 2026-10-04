import { useAppStore } from './store';

/**
 * Local reports live in this browser's IndexedDB, which is shared by everyone
 * who uses the browser profile. Each report is tagged with the account that
 * owns it (or {@link GUEST_ACCOUNT} when created logged out) so the UI only
 * shows — and the sync engine only pushes — the signed-in account's reports.
 */
export const GUEST_ACCOUNT = 'guest';

const ACCOUNT_STORAGE_KEY = 'irrigbucket_account';
const BILLING_CACHE_KEY = 'irrigbucket-billing-status';
const AUTH_TIMEOUT_MS = 8000;

export interface AccountResolution {
  /** The account now using the app. */
  current: string;
  /** The account that last used the app in this browser. */
  previous: string;
}

function readCachedAccount(): string {
  try {
    return localStorage.getItem(ACCOUNT_STORAGE_KEY) || GUEST_ACCOUNT;
  } catch {
    return GUEST_ACCOUNT;
  }
}

function writeCachedAccount(account: string): void {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, account);
  } catch {
    // storage unavailable
  }
}

async function fetchSignedInAccount(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/auth/user', {
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { user: { id?: string } | null };
    return data.user?.id || GUEST_ACCOUNT;
  } finally {
    clearTimeout(timer);
  }
}

let resolution: Promise<AccountResolution> | null = null;

/**
 * Resolve who is using the app, once per page load. Login and logout both do a
 * full page navigation, so a per-load answer stays correct. When the server is
 * unreachable (offline on the farm) the last known account is reused so a
 * signed-in farmer still sees their reports.
 */
export function resolveAccount(): Promise<AccountResolution> {
  resolution ??= (async () => {
    const previous = readCachedAccount();
    let current: string;
    try {
      current = await fetchSignedInAccount();
    } catch {
      current = previous;
    }
    writeCachedAccount(current);
    return { current, previous };
  })();
  return resolution;
}

let accountSetup: Promise<unknown> = Promise.resolve();

/** Hold {@link getCurrentAccount} callers until local data is set up for the account. */
export function setAccountSetup(setup: Promise<unknown>): void {
  accountSetup = setup.catch(() => {});
}

export async function getCurrentAccount(): Promise<string> {
  const { current } = await resolveAccount();
  await accountSetup;
  return current;
}

/**
 * Clear per-session state that must not carry over to the next person using
 * this browser: the in-progress test draft and the cached billing status.
 */
export function clearAccountSessionState(): void {
  useAppStore.getState().reset();
  try {
    sessionStorage.removeItem(BILLING_CACHE_KEY);
  } catch {
    // storage unavailable
  }
}

/** Call right before logging out, while the page is still on this account. */
export function prepareForLogout(): void {
  clearAccountSessionState();
  writeCachedAccount(GUEST_ACCOUNT);
}
