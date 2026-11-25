/**
 * Report export helpers shared by the web and mobile apps so a consultant's
 * CSV looks the same whichever device produced it.
 */

/** The business details a consultant puts on their reports. */
export interface ReportBranding {
  businessName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** A small `data:image/...;base64,` logo, or null. */
  logo: string | null;
}

export const EMPTY_BRANDING: ReportBranding = {
  businessName: null,
  contactName: null,
  phone: null,
  email: null,
  website: null,
  logo: null,
};

/** True when there is anything worth printing on a report header. */
export function hasBranding(branding: ReportBranding | null | undefined): branding is ReportBranding {
  if (!branding) return false;
  return !!(branding.businessName || branding.logo || branding.contactName);
}

/** The contact line under a business name: "Jo Bloggs · 027 123 4567 · jo@example.co.nz". */
export function brandingContactLine(branding: ReportBranding): string {
  return [branding.contactName, branding.phone, branding.email, branding.website]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" · ");
}

/** One row of a reports CSV export. */
export interface ReportCsvRow {
  testDate: string | null;
  farmName: string | null;
  irrigatorName: string | null;
  irrigatorType: string | null;
  assessorName: string | null;
  /** 0–1 fraction. */
  du: number | null;
  duStatus: string | null;
  avgDepthMm: number | null;
  targetDepthMm: number | null;
  bucketCount: number | null;
  windSpeedKmh: number | null;
  reportId: string;
}

export const REPORT_CSV_COLUMNS: { header: string; value: (row: ReportCsvRow) => unknown }[] = [
  { header: "Test date", value: (r) => r.testDate },
  { header: "Farm", value: (r) => r.farmName },
  { header: "Irrigator", value: (r) => r.irrigatorName },
  { header: "Type", value: (r) => r.irrigatorType },
  { header: "Assessor", value: (r) => r.assessorName },
  { header: "DU %", value: (r) => (r.du == null ? null : Math.round(r.du * 1000) / 10) },
  { header: "DU status", value: (r) => describeDuStatus(r.duStatus) },
  { header: "Avg depth (mm)", value: (r) => roundTo(r.avgDepthMm, 1) },
  { header: "Target depth (mm)", value: (r) => roundTo(r.targetDepthMm, 1) },
  { header: "Buckets", value: (r) => r.bucketCount },
  { header: "Wind (km/h)", value: (r) => roundTo(r.windSpeedKmh, 1) },
  { header: "Report ID", value: (r) => r.reportId },
];

export function describeDuStatus(status: string | null | undefined): string | null {
  switch (status) {
    case "good":
      return "Pass";
    case "fair":
      return "Attention";
    case "poor":
      return "Fail";
    default:
      return status ?? null;
  }
}

function roundTo(value: number | null | undefined, places: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Quote a CSV cell per RFC 4180; empty for null/undefined. */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  // Neutralise spreadsheet formula injection ("=cmd()", "+", "-", "@").
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Build a complete CSV document (with header row and CRLF line endings). */
export function buildReportsCsv(rows: ReportCsvRow[]): string {
  const lines = [REPORT_CSV_COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(REPORT_CSV_COLUMNS.map((c) => csvCell(c.value(row))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** A safe file name like "irrigbucket-reports-smith-farm-2026-10-19.csv". */
export function reportsCsvFilename(scope: string | null, today: string): string {
  const slug = (scope ?? "all-farms")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `irrigbucket-reports-${slug || "all-farms"}-${today}.csv`;
}
