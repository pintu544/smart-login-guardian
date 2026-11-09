import type { FieldErrors, LoginEvent, ValidationResult } from './types';

const COUNTRY_RE = /^[A-Z]{2}$/;
const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates untrusted input (form values or pasted JSON) into a LoginEvent.
 * Returns field-level errors and never throws (SPEC FR-5 / GRILL Q6).
 */
export function validateEvent(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: { _form: 'Input must be a JSON object describing one login event.' } };
  }

  const errors: FieldErrors = {};

  const id = input.id;
  if (typeof id !== 'string' || id.trim() === '') {
    errors.id = 'Event id is required (a non-empty string).';
  }

  const timestamp = input.timestamp;
  if (typeof timestamp !== 'string' || timestamp.trim() === '') {
    errors.timestamp = 'Timestamp is required (ISO 8601 string).';
  } else if (Number.isNaN(Date.parse(timestamp))) {
    errors.timestamp = 'Timestamp is not a parseable date. Use ISO 8601, e.g. 2026-11-15T14:32:00.000Z.';
  }

  const accountId = input.accountId;
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    errors.accountId = 'Account id is required (a non-empty string).';
  }

  const ip = input.ip;
  if (typeof ip !== 'string' || !IPV4_RE.test(ip)) {
    errors.ip = 'IP must be a valid IPv4 address, e.g. 203.0.113.7.';
  }

  const country = input.country;
  if (typeof country !== 'string' || !COUNTRY_RE.test(country)) {
    errors.country = 'Country must be a 2-letter upper-case code, e.g. IN.';
  }

  const deviceId = input.deviceId;
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    errors.deviceId = 'Device id is required (a non-empty string).';
  }

  const userAgent = input.userAgent;
  if (typeof userAgent !== 'string' || userAgent.trim() === '') {
    errors.userAgent = 'User agent is required (a non-empty string).';
  }

  const success = input.success;
  if (typeof success !== 'boolean') {
    errors.success = 'Success must be true or false.';
  }

  const attemptsInWindow = input.attemptsInWindow;
  if (
    typeof attemptsInWindow !== 'number' ||
    !Number.isInteger(attemptsInWindow) ||
    attemptsInWindow < 0 ||
    attemptsInWindow > 1000
  ) {
    errors.attemptsInWindow = 'Attempts in window must be a whole number between 0 and 1000.';
  }

  const accountAgeDays = input.accountAgeDays;
  if (
    typeof accountAgeDays !== 'number' ||
    !Number.isFinite(accountAgeDays) ||
    accountAgeDays < 0
  ) {
    errors.accountAgeDays = 'Account age (days) must be a number of 0 or more.';
  }

  const priorCountries = input.priorCountries;
  if (
    !Array.isArray(priorCountries) ||
    priorCountries.some((c) => typeof c !== 'string' || !COUNTRY_RE.test(c))
  ) {
    errors.priorCountries = 'Prior countries must be a list of 2-letter upper-case codes, e.g. ["IN", "AE"].';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    event: {
      id: (id as string).trim(),
      timestamp: timestamp as string,
      accountId: (accountId as string).trim(),
      ip: ip as string,
      country: country as string,
      deviceId: (deviceId as string).trim(),
      userAgent: userAgent as string,
      success: success as boolean,
      attemptsInWindow: attemptsInWindow as number,
      accountAgeDays: accountAgeDays as number,
      priorCountries: [...(priorCountries as string[])],
    },
  };
}
