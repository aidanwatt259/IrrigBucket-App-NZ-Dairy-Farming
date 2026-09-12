// Pure, side-effect-free conflict-resolution logic for the report upsert
// endpoint. Kept separate from the route handler so it can be unit-tested
// without a database or HTTP server, and so the Last-Write-Wins contract is
// expressed in one place.

/** The subset of a stored report row needed to resolve a conflict. */
export interface ExistingReportMeta {
  user_id: string | null;
  client_updated_at: string | null;
  updated_at: string | null;
  created_at: string;
}

export type UpsertDecision =
  // Caller is not allowed to write over a report owned by another user.
  | { kind: "forbidden" }
  // No row exists for this id yet — create it.
  | { kind: "insert" }
  // Incoming client write is newer than the stored copy — overwrite.
  | { kind: "accept" }
  // Stored copy is newer-or-equal — keep it and echo it back to the client.
  | { kind: "server_wins" };

export interface DecideReportUpsertParams {
  /** The currently stored row for this id, or null if none exists. */
  existing: ExistingReportMeta | null;
  /** The authenticated user's id, or null for anonymous saves. */
  callerId: string | null;
  /** Whether the caller has admin privileges. */
  isAdmin: boolean;
  /**
   * The client's last-local-modification timestamp (ISO-8601), already
   * resolved by the caller (defaults to server time when the client omits it).
   */
  incomingClientUpdatedAt: string;
}

/**
 * Decide how a save should be applied for offline-first Last-Write-Wins sync.
 *
 * Ownership is enforced first: a report that already belongs to a different
 * user cannot be overwritten unless the caller is an admin. Anonymous rows
 * (user_id === null) are unowned and may be written by anyone — they are
 * UUID-gated and get reconciled to an account during account binding.
 *
 * Conflict resolution compares the incoming client timestamp against the
 * stored row's client timestamp (falling back to updated_at, then created_at).
 * Both sides use the same client-authoritative clock, so comparing them is
 * meaningful even when the server clock differs from the client's. A strictly
 * newer incoming write wins; an equal or older write loses (server_wins),
 * which also makes redundant re-sends idempotent.
 */
export function decideReportUpsert(
  params: DecideReportUpsertParams,
): UpsertDecision {
  const { existing, callerId, isAdmin, incomingClientUpdatedAt } = params;

  if (!existing) {
    return { kind: "insert" };
  }

  if (
    existing.user_id !== null &&
    existing.user_id !== callerId &&
    !isAdmin
  ) {
    return { kind: "forbidden" };
  }

  const storedTs =
    existing.client_updated_at ?? existing.updated_at ?? existing.created_at;
  const storedMs = Date.parse(storedTs);
  const incomingMs = Date.parse(incomingClientUpdatedAt);

  // If the stored timestamp is unusable, prefer the incoming write so a
  // legitimate save is never silently dropped. If only the incoming timestamp
  // is unusable, keep the stored copy.
  if (Number.isNaN(storedMs)) return { kind: "accept" };
  if (Number.isNaN(incomingMs)) return { kind: "server_wins" };

  return incomingMs > storedMs ? { kind: "accept" } : { kind: "server_wins" };
}
