import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStore';

const SID_KEY = 'irrigbucket_session_token';

/**
 * In-memory mirror of the persisted server session id (sid).
 *
 * The api-client's auth-token getter runs before every request and reads
 * {@link getStoredToken} (memory) rather than touching SecureStore each time.
 * {@link loadStoredToken} hydrates it once at startup.
 */
let inMemoryToken: string | null = null;

/**
 * Monotonic counter bumped whenever the token IDENTITY changes (sign-in or
 * sign-out). The mobile transport captures it before a request and re-checks it
 * afterwards, so an in-flight sync that finishes AFTER a sign-out/sign-in is
 * discarded instead of mutating the outbox under a stale session.
 */
let tokenEpoch = 0;

/** Current token epoch; changes on every {@link persistToken}/{@link clearStoredToken}. */
export function getTokenEpoch(): number {
  return tokenEpoch;
}

/** Hydrate the in-memory token from secure storage (call once at startup). */
export async function loadStoredToken(): Promise<string | null> {
  inMemoryToken = await getSecureItem(SID_KEY);
  return inMemoryToken;
}

/** The current bearer token, or null when signed out. Synchronous. */
export function getStoredToken(): string | null {
  return inMemoryToken;
}

/** Persist a new session id and update the in-memory mirror. */
export async function persistToken(sid: string): Promise<void> {
  inMemoryToken = sid;
  tokenEpoch += 1;
  await setSecureItem(SID_KEY, sid);
}

/** Forget the session id from both memory and secure storage. */
export async function clearStoredToken(): Promise<void> {
  inMemoryToken = null;
  tokenEpoch += 1;
  await deleteSecureItem(SID_KEY);
}
