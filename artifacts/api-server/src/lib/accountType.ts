import type { AccountType } from "@workspace/api-zod";

export const DEFAULT_ACCOUNT_TYPE: AccountType = "farmer";

export function parseAccountType(value: unknown): AccountType | null {
  return value === "farmer" || value === "consultant" ? value : null;
}

/**
 * The account type to give a brand-new user: the choice sent with the session
 * exchange (Google sign-up), else the one saved in their Supabase metadata at
 * email sign-up, else farmer.
 */
export function signupAccountType(requested: unknown, metadata: unknown): AccountType {
  return parseAccountType(requested) ?? parseAccountType(metadata) ?? DEFAULT_ACCOUNT_TYPE;
}
