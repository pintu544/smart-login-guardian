import { describe, expect, it } from 'vitest';
import { scoreBatch } from './batch';
import {
  BOT_PACE_THRESHOLD,
  SPRAY_THRESHOLD,
  VELOCITY_THRESHOLD,
  botLikeClient,
  failedAttemptVelocity,
  impossibleTravel,
  newDevice,
  passwordSpray,
  unusualHour,
} from './signals';
import { decide, scoreEvent, THRESHOLDS } from './score';
import { validateEvent } from './validate';
import type { LoginEvent, ScoreContext } from './types';
import { FIXTURES, REFERENCE_TIME } from '../data/fixtures';

const baseEvent: LoginEvent = {
  id: 'evt-test',
  timestamp: '2026-11-15T04:30:00.000Z', // 10:00 in India
  accountId: 'acct-test',
  ip: '203.0.113.10',
  country: 'IN',
  deviceId: 'dev-known',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  success: true,
  attemptsInWindow: 1,
  accountAgeDays: 400,
  priorCountries: ['IN'],
};

const baseContext: ScoreContext = {
  referenceTime: REFERENCE_TIME,
  knownDeviceIds: ['dev-known'],
  distinctAccountsFromIp: 1,
};

describe('validateEvent', () => {
  it('accepts a well-formed event', () => {
    const r = validateEvent(baseEvent);
    expect(r.ok).toBe(true);
  });

  it('rejects non-object input with a form-level error', () => {
    const r = validateEvent('not an object');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors._form).toBeTruthy();
  });

  it('reports field-level errors for missing and malformed fields', () => {
    const r = validateEvent({
      ...baseEvent,
      id: '',
      timestamp: 'yesterday-ish',
      ip: '999.1.1.1',
      country: 'india',
      success: 'yes',
      attemptsInWindow: 2.5,
      accountAgeDays: -3,
      priorCountries: ['IN', 'x'],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.id).toBeTruthy();
      expect(r.errors.timestamp).toBeTruthy();
      expect(r.errors.ip).toBeTruthy();
      expect(r.errors.country).toBeTruthy();
      expect(r.errors.success).toBeTruthy();
      expect(r.errors.attemptsInWindow).toBeTruthy();
      expect(r.errors.accountAgeDays).toBeTruthy();
      expect(r.errors.priorCountries).toBeTruthy();
    }
  });

  it('never throws on hostile input', () => {
    expect(() => validateEvent(null)).not.toThrow();
    expect(() => validateEvent(undefined)).not.toThrow();
    expect(() => validateEvent([1, 2, 3])).not.toThrow();
    expect(() => validateEvent({ timestamp: { nested: true } })).not.toThrow();
  });
});

describe('individual signals', () => {
  it('velocity fires at the threshold for failed attempts', () => {
    const ev = { ...baseEvent, success: false, attemptsInWindow: VELOCITY_THRESHOLD };
    expect(failedAttemptVelocity(ev).fired).toBe(true);
    expect(failedAttemptVelocity({ ...ev, attemptsInWindow: VELOCITY_THRESHOLD - 1 }).fired).toBe(false);
    expect(failedAttemptVelocity({ ...ev, success: true }).fired).toBe(false);
  });

  it('impossible travel fires only for physically impossible journeys', () => {
    const ctx: ScoreContext = {
      ...baseContext,
      previousLogin: { country: 'US', timestamp: '2026-11-15T15:00:00.000Z' },
    };
    const ev = { ...baseEvent, country: 'RU', timestamp: '2026-11-15T16:00:00.000Z' };
    expect(impossibleTravel(ev, ctx).fired).toBe(true);
    // Same journey spread over two days is fine.
    const slow = { ...ev, timestamp: '2026-11-17T16:00:00.000Z' };
    expect(impossibleTravel(slow, ctx).fired).toBe(false);
    // No previous login -> cannot fire, and says why.
    const noPrev = impossibleTravel(ev, baseContext);
    expect(noPrev.fired).toBe(false);
    expect(noPrev.explanation).toMatch(/No previous/i);
  });

  it('new device fires for established accounts but not brand-new ones', () => {
    const ev = { ...baseEvent, deviceId: 'dev-stranger' };
    expect(newDevice(ev, baseContext).fired).toBe(true);
    expect(newDevice({ ...ev, accountAgeDays: 2 }, baseContext).fired).toBe(false);
    expect(newDevice(baseEvent, baseContext).fired).toBe(false);
  });

  it('unusual hour fires in the small hours local time', () => {
    // 21:30 UTC = 03:00 in India.
    expect(unusualHour({ ...baseEvent, timestamp: '2026-11-14T21:30:00.000Z' }).fired).toBe(true);
    expect(unusualHour(baseEvent).fired).toBe(false);
  });

  it('bot signal fires on scripted user agents and on machine pace', () => {
    expect(botLikeClient({ ...baseEvent, userAgent: 'python-requests/2.32.3' }).fired).toBe(true);
    expect(botLikeClient({ ...baseEvent, userAgent: 'curl/8.5.0' }).fired).toBe(true);
    expect(botLikeClient({ ...baseEvent, attemptsInWindow: BOT_PACE_THRESHOLD }).fired).toBe(true);
    expect(botLikeClient(baseEvent).fired).toBe(false);
  });

  it('spray fires at the distinct-account threshold for failed attempts', () => {
    const ev = { ...baseEvent, success: false };
    const ctx = { ...baseContext, distinctAccountsFromIp: SPRAY_THRESHOLD };
    expect(passwordSpray(ev, ctx).fired).toBe(true);
    expect(passwordSpray(ev, { ...ctx, distinctAccountsFromIp: SPRAY_THRESHOLD - 1 }).fired).toBe(false);
    expect(passwordSpray({ ...ev, success: true }, ctx).fired).toBe(false);
  });
});

describe('scoring and thresholds', () => {
  it('a clean event scores 0 and Allows', () => {
    const s = scoreEvent(baseEvent, baseContext);
    expect(s.score).toBe(0);
    expect(s.decision).toBe('Allow');
    expect(s.signals).toHaveLength(6);
    expect(s.signals.every((x) => x.explanation.length > 0)).toBe(true);
  });

  it('decision boundaries: 39 Allow, 40 Flag, 69 Flag, 70 Block', () => {
    expect(decide(THRESHOLDS.flagAt - 1)).toBe('Allow');
    expect(decide(THRESHOLDS.flagAt)).toBe('Flag');
    expect(decide(THRESHOLDS.blockAt - 1)).toBe('Flag');
    expect(decide(THRESHOLDS.blockAt)).toBe('Block');
  });

  it('fixture evt-101 lands exactly on the Block boundary (70)', () => {
    const f = FIXTURES.find((x) => x.event.id === 'evt-101');
    expect(f).toBeTruthy();
    const batch = scoreBatch(FIXTURES, REFERENCE_TIME);
    const s = batch.scored.find((x) => x.event.id === 'evt-101');
    expect(s?.score).toBe(70);
    expect(s?.decision).toBe('Block');
  });

  it('fixture spray events land exactly on the Flag boundary (40)', () => {
    const batch = scoreBatch(FIXTURES, REFERENCE_TIME);
    for (const id of ['evt-103', 'evt-104', 'evt-105', 'evt-106']) {
      const s = batch.scored.find((x) => x.event.id === id);
      expect(s?.score, id).toBe(40);
      expect(s?.decision, id).toBe('Flag');
    }
  });

  it('score is clamped to 100', () => {
    const ev: LoginEvent = {
      ...baseEvent,
      country: 'RU',
      timestamp: '2026-11-15T16:00:00.000Z', // 21:30 in RU -> not unusual; keep travel dominant
      deviceId: 'dev-stranger',
      userAgent: 'python-requests/2.32.3',
      success: false,
      attemptsInWindow: 9,
    };
    const ctx: ScoreContext = {
      referenceTime: REFERENCE_TIME,
      knownDeviceIds: ['dev-known'],
      previousLogin: { country: 'US', timestamp: '2026-11-15T15:00:00.000Z' },
      distinctAccountsFromIp: SPRAY_THRESHOLD,
    };
    const s = scoreEvent(ev, ctx);
    expect(s.score).toBe(100);
    expect(s.decision).toBe('Block');
  });

  it('is deterministic: same input, same output', () => {
    const a = scoreEvent(baseEvent, baseContext);
    const b = scoreEvent(baseEvent, baseContext);
    expect(a).toEqual(b);
  });
});

describe('fixture batch (SPEC FR-6)', () => {
  const batch = scoreBatch(FIXTURES, REFERENCE_TIME);

  it('has stable ids and the documented size', () => {
    expect(FIXTURES.length).toBe(18);
    const ids = FIXTURES.map((f) => f.event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fixture event passes validation', () => {
    for (const f of FIXTURES) {
      const r = validateEvent(f.event);
      expect(r.ok, f.event.id).toBe(true);
    }
  });

  it('matches every expected decision', () => {
    FIXTURES.forEach((f, i) => {
      expect(batch.scored[i].decision, `${f.event.id} expected ${f.expectedDecision}`).toBe(
        f.expectedDecision,
      );
    });
    expect(batch.decisionAccuracy).toBe(1);
  });

  it('reports zero false positives and zero false negatives', () => {
    expect(batch.falsePositives).toBe(0);
    expect(batch.falseNegatives).toBe(0);
    expect(batch.truePositives).toBe(10);
    expect(batch.trueNegatives).toBe(8);
    expect(batch.detectionAccuracy).toBe(1);
  });

  it('empty batch scores without crashing', () => {
    const empty = scoreBatch([], REFERENCE_TIME);
    expect(empty.total).toBe(0);
    expect(empty.detectionAccuracy).toBe(0);
  });
});
