import type { FixtureEvent } from '../engine/batch';

/**
 * Labelled synthetic fixture set (SPEC FR-6 / DESIGN data contract).
 *
 * Contract:
 * - Fixed reference time: every batch run scores against REFERENCE_TIME, so
 *   results are repeatable to the number.
 * - Stable ids: evt-001…evt-008 are legitimate, evt-101…evt-110 are attacks.
 *   Refreshing or re-running never duplicates or renumbers fixtures.
 * - Synthetic only: account ids, device ids and IPs are invented. IPs use
 *   the RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24,
 *   203.0.113.0/24), which are reserved for examples and never routable.
 */
export const REFERENCE_TIME = '2026-11-15T12:00:00.000Z';
export const FIXTURE_VERSION = '1.0.0';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export const FIXTURES: FixtureEvent[] = [
  // ------------------------------------------------------------- legitimate
  {
    event: {
      id: 'evt-001', timestamp: '2026-11-15T04:30:00.000Z', accountId: 'acct-asha',
      ip: '203.0.113.10', country: 'IN', deviceId: 'dev-asha-phone',
      userAgent: SAFARI_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 400, priorCountries: ['IN'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-asha-phone', 'dev-asha-phone2'], previousLogin: { country: 'IN', timestamp: '2026-11-14T04:30:00.000Z' } },
    note: 'Everyday login: known phone, home country, mid-morning local time.',
  },
  {
    event: {
      id: 'evt-002', timestamp: '2026-11-14T13:30:00.000Z', accountId: 'acct-bilal',
      ip: '203.0.113.11', country: 'IN', deviceId: 'dev-bilal-phone',
      userAgent: CHROME_UA, success: true, attemptsInWindow: 2,
      accountAgeDays: 210, priorCountries: ['IN'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-bilal-phone'], previousLogin: { country: 'IN', timestamp: '2026-11-13T13:30:00.000Z' } },
    note: 'Evening login on the usual device; one earlier mistype in the window is normal.',
  },
  {
    event: {
      id: 'evt-003', timestamp: '2026-11-15T02:00:00.000Z', accountId: 'acct-chen',
      ip: '198.51.100.10', country: 'SG', deviceId: 'dev-chen-laptop',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 2,
      accountAgeDays: 90, priorCountries: ['SG'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-chen-laptop'], previousLogin: { country: 'SG', timestamp: '2026-11-14T02:00:00.000Z' } },
    note: 'A single forgotten-password failure on a known laptop — below every threshold.',
  },
  {
    event: {
      id: 'evt-004', timestamp: '2026-11-15T15:00:00.000Z', accountId: 'acct-dana',
      ip: '198.51.100.11', country: 'US', deviceId: 'dev-dana-phone',
      userAgent: SAFARI_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 320, priorCountries: ['US', 'IN'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-dana-phone'], previousLogin: { country: 'IN', timestamp: '2026-11-13T15:00:00.000Z' } },
    note: 'Real travel: India to the US over two days is ~250 km/h — physically possible, and the US is a prior country for this account.',
  },
  {
    event: {
      id: 'evt-005', timestamp: '2026-11-15T06:30:00.000Z', accountId: 'acct-asha',
      ip: '203.0.113.10', country: 'IN', deviceId: 'dev-asha-newphone',
      userAgent: SAFARI_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 400, priorCountries: ['IN'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-asha-phone', 'dev-asha-phone2'], previousLogin: { country: 'IN', timestamp: '2026-11-15T04:30:00.000Z' } },
    note: 'A brand-new phone on an established account fires New device (+15) — and nothing else. One soft signal must not block a real user.',
  },
  {
    event: {
      id: 'evt-006', timestamp: '2026-11-15T02:30:00.000Z', accountId: 'acct-eli',
      ip: '198.51.100.12', country: 'GB', deviceId: 'dev-eli-laptop',
      userAgent: CHROME_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 150, priorCountries: ['GB'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-eli-laptop'], previousLogin: { country: 'GB', timestamp: '2026-11-14T10:00:00.000Z' } },
    note: 'Night-owl login at 02:30 local fires Unusual hour (+10) only — still an Allow.',
  },
  {
    event: {
      id: 'evt-007', timestamp: '2026-11-15T03:15:00.000Z', accountId: 'acct-eli',
      ip: '198.51.100.12', country: 'GB', deviceId: 'dev-eli-tablet',
      userAgent: SAFARI_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 150, priorCountries: ['GB'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-eli-laptop'], previousLogin: { country: 'GB', timestamp: '2026-11-15T02:30:00.000Z' } },
    note: 'New tablet at 03:15 local: New device (+15) + Unusual hour (+10) = 25 — two soft signals together still stay under the Flag line.',
  },
  {
    event: {
      id: 'evt-008', timestamp: '2026-11-14T06:00:00.000Z', accountId: 'acct-fatima',
      ip: '203.0.113.12', country: 'AE', deviceId: 'dev-fatima-phone',
      userAgent: SAFARI_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 500, priorCountries: ['AE', 'IN'],
    },
    label: 'legit', expectedDecision: 'Allow',
    context: { knownDeviceIds: ['dev-fatima-phone'], previousLogin: { country: 'AE', timestamp: '2026-11-13T06:00:00.000Z' } },
    note: 'Routine login from a second home country that is already in the account history.',
  },

  // --------------------------------------------------------------- attacks
  {
    event: {
      id: 'evt-101', timestamp: '2026-11-14T21:30:00.000Z', accountId: 'acct-asha',
      ip: '203.0.113.66', country: 'IN', deviceId: 'dev-unknown-1',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 9,
      accountAgeDays: 400, priorCountries: ['IN'],
    },
    label: 'attack', expectedDecision: 'Block',
    context: { knownDeviceIds: ['dev-asha-phone', 'dev-asha-phone2'], previousLogin: { country: 'IN', timestamp: '2026-11-14T04:30:00.000Z' } },
    note: 'Credential stuffing at 03:00 local: velocity (+25) + machine pace (+20) + new device (+15) + unusual hour (+10) = 70 — exactly the Block line.',
  },
  {
    event: {
      id: 'evt-102', timestamp: '2026-11-15T16:00:00.000Z', accountId: 'acct-dana',
      ip: '198.51.100.23', country: 'RU', deviceId: 'dev-dana-new',
      userAgent: CHROME_UA, success: true, attemptsInWindow: 1,
      accountAgeDays: 320, priorCountries: ['US', 'IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-dana-phone'], previousLogin: { country: 'US', timestamp: '2026-11-15T15:00:00.000Z' } },
    note: 'Impossible travel: US login one hour before a Russian one (~7,800 km/h). The attempt succeeded, so it Flags for review rather than auto-blocking: travel (+40) + new device (+15) = 55.',
  },
  {
    event: {
      id: 'evt-103', timestamp: '2026-11-15T08:00:00.000Z', accountId: 'acct-spray-1',
      ip: '192.0.2.99', country: 'IN', deviceId: 'dev-spray-1',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 2,
      accountAgeDays: 120, priorCountries: ['IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-real-1'] },
    note: 'Password spray, account 1 of 4 from one IP: spray (+25) + new device (+15) = 40 — exactly the Flag line. Few attempts per account keeps velocity silent.',
  },
  {
    event: {
      id: 'evt-104', timestamp: '2026-11-15T08:01:00.000Z', accountId: 'acct-spray-2',
      ip: '192.0.2.99', country: 'IN', deviceId: 'dev-spray-2',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 2,
      accountAgeDays: 240, priorCountries: ['IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-real-2'] },
    note: 'Password spray, account 2 of 4 from the same IP.',
  },
  {
    event: {
      id: 'evt-105', timestamp: '2026-11-15T08:02:00.000Z', accountId: 'acct-spray-3',
      ip: '192.0.2.99', country: 'IN', deviceId: 'dev-spray-3',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 2,
      accountAgeDays: 60, priorCountries: ['IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-real-3'] },
    note: 'Password spray, account 3 of 4 from the same IP.',
  },
  {
    event: {
      id: 'evt-106', timestamp: '2026-11-15T08:03:00.000Z', accountId: 'acct-spray-4',
      ip: '192.0.2.99', country: 'IN', deviceId: 'dev-spray-4',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 2,
      accountAgeDays: 300, priorCountries: ['IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-real-4'] },
    note: 'Password spray, account 4 of 4 from the same IP — the fourth distinct account is what trips the spray threshold.',
  },
  {
    event: {
      id: 'evt-107', timestamp: '2026-11-15T09:00:00.000Z', accountId: 'acct-bilal',
      ip: '203.0.113.77', country: 'IN', deviceId: 'dev-unknown-2',
      userAgent: 'python-requests/2.32.3', success: false, attemptsInWindow: 6,
      accountAgeDays: 210, priorCountries: ['IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-bilal-phone'], previousLogin: { country: 'IN', timestamp: '2026-11-14T13:30:00.000Z' } },
    note: 'Scripted login tool: velocity (+25) + bot user agent (+20) + new device (+15) = 60.',
  },
  {
    event: {
      id: 'evt-108', timestamp: '2026-11-14T18:30:00.000Z', accountId: 'acct-chen',
      ip: '198.51.100.44', country: 'SG', deviceId: 'dev-unknown-3',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 6,
      accountAgeDays: 90, priorCountries: ['SG'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-chen-laptop'], previousLogin: { country: 'SG', timestamp: '2026-11-14T02:00:00.000Z' } },
    note: '02:30 local burst from an unknown device: velocity (+25) + new device (+15) + unusual hour (+10) = 50.',
  },
  {
    event: {
      id: 'evt-109', timestamp: '2026-11-15T07:00:00.000Z', accountId: 'acct-fatima',
      ip: '203.0.113.88', country: 'AE', deviceId: 'dev-fatima-phone',
      userAgent: 'curl/8.5.0', success: false, attemptsInWindow: 7,
      accountAgeDays: 500, priorCountries: ['AE', 'IN'],
    },
    label: 'attack', expectedDecision: 'Flag',
    context: { knownDeviceIds: ['dev-fatima-phone'], previousLogin: { country: 'AE', timestamp: '2026-11-14T06:00:00.000Z' } },
    note: 'curl is not a browser: velocity (+25) + bot user agent (+20) = 45, even with a spoofed known device id.',
  },
  {
    event: {
      id: 'evt-110', timestamp: '2026-11-15T05:00:00.000Z', accountId: 'acct-eli',
      ip: '198.51.100.55', country: 'JP', deviceId: 'dev-eli-unknown',
      userAgent: CHROME_UA, success: false, attemptsInWindow: 6,
      accountAgeDays: 150, priorCountries: ['GB'],
    },
    label: 'attack', expectedDecision: 'Block',
    context: { knownDeviceIds: ['dev-eli-laptop'], previousLogin: { country: 'GB', timestamp: '2026-11-15T03:30:00.000Z' } },
    note: 'London to Tokyo in 90 minutes (~6,400 km/h) plus a failure burst: travel (+40) + velocity (+25) + new device (+15) = 80.',
  },
];
