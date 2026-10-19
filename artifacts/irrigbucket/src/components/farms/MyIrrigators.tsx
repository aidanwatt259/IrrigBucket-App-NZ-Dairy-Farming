import { IrrigatorCard } from './IrrigatorCard';
import { countNeedingTest, useIrrigatorRows, useSavedReports, useTestSummaries } from './irrigatorRows';

/** The farmer's home dashboard: every saved irrigator, its last result and next test. */
export function MyIrrigators() {
  const tests = useTestSummaries(useSavedReports());
  const rows = useIrrigatorRows(tests);
  if (rows.length === 0) return null;

  const needingTest = countNeedingTest(rows);
  const showFarmNames = new Set(rows.map((r) => r.farm.id)).size > 1;

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16" aria-labelledby="my-irrigators">
      <h2 id="my-irrigators" className="text-2xl font-display font-bold text-center mb-2">
        My irrigators
      </h2>
      <p className="text-muted-foreground text-center mb-8">
        {needingTest === 0
          ? 'All up to date. Tap one to run its next test.'
          : needingTest === 1
            ? '1 irrigator is due for a bucket test.'
            : `${needingTest} irrigators are due for a bucket test.`}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((row) => (
          <IrrigatorCard key={row.irrigator.id} row={row} showFarmName={showFarmNames} />
        ))}
      </div>
    </section>
  );
}
