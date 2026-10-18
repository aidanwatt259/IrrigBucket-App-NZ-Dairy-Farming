import { setAccountType, type AccountType } from '@workspace/api-client-react';

export type { AccountType };

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
  return user?.accountType ?? accountType;
}
