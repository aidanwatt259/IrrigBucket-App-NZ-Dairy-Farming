import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addMonths,
  daysBetween,
  describeDue,
  formatDate,
  irrigatorStatus,
  latestTest,
  retestIntervalMonths,
  type TestSummary,
} from "./farmStatus";

const t = (over: Partial<TestSummary>): TestSummary => ({
  reportId: "r",
  irrigatorId: "i1",
  testDate: "2026-01-15",
  du: 0.85,
  duStatus: "good",
  ...over,
});

test("addMonths clamps to the end of shorter months", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-03-15", 12), "2027-03-15");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonths("not a date", 1), null);
});

test("daysBetween is signed and ignores time of day", () => {
  assert.equal(daysBetween("2026-10-01", "2026-10-11"), 10);
  assert.equal(daysBetween("2026-10-11", "2026-10-01"), -10);
  assert.equal(daysBetween("2026-10-01T23:59:00.000Z", "2026-10-02"), 1);
});

test("a weak result shortens the retest interval", () => {
  assert.equal(retestIntervalMonths(12, "good"), 12);
  assert.equal(retestIntervalMonths(12, null), 12);
  assert.equal(retestIntervalMonths(12, "fair"), 6);
  assert.equal(retestIntervalMonths(12, "poor"), 3);
  assert.equal(retestIntervalMonths(2, "fair"), 2);
});

test("latestTest picks the newest dated test and skips undated ones", () => {
  const tests = [
    t({ reportId: "a", testDate: "2026-02-01" }),
    t({ reportId: "b", testDate: "" }),
    t({ reportId: "c", testDate: "2026-03-01" }),
  ];
  assert.equal(latestTest(tests)?.reportId, "c");
  assert.equal(latestTest([]), null);
});

test("irrigatorStatus reports never / ok / due-soon / overdue", () => {
  const irrigator = { id: "i1", testIntervalMonths: 12 };
  const tests = [t({ testDate: "2026-01-15" }), t({ irrigatorId: "other", testDate: "2026-09-01" })];

  assert.equal(irrigatorStatus({ id: "nope", testIntervalMonths: 12 }, tests, "2026-10-01").state, "never");

  const ok = irrigatorStatus(irrigator, tests, "2026-10-01");
  assert.equal(ok.state, "ok");
  assert.equal(ok.nextDue, "2027-01-15");
  assert.equal(ok.lastTest?.testDate, "2026-01-15");

  assert.equal(irrigatorStatus(irrigator, tests, "2027-01-01").state, "due-soon");
  assert.equal(irrigatorStatus(irrigator, tests, "2027-01-15").daysUntilDue, 0);
  assert.equal(irrigatorStatus(irrigator, tests, "2027-02-01").state, "overdue");

  const poor = irrigatorStatus(irrigator, [t({ duStatus: "poor" })], "2026-02-01");
  assert.equal(poor.nextDue, "2026-04-15");
});

test("describeDue wording", () => {
  const irrigator = { id: "i1", testIntervalMonths: 12 };
  const tests = [t({ testDate: "2026-01-15" })];
  assert.equal(describeDue(irrigatorStatus(irrigator, [], "2026-10-01")), "Not tested yet");
  assert.equal(describeDue(irrigatorStatus(irrigator, tests, "2026-10-01")), "Due 15 Jan 2027");
  assert.equal(describeDue(irrigatorStatus(irrigator, tests, "2027-01-05")), "Due in 10 days");
  assert.equal(describeDue(irrigatorStatus(irrigator, tests, "2027-01-14")), "Due tomorrow");
  assert.equal(describeDue(irrigatorStatus(irrigator, tests, "2027-01-15")), "Due today");
  assert.equal(describeDue(irrigatorStatus(irrigator, tests, "2027-01-16")), "Overdue by 1 day");
  assert.equal(describeDue(irrigatorStatus(irrigator, tests, "2027-02-14")), "Overdue by 30 days");
  assert.equal(formatDate("2027-03-05"), "5 Mar 2027");
});
