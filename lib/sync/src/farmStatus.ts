/**
 * Pure helpers for the farmer's view of an irrigator: what its last test
 * found and when the next one is due. Dates are `YYYY-MM-DD` strings and
 * all arithmetic is done in UTC so results don't shift with the device clock.
 */

export type DuStatus = "good" | "fair" | "poor";

/** One saved test, reduced to what the dashboard needs. */
export interface TestSummary {
  reportId: string;
  irrigatorId: string;
  /** `YYYY-MM-DD`; the day the buckets were read. */
  testDate: string;
  /** 0–1, or null when the test had too few readings. */
  du: number | null;
  duStatus: DuStatus | null;
}

export type DueState = "never" | "ok" | "due-soon" | "overdue";

export interface IrrigatorStatus {
  lastTest: TestSummary | null;
  /** `YYYY-MM-DD`, or null when never tested. */
  nextDue: string | null;
  /** Negative when overdue; null when never tested. */
  daysUntilDue: number | null;
  state: DueState;
}

/** A test is "due soon" this many days before its due date. */
export const DUE_SOON_DAYS = 30;

/** Re-test sooner than the normal interval when the last result was weak. */
export const MAX_INTERVAL_AFTER_FAIR_MONTHS = 6;
export const MAX_INTERVAL_AFTER_POOR_MONTHS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function parseDate(value: string): Date | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `date` plus `months`, clamping the day to the end of the target month. */
export function addMonths(date: string, months: number): string | null {
  const d = parseDate(date);
  if (!d) return null;
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toDateString(target);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Months until the next test, given the normal interval and the last result. */
export function retestIntervalMonths(intervalMonths: number, lastStatus: DuStatus | null): number {
  const interval = Math.max(1, Math.round(intervalMonths));
  if (lastStatus === "poor") return Math.min(interval, MAX_INTERVAL_AFTER_POOR_MONTHS);
  if (lastStatus === "fair") return Math.min(interval, MAX_INTERVAL_AFTER_FAIR_MONTHS);
  return interval;
}

/** The most recent test by date (ties broken by position: earlier in the list wins). */
export function latestTest(tests: TestSummary[]): TestSummary | null {
  let latest: TestSummary | null = null;
  for (const t of tests) {
    if (!parseDate(t.testDate)) continue;
    if (!latest || t.testDate > latest.testDate) latest = t;
  }
  return latest;
}

export function irrigatorStatus(
  irrigator: { id: string; testIntervalMonths: number },
  tests: TestSummary[],
  today: string,
): IrrigatorStatus {
  const lastTest = latestTest(tests.filter((t) => t.irrigatorId === irrigator.id));
  if (!lastTest) return { lastTest: null, nextDue: null, daysUntilDue: null, state: "never" };

  const nextDue = addMonths(
    lastTest.testDate,
    retestIntervalMonths(irrigator.testIntervalMonths, lastTest.duStatus),
  );
  const daysUntilDue = nextDue ? daysBetween(today, nextDue) : null;
  if (nextDue === null || daysUntilDue === null) {
    return { lastTest, nextDue: null, daysUntilDue: null, state: "never" };
  }
  const state: DueState =
    daysUntilDue < 0 ? "overdue" : daysUntilDue <= DUE_SOON_DAYS ? "due-soon" : "ok";
  return { lastTest, nextDue, daysUntilDue, state };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Mar 2027" */
export function formatDate(date: string): string {
  const d = parseDate(date);
  if (!d) return date;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short wording for a due state, e.g. "Overdue by 12 days" or "Due 12 Mar 2027". */
export function describeDue(status: IrrigatorStatus): string {
  if (status.state === "never" || status.nextDue === null || status.daysUntilDue === null) {
    return "Not tested yet";
  }
  const days = status.daysUntilDue;
  if (days < 0) {
    const overdue = -days;
    return overdue === 1 ? "Overdue by 1 day" : `Overdue by ${overdue} days`;
  }
  if (days === 0) return "Due today";
  if (days <= DUE_SOON_DAYS) return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  return `Due ${formatDate(status.nextDue)}`;
}

/** Today's date as `YYYY-MM-DD` in the device's local time zone. */
export function todayString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
