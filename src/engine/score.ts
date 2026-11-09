import { evaluateSignals } from './signals';
import type { Decision, LoginEvent, ScoreContext, ScoredEvent } from './types';

/** Decision thresholds (SPEC FR-3): Allow < 40, Flag 40–69, Block ≥ 70. */
export const THRESHOLDS = { flagAt: 40, blockAt: 70 } as const;

export function decide(score: number): Decision {
  if (score >= THRESHOLDS.blockAt) return 'Block';
  if (score >= THRESHOLDS.flagAt) return 'Flag';
  return 'Allow';
}

/**
 * Scores one validated login event. Pure and deterministic — the caller
 * supplies "now" via context.referenceTime; the engine never reads a clock.
 * Runs in well under 50 ms (SPEC NFR-1): six constant-time checks.
 */
export function scoreEvent(event: LoginEvent, context: ScoreContext): ScoredEvent {
  const signals = evaluateSignals(event, context);
  const raw = signals.reduce((sum, s) => sum + s.contribution, 0);
  const score = Math.min(100, Math.max(0, raw));
  return {
    event,
    score,
    decision: decide(score),
    signals,
    thresholds: { flagAt: THRESHOLDS.flagAt, blockAt: THRESHOLDS.blockAt },
  };
}
