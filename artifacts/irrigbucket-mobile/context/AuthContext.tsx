import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  getCurrentAuthUser,
  setAccountType as apiSetAccountType,
  type AccountType,
  type AuthUser,
} from '@workspace/api-client-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  exchangeForServerSession,
  serverDeleteAccount,
  serverSignOut,
  supabasePasswordSignIn,
} from '@/lib/auth/authApi';
import {
  clearStoredToken,
  getStoredToken,
  loadStoredToken,
  persistToken,
} from '@/lib/auth/token';
import {
  disableSync,
  enableSync,
  initSync,
  purgeAllLocalData,
} from '@/lib/sync/syncEngine';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type { AccountType };

export interface AuthUserInfo {
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** Last known account type, so the app keeps the right mode when it starts offline. */
const ACCOUNT_TYPE_KEY = 'irrigbucket_account_type';

async function loadCachedAccountType(): Promise<AccountType | null> {
  const raw = await AsyncStorage.getItem(ACCOUNT_TYPE_KEY).catch(() => null);
  return raw === 'farmer' || raw === 'consultant' ? raw : null;
}

function cacheAccountType(accountType: AccountType | null): Promise<void> {
  return (
    accountType
      ? AsyncStorage.setItem(ACCOUNT_TYPE_KEY, accountType)
      : AsyncStorage.removeItem(ACCOUNT_TYPE_KEY)
  ).catch(() => {});
}

function toUserInfo(user: AuthUser, fallbackEmail: string | null = null): AuthUserInfo {
  return {
    email: user.email ?? fallbackEmail,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUserInfo | null;
  /** Farmer or consultant; farmer until the server says otherwise. */
  accountType: AccountType;
  busy: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setAccountType: (accountType: AccountType) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('farmer');

  const applyAccountType = useCallback((next: AccountType | null | undefined) => {
    setAccountTypeState(next ?? 'farmer');
    void cacheAccountType(next ?? null);
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // initSync wires the api-client base URL + bearer-token getter, opens the
      // DB, and runs the migration (still gated offline) before any authed call.
      await initSync();
      const sid = await loadStoredToken();
      if (!sid) {
        setStatus('signedOut');
        return;
      }
      try {
        // An invalid/expired sid resolves to { user: null } (HTTP 200), so the
        // only way this throws is a genuine transport/connectivity failure.
        const me = await getCurrentAuthUser();
        if (me?.user) {
          setUser(toUserInfo(me.user));
          applyAccountType(me.user.accountType);
          setStatus('signedIn');
          await enableSync();
        } else {
          // Server confirmed the stored sid is invalid → sign out locally but
          // KEEP the user's reports on the device.
          await clearStoredToken();
          setUser(null);
          setStatus('signedOut');
        }
      } catch {
        // Couldn't validate. Only trust the stored sid optimistically when we
        // are genuinely offline; enableSync stays gated by connectivity and
        // pulls once the network returns. If we're actually online the failure
        // is transient (e.g. 5xx) and the session is unconfirmed, so we stay
        // signed out WITHOUT clearing the sid (next launch / re-auth retries)
        // and never drain or pull against an unverified session.
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          setStatus('signedOut');
        } else {
          const cached = await loadCachedAccountType();
          if (cached) setAccountTypeState(cached);
          setStatus('signedIn');
          await enableSync();
        }
      }
    })();
  }, [applyAccountType]);

  const signIn = useCallback(async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const { accessToken, refreshToken } = await supabasePasswordSignIn(
        email,
        password,
      );
      const sid = await exchangeForServerSession(accessToken, refreshToken);
      await persistToken(sid);

      const trimmed = email.trim();
      let info: AuthUserInfo = { email: trimmed };
      try {
        const me = await getCurrentAuthUser();
        if (me?.user) {
          info = toUserInfo(me.user, trimmed);
          applyAccountType(me.user.accountType);
        }
      } catch {
        // Display falls back to the entered email if the lookup fails.
      }
      setUser(info);
      setStatus('signedIn');
      await enableSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
      throw e;
    } finally {
      setBusy(false);
    }
  }, [applyAccountType]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      const sid = getStoredToken();
      await disableSync();
      if (sid) await serverSignOut(sid);
    } finally {
      // clearStoredToken bumps the token epoch, fencing any in-flight sync so a
      // late completion can't mutate the outbox after we've gone local-only.
      await clearStoredToken();
      setUser(null);
      applyAccountType(null);
      setStatus('signedOut');
      setBusy(false);
    }
  }, [applyAccountType]);

  const deleteAccount = useCallback(async () => {
    const sid = getStoredToken();
    if (!sid) {
      setError('Please reconnect to the internet to delete your account.');
      throw new Error('No active session to delete.');
    }
    setBusy(true);
    setError(null);
    let serverDeleted = false;
    try {
      // Stop draining before the destructive call so no sync races the wipe.
      await disableSync();
      // Rejects on failure → we only wipe locally once the server confirms the
      // account (and all its data) is gone.
      await serverDeleteAccount(sid);
      serverDeleted = true;
      await purgeAllLocalData();
      await clearStoredToken();
      setUser(null);
      applyAccountType(null);
      setStatus('signedOut');
    } catch (e) {
      if (serverDeleted) {
        // The account is already gone server-side; re-enabling sync would drain
        // the outbox against a now-invalid sid and recreate reports as anonymous
        // rows. Force the local session closed instead (local reports are kept,
        // as on sign-out; a reinstall clears them).
        await clearStoredToken().catch(() => {});
        setUser(null);
        applyAccountType(null);
        setStatus('signedOut');
        setError(
          'Your account was deleted, but clearing local data failed. Reinstall the app to remove any reports left on this device.',
        );
      } else {
        // Deletion never reached the server (e.g. offline). Restore the syncing
        // session so the user keeps working with their data intact.
        await enableSync().catch(() => {});
        setError(e instanceof Error ? e.message : 'Could not delete your account.');
      }
      throw e;
    } finally {
      setBusy(false);
    }
  }, [applyAccountType]);

  const setAccountType = useCallback(async (next: AccountType) => {
    setError(null);
    const { user: updated } = await apiSetAccountType({ accountType: next });
    applyAccountType(updated?.accountType ?? next);
  }, [applyAccountType]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        accountType,
        busy,
        error,
        signIn,
        signOut,
        deleteAccount,
        setAccountType,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
