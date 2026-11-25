import assert from "node:assert/strict";
import { test } from "node:test";

import {
  brandingContactLine,
  buildReportsCsv,
  csvCell,
  EMPTY_BRANDING,
  hasBranding,
  reportsCsvFilename,
  type ReportCsvRow,
} from "./reportExport";

const row = (over: Partial<ReportCsvRow> = {}): ReportCsvRow => ({
  testDate: "2026-10-01",
  farmName: "Smith Farm",
  irrigatorName: "Pivot 1",
  irrigatorType: "Centre Pivot",
  assessorName: "Jo",
  du: 0.8449,
  duStatus: "good",
  avgDepthMm: 14.26,
  targetDepthMm: 15,
  bucketCount: 24,
  windSpeedKmh: 5,
  reportId: "abc",
  ...over,
});

test("csvCell quotes commas, quotes and newlines", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(0), "0");
});

test("csvCell defuses spreadsheet formulas", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell("-5 Farm"), "'-5 Farm");
});

test("buildReportsCsv writes a header and one line per report", () => {
  const csv = buildReportsCsv([row(), row({ farmName: "O'Neil, North", du: null, duStatus: null })]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Test date,Farm,Irrigator,Type,Assessor,DU %,DU status,Avg depth (mm),Target depth (mm),Buckets,Wind (km/h),Report ID");
  assert.equal(lines[1], "2026-10-01,Smith Farm,Pivot 1,Centre Pivot,Jo,84.5,Pass,14.3,15,24,5,abc");
  assert.equal(lines[2], '2026-10-01,"O\'Neil, North",Pivot 1,Centre Pivot,Jo,,,14.3,15,24,5,abc');
  assert.equal(lines[3], "");
});

test("reportsCsvFilename slugs the farm name", () => {
  assert.equal(reportsCsvFilename("Smith & Sons Farm", "2026-10-19"), "irrigbucket-reports-smith-sons-farm-2026-10-19.csv");
  assert.equal(reportsCsvFilename(null, "2026-10-19"), "irrigbucket-reports-all-farms-2026-10-19.csv");
  assert.equal(reportsCsvFilename("!!!", "2026-10-19"), "irrigbucket-reports-all-farms-2026-10-19.csv");
});

test("branding helpers", () => {
  assert.equal(hasBranding(null), false);
  assert.equal(hasBranding(EMPTY_BRANDING), false);
  assert.equal(hasBranding({ ...EMPTY_BRANDING, phone: "027" }), false);
  assert.equal(hasBranding({ ...EMPTY_BRANDING, businessName: "AgWater" }), true);
  assert.equal(
    brandingContactLine({ ...EMPTY_BRANDING, contactName: " Jo ", phone: "027 123", email: null, website: "agwater.nz" }),
    "Jo · 027 123 · agwater.nz",
  );
});
