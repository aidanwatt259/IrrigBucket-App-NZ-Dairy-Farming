import { randomBytes } from "node:crypto";

/** 144 bits of randomness, URL-safe, 24 characters. */
export function generateShareToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Cheap shape check before hitting the database. */
export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/** The public page a farmer opens for a shared report. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/r/${token}`;
}
