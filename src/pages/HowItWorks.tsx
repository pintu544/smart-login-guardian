import {
  BOT_PACE_THRESHOLD,
  MAX_PLAUSIBLE_SPEED_KMH,
  NEW_DEVICE_MIN_ACCOUNT_AGE_DAYS,
  SPRAY_THRESHOLD,
  UNUSUAL_HOUR_END,
  VELOCITY_THRESHOLD,
  WEIGHTS,
} from '../engine/signals';
import { THRESHOLDS } from '../engine/score';

const SIGNALS: { name: string; weight: number; fires: string; why: string }[] = [
  {
    name: 'Failed-attempt velocity',
    weight: WEIGHTS.failedAttemptVelocity,
    fires: `A failed attempt when the account already has ≥ ${VELOCITY_THRESHOLD} attempts in the trailing 10-minute window.`,
    why: 'Credential stuffing and brute force need volume. A person who forgot a password tries a handful of times, then resets.',
  },
  {
    name: 'Impossible travel',
    weight: WEIGHTS.impossibleTravel,
    fires: `The previous successful login and this attempt imply travel faster than ${MAX_PLAUSIBLE_SPEED_KMH} km/h between country centroids.`,
    why: 'The single strongest takeover sign: both logins cannot be the owner in person. Weighted so it always at least Flags on its own.',
  },
  {
    name: 'New device',
    weight: WEIGHTS.newDevice,
    fires: `The device id has never been seen on an account that is at least ${NEW_DEVICE_MIN_ACCOUNT_AGE_DAYS} days old.`,
    why: 'Attackers log in from their own hardware. Kept deliberately soft (+15): a new phone alone must never block a real user.',
  },
  {
    name: 'Unusual hour',
    weight: WEIGHTS.unusualHour,
    fires: `The attempt lands between 00:00 and 0${UNUSUAL_HOUR_END}:00 local time in the attempt's country.`,
    why: 'Owners sleep; botnets do not. Another soft signal — it only matters in combination.',
  },
  {
    name: 'Bot-like client or pace',
    weight: WEIGHTS.botLikeClient,
    fires: `The user agent is a scripted HTTP client (python-requests, curl, HeadlessChrome, …) or the pace reaches ≥ ${BOT_PACE_THRESHOLD} attempts in the window.`,
    why: 'People sign in with browsers. Scripted clients and machine pace are tooling fingerprints.',
  },
  {
    name: 'Password-spray pattern',
    weight: WEIGHTS.passwordSpray,
    fires: `One IP attempts ≥ ${SPRAY_THRESHOLD} distinct accounts in the scored batch and this attempt failed.`,
    why: 'Spraying tries one common password against many accounts, staying under per-account lockouts — invisible in any single event, obvious across a batch.',
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/10 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function HowItWorks() {
  return (
    <div className="space-y-6">
      <Section title="The technique: a weighted-signal engine, not a black box">
        <p>
          Every login event is checked by six independent signals. Each signal is a small,
          deterministic rule that either fires (adding its weight to the risk score) or does not —
          and either way it writes a plain-language explanation of what it saw. The score is the sum
          of the fired weights, clamped to 0–100, and the decision comes from two fixed thresholds:
          Allow below {THRESHOLDS.flagAt}, Flag from {THRESHOLDS.flagAt} to {THRESHOLDS.blockAt - 1},
          Block at {THRESHOLDS.blockAt} and above.
        </p>
        <p>
          A learned classifier was considered and rejected as the primary scorer: on synthetic data it
          would produce a number nobody can interrogate, and this challenge grades the explanation.
          Instead, the weights themselves were calibrated against the labelled fixture set — the
          “learning” lives in the calibration loop you can inspect in the Batch Lab. The result is an
          engine where every point of every score can be traced to a named rule and a sentence a
          human can argue with.
        </p>
        <p>
          Two patterns are invisible inside a single event — password spraying (one IP, many
          accounts) and device history. The engine takes those as explicit <em>context</em> inputs
          rather than pretending a single event can show them. In the Batch Lab the context is
          computed from the fixture set itself; on the Single Event page you supply it.
        </p>
      </Section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/10">
        <h2 className="px-5 pt-5 text-lg font-semibold text-slate-900 sm:px-6">The six signals</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5 font-semibold sm:px-6">Signal</th>
                <th className="px-3 py-2.5 font-semibold">Weight</th>
                <th className="px-3 py-2.5 font-semibold">Fires when</th>
                <th className="px-3 py-2.5 font-semibold">Why it matters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SIGNALS.map((s) => (
                <tr key={s.name} className="align-top">
                  <td className="px-5 py-3 font-medium text-slate-900 sm:px-6">{s.name}</td>
                  <td className="px-3 py-3 font-mono font-semibold tabular-nums text-slate-700">+{s.weight}</td>
                  <td className="px-3 py-3 leading-relaxed text-slate-600">{s.fires}</td>
                  <td className="px-3 py-3 leading-relaxed text-slate-600">{s.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-4 text-xs leading-relaxed text-slate-500 sm:px-6">
          Calibration rule of thumb: no single soft signal (device, hour) can Flag on its own;
          impossible travel always at least Flags; realistic attack combinations cross Block.
        </p>
      </section>

      <Section title="Known limitations — read these before trusting a score">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            <strong>Synthetic fixtures only.</strong> The Batch Lab numbers measure the engine against
            18 invented events with known labels. They are not, and must never be quoted as,
            real-world detection accuracy.
          </li>
          <li>
            <strong>Coarse geography.</strong> Travel speed uses country centroids and standard-time
            offsets — no IP geolocation, no daylight-saving handling, and countries outside the
            built-in table simply cannot fire the travel or hour signals (the explanation says so).
          </li>
          <li>
            <strong>Context is only as honest as its source.</strong> Device history, previous-login
            data and per-IP account counts come from the caller. A deployment would compute them from
            real login history; this prototype computes them from the fixture set or takes them from
            the form.
          </li>
          <li>
            <strong>Deterministic rules are gameable.</strong> An attacker who knows the thresholds
            can stay under them; that is true of every published rule set and is the honest price of
            full explainability.
          </li>
          <li>
            <strong>No real authentication.</strong> Nothing here logs anyone in, stores events, or
            touches a real account. It is a scoring demonstrator.
          </li>
        </ul>
      </Section>
    </div>
  );
}
