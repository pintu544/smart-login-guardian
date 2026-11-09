import { distanceKm, localHour } from './geo';
import type { LoginEvent, ScoreContext, SignalResult } from './types';

/**
 * The six risk signals. Each is a small pure function returning whether it
 * fired, the points it contributes, and a plain-language explanation a human
 * reviewer can trust or challenge (SPEC FR-2 / FR-4).
 *
 * Weights were calibrated against the labelled fixture set (see
 * src/data/fixtures.ts and the Batch Lab): no single "soft" signal can block
 * on its own, an impossible-travel finding always at least flags, and
 * combined attack patterns cross the Block threshold.
 */
export const WEIGHTS = {
  failedAttemptVelocity: 25,
  impossibleTravel: 40,
  newDevice: 15,
  unusualHour: 10,
  botLikeClient: 20,
  passwordSpray: 25,
} as const;

/** Failed attempts at or above this count (in the 10-min window) fire velocity. */
export const VELOCITY_THRESHOLD = 5;
/** Sustained pace at or above this many attempts/window reads as machine-driven. */
export const BOT_PACE_THRESHOLD = 8;
/** Accounts younger than this (days) are expected to show new devices. */
export const NEW_DEVICE_MIN_ACCOUNT_AGE_DAYS = 7;
/** Local hours [00:00, 05:00) count as unusual for an established account. */
export const UNUSUAL_HOUR_END = 5;
/** Distinct accounts from one IP at or above this count fire the spray signal. */
export const SPRAY_THRESHOLD = 4;
/** Faster than this (km/h) between consecutive logins is not humanly possible. */
export const MAX_PLAUSIBLE_SPEED_KMH = 900;

const BOT_UA_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /python-requests/i, label: 'python-requests' },
  { pattern: /python-urllib/i, label: 'python-urllib' },
  { pattern: /\bcurl\//i, label: 'curl' },
  { pattern: /\bwget\//i, label: 'Wget' },
  { pattern: /go-http-client/i, label: 'Go HTTP client' },
  { pattern: /\bokhttp\//i, label: 'OkHttp' },
  { pattern: /headlesschrome/i, label: 'HeadlessChrome' },
  { pattern: /\bselenium\b/i, label: 'Selenium' },
  { pattern: /\bscrapy\b/i, label: 'Scrapy' },
  { pattern: /\bjava\//i, label: 'Java HTTP client' },
  { pattern: /\bbot\b/i, label: 'a self-declared bot' },
];

function result(
  base: Pick<SignalResult, 'signalId' | 'label' | 'weight'>,
  fired: boolean,
  explanation: string,
): SignalResult {
  return {
    ...base,
    fired,
    contribution: fired ? base.weight : 0,
    explanation,
  };
}

export function failedAttemptVelocity(event: LoginEvent): SignalResult {
  const base = {
    signalId: 'failed-attempt-velocity' as const,
    label: 'Failed-attempt velocity',
    weight: WEIGHTS.failedAttemptVelocity,
  };
  if (event.success) {
    return result(base, false, 'The attempt succeeded, so there is no burst of failures to measure.');
  }
  if (event.attemptsInWindow >= VELOCITY_THRESHOLD) {
    return result(
      base,
      true,
      `${event.attemptsInWindow} attempts in the last 10 minutes and this one failed — at or above the burst threshold of ${VELOCITY_THRESHOLD}. Rapid repeated failures are the shape of credential stuffing or brute force.`,
    );
  }
  return result(
    base,
    false,
    `${event.attemptsInWindow} attempt(s) in the last 10 minutes — below the burst threshold of ${VELOCITY_THRESHOLD}.`,
  );
}

export function impossibleTravel(event: LoginEvent, context: ScoreContext): SignalResult {
  const base = {
    signalId: 'impossible-travel' as const,
    label: 'Impossible travel',
    weight: WEIGHTS.impossibleTravel,
  };
  const prev = context.previousLogin;
  if (!prev) {
    return result(base, false, 'No previous successful login is on record, so there is no journey to compare against.');
  }
  if (prev.country === event.country) {
    return result(base, false, `Same country as the previous login (${prev.country}), so no travel is involved.`);
  }
  const dist = distanceKm(prev.country, event.country);
  if (dist === null) {
    return result(
      base,
      false,
      `Previous country ${prev.country} or current country ${event.country} is outside the built-in reference table, so travel speed cannot be computed.`,
    );
  }
  const hours =
    (Date.parse(event.timestamp) - Date.parse(prev.timestamp)) / 3600_000;
  if (!(hours > 0)) {
    return result(base, false, 'The previous login is not earlier than this attempt, so travel speed cannot be computed.');
  }
  const speed = dist / hours;
  if (speed > MAX_PLAUSIBLE_SPEED_KMH) {
    return result(
      base,
      true,
      `Previous login was in ${prev.country} ${hours.toFixed(1)}h ago; this attempt is in ${event.country}, roughly ${Math.round(dist).toLocaleString('en-US')} km away. Covering that in ${hours.toFixed(1)}h means travelling at ~${Math.round(speed).toLocaleString('en-US')} km/h — faster than a commercial flight (${MAX_PLAUSIBLE_SPEED_KMH} km/h), so the two logins cannot both be the account owner in person.`,
    );
  }
  return result(
    base,
    false,
    `${prev.country} → ${event.country} is about ${Math.round(dist).toLocaleString('en-US')} km in ${hours.toFixed(1)}h (~${Math.round(speed).toLocaleString('en-US')} km/h) — fast, but physically possible.`,
  );
}

export function newDevice(event: LoginEvent, context: ScoreContext): SignalResult {
  const base = {
    signalId: 'new-device' as const,
    label: 'New device',
    weight: WEIGHTS.newDevice,
  };
  if (context.knownDeviceIds.includes(event.deviceId)) {
    return result(base, false, `Device ${event.deviceId} has been seen on this account before.`);
  }
  if (event.accountAgeDays < NEW_DEVICE_MIN_ACCOUNT_AGE_DAYS) {
    return result(
      base,
      false,
      `Device is new, but the account is only ${event.accountAgeDays} day(s) old — new devices are expected while an account is under ${NEW_DEVICE_MIN_ACCOUNT_AGE_DAYS} days old.`,
    );
  }
  return result(
    base,
    true,
    `Device ${event.deviceId} has never been seen on this ${event.accountAgeDays}-day-old account. Established accounts suddenly appearing on new hardware is a classic takeover sign.`,
  );
}

export function unusualHour(event: LoginEvent): SignalResult {
  const base = {
    signalId: 'unusual-hour' as const,
    label: 'Unusual hour',
    weight: WEIGHTS.unusualHour,
  };
  const hour = localHour(event.timestamp, event.country);
  if (hour === null) {
    return result(base, false, `Country ${event.country} is outside the built-in timezone table, so the local hour cannot be estimated.`);
  }
  if (hour < UNUSUAL_HOUR_END) {
    return result(
      base,
      true,
      `The attempt lands at about ${String(hour).padStart(2, '0')}:00 local time in ${event.country} — the 00:00–0${UNUSUAL_HOUR_END}:00 window when account owners are rarely active but automated attacks run around the clock.`,
    );
  }
  return result(base, false, `About ${String(hour).padStart(2, '0')}:00 local time in ${event.country} — inside normal waking hours.`);
}

export function botLikeClient(event: LoginEvent): SignalResult {
  const base = {
    signalId: 'bot-like-client' as const,
    label: 'Bot-like client or pace',
    weight: WEIGHTS.botLikeClient,
  };
  const hit = BOT_UA_PATTERNS.find((p) => p.pattern.test(event.userAgent));
  if (hit) {
    return result(
      base,
      true,
      `The user agent identifies as ${hit.label} — a scripted HTTP client, not a browser a person would sign in with.`,
    );
  }
  if (event.attemptsInWindow >= BOT_PACE_THRESHOLD) {
    return result(
      base,
      true,
      `${event.attemptsInWindow} attempts inside 10 minutes is a sustained machine pace (threshold ${BOT_PACE_THRESHOLD}); people mistyping a password give up or reset long before this.`,
    );
  }
  return result(base, false, 'The user agent looks like an ordinary browser and the attempt pace is human.');
}

export function passwordSpray(event: LoginEvent, context: ScoreContext): SignalResult {
  const base = {
    signalId: 'password-spray' as const,
    label: 'Password-spray pattern',
    weight: WEIGHTS.passwordSpray,
  };
  if (context.distinctAccountsFromIp >= SPRAY_THRESHOLD && !event.success) {
    return result(
      base,
      true,
      `This IP has tried ${context.distinctAccountsFromIp} different accounts in the scored batch (threshold ${SPRAY_THRESHOLD}) and this attempt failed. One source quietly trying many accounts with few attempts each is password spraying — it stays under per-account lockout limits.`,
    );
  }
  if (context.distinctAccountsFromIp >= SPRAY_THRESHOLD) {
    return result(
      base,
      false,
      `This IP touched ${context.distinctAccountsFromIp} accounts in the batch, but this attempt succeeded, so it is not counted as part of the spray pattern.`,
    );
  }
  return result(
    base,
    false,
    context.distinctAccountsFromIp <= 1
      ? 'Only this account was seen from this IP in the scored context, so no spray pattern is visible.'
      : `This IP touched ${context.distinctAccountsFromIp} accounts in the batch — below the spray threshold of ${SPRAY_THRESHOLD}.`,
  );
}

/** All six signals, in display order. */
export function evaluateSignals(event: LoginEvent, context: ScoreContext): SignalResult[] {
  return [
    failedAttemptVelocity(event),
    impossibleTravel(event, context),
    newDevice(event, context),
    unusualHour(event),
    botLikeClient(event),
    passwordSpray(event, context),
  ];
}
