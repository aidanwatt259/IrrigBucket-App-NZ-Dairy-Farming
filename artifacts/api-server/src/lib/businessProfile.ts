import type { BusinessProfile } from "@workspace/api-zod";

/** Upper bound on the stored logo data URL (~150 KB of image). */
export const MAX_LOGO_CHARS = 200_000;

const LOGO_PREFIX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const FIELD_LIMITS: Record<Exclude<keyof BusinessProfile, "logo">, number> = {
  businessName: 120,
  contactName: 120,
  phone: 40,
  email: 160,
  website: 200,
};

export const EMPTY_PROFILE: BusinessProfile = {
  businessName: null,
  contactName: null,
  phone: null,
  email: null,
  website: null,
  logo: null,
};

/** The `users` columns a business profile lives in. */
export interface BusinessProfileColumns {
  businessName: string | null;
  businessContactName: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  businessLogo: string | null;
}

export function profileFromColumns(row: Partial<BusinessProfileColumns> | null | undefined): BusinessProfile {
  if (!row) return EMPTY_PROFILE;
  return {
    businessName: row.businessName ?? null,
    contactName: row.businessContactName ?? null,
    phone: row.businessPhone ?? null,
    email: row.businessEmail ?? null,
    website: row.businessWebsite ?? null,
    logo: row.businessLogo ?? null,
  };
}

export function profileToColumns(profile: BusinessProfile): BusinessProfileColumns {
  return {
    businessName: profile.businessName,
    businessContactName: profile.contactName,
    businessPhone: profile.phone,
    businessEmail: profile.email,
    businessWebsite: profile.website,
    businessLogo: profile.logo,
  };
}

export type ProfileValidation =
  | { ok: true; profile: BusinessProfile }
  | { ok: false; error: string };

/**
 * Trim and bound every field of an incoming profile. Blank strings become null
 * so "cleared" and "never set" look the same. The logo must be a small inline
 * PNG/JPEG/WebP so a share page can never be made to load a remote tracker.
 */
export function normalizeProfile(input: unknown): ProfileValidation {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid business profile" };
  }
  const raw = input as Record<string, unknown>;
  const profile: BusinessProfile = { ...EMPTY_PROFILE };

  for (const key of Object.keys(FIELD_LIMITS) as (keyof typeof FIELD_LIMITS)[]) {
    const value = raw[key];
    if (value == null || value === "") continue;
    if (typeof value !== "string") return { ok: false, error: `${key} must be text` };
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (trimmed.length > FIELD_LIMITS[key]) {
      return { ok: false, error: `${key} is too long (max ${FIELD_LIMITS[key]} characters)` };
    }
    profile[key] = trimmed || null;
  }

  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    return { ok: false, error: "email doesn't look like an email address" };
  }

  const logo = raw.logo;
  if (logo != null && logo !== "") {
    if (typeof logo !== "string") return { ok: false, error: "logo must be a data URL" };
    if (logo.length > MAX_LOGO_CHARS) {
      return { ok: false, error: "Logo is too large — please use an image under 150 KB" };
    }
    if (!LOGO_PREFIX.test(logo)) {
      return { ok: false, error: "Logo must be a PNG, JPEG or WebP image" };
    }
    profile.logo = logo;
  }

  return { ok: true, profile };
}
