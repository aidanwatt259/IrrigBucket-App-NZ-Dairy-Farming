import { setAccountType, type AccountType } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';

export type { AccountType };

const CACHE_KEY = 'irrigbucket-account-type';

function readCachedAccountType(): AccountType | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw === 'farmer' || raw === 'consultant' ? raw : null;
  } catch {
    return null;
  }
}

export function cacheAccountType(accountType: AccountType | null): void {
  try {
    if (accountType) localStorage.setItem(CACHE_KEY, accountType);
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // storage unavailable
  }
}

/**
 * The signed-in user's account type. While the auth check is still running,
 * the last known type is used so a consultant's Home doesn't flash the farmer
 * view; guests and unknown users are farmers.
 */
export function useAccountType(): AccountType {
  const { user, isLoading } = useAuth();
  if (user) {
    const type = user.accountType ?? 'farmer';
    if (type !== readCachedAccountType()) cacheAccountType(type);
    return type;
  }
  if (isLoading) return readCachedAccountType() ?? 'farmer';
  return 'farmer';
}

const PENDING_KEY = 'irrigbucket-signup-account-type';
const PENDING_TTL_MS = 60 * 60 * 1000;

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; title: string; description: string }[] = [
  { value: 'farmer', title: 'Farmer', description: 'I test the irrigators on my own farm.' },
  { value: 'consultant', title: 'Consultant', description: 'I test irrigators on farms for clients.' },
];

/**
 * Remember the account type picked on the sign-up page so the session exchange
 * can apply it when the account is first created (Google sign-up leaves the
 * page, so it can't be passed directly).
 */
export function rememberSignupAccountType(accountType: AccountType): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ accountType, at: Date.now() }));
  } catch {
    // storage unavailable
  }
}

/** The remembered sign-up choice, if recent. Clears it either way. */
export function takeSignupAccountType(): AccountType | undefined {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    if (!raw) return undefined;
    const { accountType, at } = JSON.parse(raw) as { accountType?: unknown; at?: unknown };
    if (typeof at !== 'number' || Date.now() - at > PENDING_TTL_MS) return undefined;
    return accountType === 'farmer' || accountType === 'consultant' ? accountType : undefined;
  } catch {
    return undefined;
  }
}

export async function saveAccountType(accountType: AccountType): Promise<AccountType> {
  const { user } = await setAccountType({ accountType }, { credentials: 'include' });
  const saved = user?.accountType ?? accountType;
  cacheAccountType(saved);
  return saved;
}
