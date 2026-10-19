import type { DuStatus, TestSummary } from '@workspace/sync';
import { calculateTestResults } from './calculations';
import type { SavedReport } from './savedReports';

/** Reduce saved reports to the per-irrigator test summaries the dashboard needs. */
export function summarizeReports(reports: SavedReport[]): TestSummary[] {
  const out: TestSummary[] = [];
  for (const report of reports) {
    const irrigatorId = report.operationData?.irrigatorId;
    if (!irrigatorId) continue;
    const results = calculateTestResults(
      report.volumes,
      report.systemParams.diameter,
      report.systemParams.targetDepth,
      report.sections,
    );
    out.push({
      reportId: report.id,
      irrigatorId,
      testDate: report.testDate || report.savedAt.slice(0, 10),
      du: results?.du ?? null,
      duStatus: results?.duStatus ?? null,
    });
  }
  return out;
}

/** Plain-language next steps for a DU result. */
export function nextSteps(duStatus: DuStatus): { title: string; body: string } {
  switch (duStatus) {
    case 'good':
      return {
        title: 'Your irrigator is watering evenly',
        body: 'No changes needed. Keep an eye on nozzles and pressure through the season.',
      };
    case 'fair':
      return {
        title: 'Watering is a bit uneven',
        body: 'Some areas get more water than others. Check for blocked or worn nozzles and leaking seals, and confirm the operating pressure matches the design.',
      };
    case 'poor':
      return {
        title: 'Watering is uneven — worth fixing',
        body: 'Large parts of the paddock are getting too much or too little water. Inspect nozzles, pressure regulators and sprinkler packages, and talk to your irrigation service provider.',
      };
  }
}
