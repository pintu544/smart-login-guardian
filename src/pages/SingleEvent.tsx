import { useMemo, useState } from 'react';
import DecisionCard from '../components/DecisionCard';
import { scoreEvent } from '../engine/score';
import { validateEvent } from '../engine/validate';
import type { FieldErrors, LoginEvent, ScoreContext, ScoredEvent } from '../engine/types';
import { SAMPLES, sampleContext, type SamplePreset } from '../data/samples';

interface FormState {
  id: string;
  timestamp: string;
  accountId: string;
  ip: string;
  country: string;
  deviceId: string;
  userAgent: string;
  success: string; // 'true' | 'false'
  attemptsInWindow: string;
  accountAgeDays: string;
  priorCountries: string; // comma-separated
  knownDeviceIds: string; // comma-separated
  previousLoginCountry: string;
  previousLoginAt: string;
  distinctAccountsFromIp: string;
}

function formFromSample(s: SamplePreset): FormState {
  const e = s.event;
  return {
    id: e.id,
    timestamp: e.timestamp,
    accountId: e.accountId,
    ip: e.ip,
    country: e.country,
    deviceId: e.deviceId,
    userAgent: e.userAgent,
    success: String(e.success),
    attemptsInWindow: String(e.attemptsInWindow),
    accountAgeDays: String(e.accountAgeDays),
    priorCountries: e.priorCountries.join(', '),
    knownDeviceIds: s.knownDeviceIds,
    previousLoginCountry: s.previousLoginCountry,
    previousLoginAt: s.previousLoginAt,
    distinctAccountsFromIp: String(s.distinctAccountsFromIp),
  };
}

function contextFromForm(f: FormState): ScoreContext {
  return {
    referenceTime: new Date().toISOString(),
    knownDeviceIds: f.knownDeviceIds.split(',').map((d) => d.trim()).filter(Boolean),
    previousLogin:
      f.previousLoginCountry.trim() && f.previousLoginAt.trim()
        ? { country: f.previousLoginCountry.trim().toUpperCase(), timestamp: f.previousLoginAt.trim() }
        : undefined,
    distinctAccountsFromIp: Math.max(1, Number.parseInt(f.distinctAccountsFromIp, 10) || 1),
  };
}

function candidateFromForm(f: FormState): Record<string, unknown> {
  return {
    id: f.id,
    timestamp: f.timestamp,
    accountId: f.accountId,
    ip: f.ip,
    country: f.country.trim().toUpperCase(),
    deviceId: f.deviceId,
    userAgent: f.userAgent,
    success: f.success === 'true',
    attemptsInWindow: Number(f.attemptsInWindow),
    accountAgeDays: Number(f.accountAgeDays),
    priorCountries: f.priorCountries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
  };
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/25';
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-600';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <span className="mt-1 block">{children}</span>
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export default function SingleEvent() {
  const [form, setForm] = useState<FormState>(() => formFromSample(SAMPLES[1]));
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [activeSample, setActiveSample] = useState<string>(SAMPLES[1].id);
  const [scored, setScored] = useState<ScoredEvent>(() =>
    scoreEvent(SAMPLES[1].event, sampleContext(SAMPLES[1])),
  );

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setActiveSample('');
  };

  const loadSample = (s: SamplePreset) => {
    setForm(formFromSample(s));
    setErrors({});
    setJsonError(null);
    setActiveSample(s.id);
    setScored(scoreEvent(s.event, sampleContext(s)));
    setMode('form');
  };

  const scoreFromForm = () => {
    const r = validateEvent(candidateFromForm(form));
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    setScored(scoreEvent(r.event, contextFromForm(form)));
  };

  const scoreFromJson = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError('That is not valid JSON. Check for trailing commas or missing quotes.');
      setErrors({});
      return;
    }
    const r = validateEvent(parsed);
    if (!r.ok) {
      setJsonError(null);
      setErrors(r.errors);
      return;
    }
    setJsonError(null);
    setErrors({});
    setScored(scoreEvent(r.event, contextFromForm(form)));
  };

  const jsonPlaceholder = useMemo(
    () => JSON.stringify(SAMPLES[1].event, null, 2),
    [],
  );

  const errorList = Object.entries(errors).filter(([k]) => k !== '_form') as [string, string][];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/10">
          <h2 className="text-base font-semibold text-slate-900">Try a sample first</h2>
          <p className="mt-1 text-sm text-slate-600">
            One tap loads a synthetic event and its account history, already scored on the right.
          </p>
          <div className="mt-3 space-y-2">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition ${
                  activeSample === s.id
                    ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">{s.name}</span>
                <span className="block text-xs leading-relaxed text-slate-600">{s.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Score your own event</h2>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold" role="tablist" aria-label="Input mode">
              {(['form', 'json'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1 capitalize ${
                    mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m === 'form' ? 'Form' : 'JSON'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'form' ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Event id" error={errors.id}>
                <input className={inputCls} value={form.id} onChange={set('id')} />
              </Field>
              <Field label="Account id" error={errors.accountId}>
                <input className={inputCls} value={form.accountId} onChange={set('accountId')} />
              </Field>
              <div className="col-span-2">
                <Field label="Timestamp (ISO 8601, UTC)" error={errors.timestamp}>
                  <input className={inputCls} value={form.timestamp} onChange={set('timestamp')} />
                </Field>
              </div>
              <Field label="IP (synthetic)" error={errors.ip}>
                <input className={inputCls} value={form.ip} onChange={set('ip')} />
              </Field>
              <Field label="Country" error={errors.country}>
                <input className={inputCls} value={form.country} onChange={set('country')} maxLength={2} />
              </Field>
              <Field label="Device id" error={errors.deviceId}>
                <input className={inputCls} value={form.deviceId} onChange={set('deviceId')} />
              </Field>
              <Field label="Outcome" error={errors.success}>
                <select className={inputCls} value={form.success} onChange={set('success')}>
                  <option value="true">Succeeded</option>
                  <option value="false">Failed</option>
                </select>
              </Field>
              <Field label="Attempts in 10-min window" error={errors.attemptsInWindow}>
                <input className={inputCls} type="number" min={0} value={form.attemptsInWindow} onChange={set('attemptsInWindow')} />
              </Field>
              <Field label="Account age (days)" error={errors.accountAgeDays}>
                <input className={inputCls} type="number" min={0} value={form.accountAgeDays} onChange={set('accountAgeDays')} />
              </Field>
              <div className="col-span-2">
                <Field label="User agent" error={errors.userAgent}>
                  <input className={inputCls} value={form.userAgent} onChange={set('userAgent')} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Prior countries (comma-separated)" error={errors.priorCountries}>
                  <input className={inputCls} value={form.priorCountries} onChange={set('priorCountries')} />
                </Field>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <textarea
                className={`${inputCls} min-h-64 font-mono text-xs leading-relaxed`}
                placeholder={jsonPlaceholder}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                aria-label="Login event as JSON"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Paste one event object with the same fields as the form. The account-history context below still applies.
              </p>
              {jsonError && <p className="mt-2 text-sm font-medium text-rose-600">{jsonError}</p>}
            </div>
          )}

          <details className="mt-4 rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-900/5" open={mode === 'json'}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Account history &amp; batch context
            </summary>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Spray and device-history patterns are invisible in a single event, so the engine takes
              them as explicit context instead of pretending (see How It Works).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Known device ids for this account">
                  <input className={inputCls} value={form.knownDeviceIds} onChange={set('knownDeviceIds')} />
                </Field>
              </div>
              <Field label="Previous login country">
                <input className={inputCls} value={form.previousLoginCountry} onChange={set('previousLoginCountry')} maxLength={2} />
              </Field>
              <Field label="Previous login at (ISO, UTC)">
                <input className={inputCls} value={form.previousLoginAt} onChange={set('previousLoginAt')} />
              </Field>
              <Field label="Distinct accounts from this IP">
                <input className={inputCls} type="number" min={1} value={form.distinctAccountsFromIp} onChange={set('distinctAccountsFromIp')} />
              </Field>
            </div>
          </details>

          {errorList.length > 0 && (
            <div className="mt-4 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-800 ring-1 ring-rose-600/20" role="alert">
              <p className="font-semibold">This event was not scored — fix {errorList.length} field{errorList.length > 1 ? 's' : ''}:</p>
              <ul className="mt-1 list-inside list-disc">
                {errorList.map(([k, v]) => (
                  <li key={k}>
                    <span className="font-mono text-xs">{k}</span>: {v}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={mode === 'form' ? scoreFromForm : scoreFromJson}
            className="mt-4 w-full rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-deep)] focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
          >
            Score this event
          </button>
        </section>
      </div>

      <div className="min-w-0">
        <DecisionCard scored={scored} />
        <p className="mt-3 px-1 text-xs leading-relaxed text-slate-500">
          Scoring runs entirely in your browser — no event ever leaves this page. Edit any field and
          score again to see exactly which explanation changes.
        </p>
      </div>
    </div>
  );
}
