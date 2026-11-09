import type { LoginEvent, ScoreContext } from '../engine/types';
import { FIXTURES } from './fixtures';

export interface SamplePreset {
  id: string;
  name: string;
  blurb: string;
  event: LoginEvent;
  /** Context exactly as the form captures it (comma-separated device list). */
  knownDeviceIds: string;
  previousLoginCountry: string;
  previousLoginAt: string;
  distinctAccountsFromIp: number;
}

function fromFixture(id: string, name: string, blurb: string): SamplePreset {
  const f = FIXTURES.find((x) => x.event.id === id);
  if (!f) throw new Error(`fixture ${id} missing`);
  return {
    id,
    name,
    blurb,
    event: f.event,
    knownDeviceIds: f.context.knownDeviceIds.join(', '),
    previousLoginCountry: f.context.previousLogin?.country ?? '',
    previousLoginAt: f.context.previousLogin?.timestamp ?? '',
    distinctAccountsFromIp: 1,
  };
}

/** One-tap presets for the Single Event page — drawn from the fixture set so the demo and the tests can never drift apart. */
export const SAMPLES: SamplePreset[] = [
  fromFixture('evt-001', 'Everyday login', 'Known phone, home country, mid-morning. Expect Allow.'),
  fromFixture('evt-101', 'Credential stuffing', 'Failure burst at 03:00 from an unknown device. Expect Block.'),
  fromFixture('evt-102', 'Impossible travel', 'US login, then Russia one hour later. Expect Flag.'),
];

export function sampleContext(s: SamplePreset): ScoreContext {
  return {
    referenceTime: new Date().toISOString(),
    knownDeviceIds: s.knownDeviceIds
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
    previousLogin:
      s.previousLoginCountry && s.previousLoginAt
        ? { country: s.previousLoginCountry, timestamp: s.previousLoginAt }
        : undefined,
    distinctAccountsFromIp: s.distinctAccountsFromIp,
  };
}
