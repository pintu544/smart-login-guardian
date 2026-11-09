import { scoreEvent } from './score';
import type { LoginEvent, ScoreContext, ScoredEvent } from './types';

/**
 * A labelled synthetic fixture. `label` is the ground truth used for the
 * batch metrics: 'attack' events should be Flagged or Blocked, 'legit'
 * events should be Allowed. `expectedDecision` pins the exact decision the
 * calibration targets.
 */
export interface FixtureEvent {
  event: LoginEvent;
  label: 'legit' | 'attack';
  expectedDecision: ScoredEvent['decision'];
  /** Account history context for this event (device history, previous login). */
  context: Omit<ScoreContext, 'referenceTime' | 'distinctAccountsFromIp'>;
  /** Why this fixture exists — shown in the Batch Lab. */
  note: string;
}

export interface BatchResult {
  scored: ScoredEvent[];
  total: number;
  /** Exact-decision matches against expectedDecision. */
  decisionMatches: number;
  decisionAccuracy: number;
  /** Binary attack detection: attack = Flag or Block. */
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  detectionAccuracy: number;
}

/**
 * Scores a whole fixture set through the exact same engine path the UI uses
 * for single events (T-5: batch numbers in the UI and in tests cannot
 * diverge). The one batch-level input — how many distinct accounts each IP
 * touched — is computed from the set itself, deterministically.
 */
export function scoreBatch(fixtures: FixtureEvent[], referenceTime: string): BatchResult {
  const accountsByIp = new Map<string, Set<string>>();
  for (const f of fixtures) {
    const set = accountsByIp.get(f.event.ip) ?? new Set<string>();
    set.add(f.event.accountId);
    accountsByIp.set(f.event.ip, set);
  }

  const scored = fixtures.map((f) =>
    scoreEvent(f.event, {
      referenceTime,
      knownDeviceIds: f.context.knownDeviceIds,
      previousLogin: f.context.previousLogin,
      distinctAccountsFromIp: accountsByIp.get(f.event.ip)?.size ?? 1,
    }),
  );

  let decisionMatches = 0;
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  fixtures.forEach((f, i) => {
    const s = scored[i];
    if (s.decision === f.expectedDecision) decisionMatches += 1;
    const detected = s.decision !== 'Allow';
    if (f.label === 'attack' && detected) tp += 1;
    else if (f.label === 'attack' && !detected) fn += 1;
    else if (f.label === 'legit' && detected) fp += 1;
    else tn += 1;
  });

  const total = fixtures.length;
  return {
    scored,
    total,
    decisionMatches,
    decisionAccuracy: total === 0 ? 0 : decisionMatches / total,
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    detectionAccuracy: total === 0 ? 0 : (tp + tn) / total,
  };
}
