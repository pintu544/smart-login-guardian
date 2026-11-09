import { useMemo } from 'react';
import DecisionCard, { DecisionPill } from '../components/DecisionCard';
import { scoreBatch } from '../engine/batch';
import { FIXTURES, FIXTURE_VERSION, REFERENCE_TIME } from '../data/fixtures';

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default function BatchLab() {
  // Same engine entry point the automated tests use — the numbers below are
  // the test-run numbers by construction (T-5), not a second implementation.
  const batch = useMemo(() => scoreBatch(FIXTURES, REFERENCE_TIME), []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/10 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">The fixture set is the test</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          {batch.total} labelled synthetic events (fixture set v{FIXTURE_VERSION}) scored against a
          fixed reference time of <span className="font-mono text-xs">{REFERENCE_TIME}</span>, so this
          run repeats to the number. “Attack detected” means Flag or Block; “decision accuracy” means
          the exact Allow / Flag / Block matched the label the fixture was calibrated to. These are{' '}
          <strong>synthetic fixture results</strong> — they show the engine behaves as designed on
          known patterns, not real-world accuracy.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Decision accuracy" value={pct(batch.decisionAccuracy)} hint={`${batch.decisionMatches} of ${batch.total} exact decisions matched`} />
          <Metric label="Detection accuracy" value={pct(batch.detectionAccuracy)} hint="Attack vs legitimate, binary" />
          <Metric label="False positives" value={String(batch.falsePositives)} hint="Legitimate events Flagged or Blocked" />
          <Metric label="False negatives" value={String(batch.falseNegatives)} hint="Attacks waved through as Allow" />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Confusion: {batch.truePositives} attacks caught · {batch.trueNegatives} legitimate events
          allowed · run the same numbers any time with{' '}
          <span className="font-mono">npm test</span> — the suite asserts exactly these figures.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/10">
        <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-slate-700">
          Every fixture, explained
        </h3>
        <ul className="divide-y divide-slate-100">
          {FIXTURES.map((f, i) => {
            const s = batch.scored[i];
            const match = s.decision === f.expectedDecision;
            return (
              <li key={f.event.id}>
                <details className="group">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-slate-50">
                    <span className="font-mono text-xs font-semibold text-slate-500">{f.event.id}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                        f.label === 'attack'
                          ? 'bg-rose-50 text-rose-800 ring-rose-600/25'
                          : 'bg-emerald-50 text-emerald-800 ring-emerald-600/25'
                      }`}
                    >
                      {f.label === 'attack' ? 'labelled attack' : 'labelled legit'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{f.note}</span>
                    <span className="text-xs text-slate-400">
                      expected {f.expectedDecision} → got
                    </span>
                    <DecisionPill decision={s.decision} />
                    <span className={`font-mono text-sm font-semibold tabular-nums ${match ? 'text-slate-700' : 'text-rose-600'}`}>
                      {s.score}
                    </span>
                    <span className={`text-xs font-semibold ${match ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {match ? 'match' : 'MISMATCH'}
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                    <DecisionCard scored={s} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
