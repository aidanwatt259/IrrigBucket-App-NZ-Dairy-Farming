/**
 * Pure, side-effect-free reconciliation helpers. No I/O, no clock, no RNG
 * except where injected — so every branch is deterministically unit-testable.
 */

import type { BackoffOptions, SyncReport } from "./types.js";

/**
 * Compare two ISO-8601 timestamps for Last-Write-Wins ordering.
 *
 * Returns a positive number when `a` is newer, negative when `b` is newer, and
 * `0` when they are equal. Unparseable timestamps sort as oldest (a valid time
 * always beats an invalid one); two invalid values compare equal.
 */
export function compareTimestamps(a: string, b: string): number {
  const am = Date.parse(a);
  const bm = Date.parse(b);
  const aBad = Number.isNaN(am);
  const bBad = Number.isNaN(bm);
  if (aBad && bBad) return 0;
  if (aBad) return -1;
  if (bBad) return 1;
  return am - bm;
}

/**
 * Decide which record to keep when a remote (server) record meets the local
 * copy during a pull. The remote wins only if it is STRICTLY newer than local;
 * ties and older remotes keep the local record (so an equal-timestamp pull does
 * not churn local state). A missing local record always adopts the remote.
 *
 * This mirrors the server's LWW semantics (strictly-newer incoming wins) so the
 * two sides converge.
 */
export function reconcileRemote<TData>(
  local: SyncReport<TData> | null,
  remote: SyncReport<TData>,
): SyncReport<TData> {
  if (!local) return remote;
  return compareTimestamps(remote.clientUpdatedAt, local.clientUpdatedAt) > 0
    ? remote
    : local;
}

/** Default exponential-backoff parameters. */
export const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 1000,
  factor: 2,
  maxMs: 60000,
  jitter: 0.25,
};

/**
 * Compute the retry delay (in ms) for the given attempt number (1-based).
 *
 * Exponential growth `base * factor^(attempts-1)`, capped at `maxMs`, plus up
 * to `jitter` fractional jitter drawn from `rand`. Inject `rand = () => 0` in
 * tests to make the result deterministic.
 */
export function computeBackoff(
  attempts: number,
  opts: BackoffOptions,
  rand: () => number = Math.random,
): number {
  const exponent = Math.max(0, attempts - 1);
  const raw = Math.min(opts.maxMs, opts.baseMs * Math.pow(opts.factor, exponent));
  const jitterAmount = raw * opts.jitter * rand();
  return Math.round(raw + jitterAmount);
}
