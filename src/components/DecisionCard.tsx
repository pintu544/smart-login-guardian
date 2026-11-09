import type { Decision, ScoredEvent } from '../engine/types';

export const DECISION_STYLES: Record<
  Decision,
  { pill: string; bar: string; text: string; label: string }
> = {
  Allow: {
    pill: 'bg-emerald-100 text-emerald-900 ring-emerald-600/30',
    bar: 'bg-emerald-600',
    text: 'text-emerald-700',
    label: 'Allow — let the login through',
  },
  Flag: {
    pill: 'bg-amber-100 text-amber-900 ring-amber-600/30',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    label: 'Flag — step-up check / human review',
  },
  Block: {
    pill: 'bg-rose-100 text-rose-900 ring-rose-600/30',
    bar: 'bg-rose-600',
    text: 'text-rose-700',
    label: 'Block — deny the attempt',
  },
};

export function DecisionPill({ decision }: { decision: Decision }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${DECISION_STYLES[decision].pill}`}
    >
      {decision}
    </span>
  );
}

/** Score + decision + the signal-by-signal explanation (SPEC FR-3 / FR-4). */
export default function DecisionCard({ scored }: { scored: ScoredEvent }) {
  const { event, score, decision, signals, thresholds } = scored;
  const style = DECISION_STYLES[decision];
  const firedCount = signals.filter((s) => s.fired).length;

  return (
    <section aria-label="Scoring result" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Risk score
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className={`text-5xl font-bold tabular-nums ${style.text}`}>{score}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">{style.label}</p>
        </div>
        <div className="text-right">
          <DecisionPill decision={decision} />
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Flag at ≥ {thresholds.flagAt} · Block at ≥ {thresholds.blockAt}
            <br />
            {firedCount} of {signals.length} signals fired
          </p>
        </div>
      </div>

      {/* Threshold scale with marker */}
      <div className="mt-5" aria-hidden="true">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className="absolute inset-y-0 left-0 bg-emerald-500/70" style={{ width: '40%' }} />
          <div className="absolute inset-y-0 bg-amber-400/80" style={{ left: '40%', width: '30%' }} />
          <div className="absolute inset-y-0 bg-rose-500/70" style={{ left: '70%', width: '30%' }} />
          <div
            className={`absolute inset-y-0 rounded-full ${style.bar}`}
            style={{ width: `${Math.max(score, 1.5)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500">
          <span>0</span>
          <span className="tabular-nums">40 · Flag</span>
          <span className="tabular-nums">70 · Block</span>
          <span>100</span>
        </div>
      </div>

      <p className="mt-4 break-words text-xs text-slate-500">
        Event <span className="font-mono">{event.id}</span> · account{' '}
        <span className="font-mono">{event.accountId}</span> · {event.country} ·{' '}
        {event.success ? 'succeeded' : 'failed'} · {event.attemptsInWindow} attempt(s) in window
      </p>

      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wider text-slate-700">
        Why — signal by signal
      </h3>
      <ul className="mt-3 divide-y divide-slate-100">
        {signals.map((s) => (
          <li key={s.signalId} className="flex gap-3 py-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                s.fired ? 'bg-rose-500' : 'bg-slate-300'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900">{s.label}</p>
                <p
                  className={`font-mono text-sm tabular-nums ${
                    s.fired ? 'font-semibold text-rose-600' : 'text-slate-400'
                  }`}
                >
                  {s.fired ? `+${s.contribution}` : `0 / +${s.weight}`}
                </p>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
