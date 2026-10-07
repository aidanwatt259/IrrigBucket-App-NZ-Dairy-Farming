// Pure access and Last-Write-Wins rules for farm and irrigator upserts, and for
// linking a report to a farm. Kept free of I/O so the rules can be unit-tested.

import type { FarmRole } from "./supabase";

export type FarmWriteDecision =
  | { kind: "insert" }
  | { kind: "forbidden" }
  | { kind: "accept" }
  | { kind: "server_wins" };

/** Roles allowed to create or edit a farm's details and irrigators. */
export function canEditFarm(role: FarmRole | null): boolean {
  return role === "owner" || role === "consultant";
}

/** True when the incoming client timestamp is strictly newer than the stored one. */
export function incomingIsNewer(
  storedClientUpdatedAt: string | null,
  incomingClientUpdatedAt: string,
): boolean {
  const storedMs = storedClientUpdatedAt ? Date.parse(storedClientUpdatedAt) : NaN;
  const incomingMs = Date.parse(incomingClientUpdatedAt);
  if (Number.isNaN(storedMs)) return true;
  if (Number.isNaN(incomingMs)) return false;
  return incomingMs > storedMs;
}

/**
 * Decide how a farm or irrigator write applies. `existing` is null when no row
 * has this id yet. `role` is the caller's role on the (owning) farm.
 */
export function decideFarmWrite(params: {
  existing: { client_updated_at: string | null } | null;
  role: FarmRole | null;
  isAdmin: boolean;
  incomingClientUpdatedAt: string;
}): FarmWriteDecision {
  const { existing, role, isAdmin, incomingClientUpdatedAt } = params;
  if (!existing) return { kind: "insert" };
  if (!isAdmin && !canEditFarm(role)) return { kind: "forbidden" };
  return incomingIsNewer(existing.client_updated_at, incomingClientUpdatedAt)
    ? { kind: "accept" }
    : { kind: "server_wins" };
}

/**
 * Whether a report save may store the farm link it asks for. A farm that does
 * not exist yet is allowed (the device may sync the report before the farm);
 * an existing farm requires membership. Anonymous saves never link, so a
 * report cannot be attached to someone else's farm without an account.
 */
export function mayLinkReportToFarm(params: {
  callerId: string | null;
  farmExists: boolean;
  role: FarmRole | null;
  isAdmin: boolean;
}): boolean {
  const { callerId, farmExists, role, isAdmin } = params;
  if (!callerId) return false;
  if (!farmExists) return true;
  return isAdmin || role !== null;
}
