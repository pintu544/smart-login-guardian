/**
 * Core types for the Smart Login Guardian scoring engine.
 *
 * The engine is pure and deterministic: it never reads the system clock.
 * "Now" is always supplied by the caller through ScoreContext.referenceTime,
 * and the fixture set pins a fixed reference time so batch results repeat
 * exactly (SPEC FR-6).
 */

export interface LoginEvent {
  /** Stable event id, e.g. "evt-001". */
  id: string;
  /** ISO 8601 timestamp of the login attempt. */
  timestamp: string;
  /** Synthetic account identifier, e.g. "acct-asha". */
  accountId: string;
  /** Synthetic IPv4 address (fixtures use RFC 5737 documentation ranges). */
  ip: string;
  /** ISO 3166-1 alpha-2 country code, upper case, e.g. "IN". */
  country: string;
  /** Device identifier presented with the attempt. */
  deviceId: string;
  /** User-Agent string presented with the attempt. */
  userAgent: string;
  /** True when the login attempt succeeded. */
  success: boolean;
  /** Total attempts (successes + failures) for this account in the trailing 10-minute window, including this one. */
  attemptsInWindow: number;
  /** Age of the account in days at the time of the attempt. */
  accountAgeDays: number;
  /** Countries this account has successfully logged in from before. */
  priorCountries: string[];
}

/**
 * Everything the engine needs beyond the event itself. Kept separate so a
 * single event is never "pretending" to detect batch-level patterns
 * (password spraying, device history) it cannot see on its own (DESIGN.md).
 */
export interface ScoreContext {
  /** ISO 8601 "current time" for this scoring run. Pinned by fixtures. */
  referenceTime: string;
  /** Device ids previously seen for this account. Empty = no device history. */
  knownDeviceIds: string[];
  /** The account's previous successful login, used for impossible-travel checks. */
  previousLogin?: {
    country: string;
    timestamp: string;
  };
  /**
   * How many distinct accounts have attempted logins from this event's IP
   * in the scored batch (including this event's account). A single-event
   * score uses 1, which can never trigger the spray signal.
   */
  distinctAccountsFromIp: number;
}

export type Decision = 'Allow' | 'Flag' | 'Block';

export type SignalId =
  | 'failed-attempt-velocity'
  | 'impossible-travel'
  | 'new-device'
  | 'unusual-hour'
  | 'bot-like-client'
  | 'password-spray';

export interface SignalResult {
  signalId: SignalId;
  label: string;
  fired: boolean;
  /** Risk points this signal adds when it fires. */
  weight: number;
  /** Points actually added (weight when fired, otherwise 0). */
  contribution: number;
  /** Plain-language reason, written for a human reviewer (SPEC FR-4). */
  explanation: string;
}

export interface ScoredEvent {
  event: LoginEvent;
  /** 0–100, sum of fired signal contributions, clamped. */
  score: number;
  decision: Decision;
  signals: SignalResult[];
  thresholds: { flagAt: number; blockAt: number };
}

/** Field-level validation errors keyed by LoginEvent field name (SPEC FR-5). */
export type FieldErrors = Partial<Record<keyof LoginEvent, string>>;

export type ValidationResult =
  | { ok: true; event: LoginEvent }
  | { ok: false; errors: FieldErrors & { _form?: string } };
