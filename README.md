# Smart Login Guardian

**Aegython (AeglysAI) — Track 1: Smart Login Guardian**

An explainable login-risk scoring prototype. Paste or pick a synthetic login event and get a
decision — **Allow**, **Flag** or **Block** — with a numeric risk score and a plain-language
explanation for every signal that contributed. No black box, no real data, fully client-side.

**Live demo:** https://smart-login-guardian.vercel.app

![stack](https://img.shields.io/badge/stack-Vite%20%2B%20React%20%2B%20TypeScript%20%2B%20Tailwind-blue)
![data](https://img.shields.io/badge/data-synthetic%20only-green)

## What it does

- **Single Event page** — score one login event from a form or pasted JSON. Invalid input is
  rejected with field-level errors and nothing is scored. One-tap samples (everyday login,
  credential stuffing, impossible travel) are drawn from the fixture set itself.
- **Batch Lab** — runs the labelled synthetic fixture set (18 events, fixed reference time,
  stable ids) and reports decision accuracy, detection accuracy, false positives and false
  negatives, with a per-event explanation for every fixture.
- **How It Works** — the six signals, their weights, the thresholds, and an honest list of
  limitations.

## The intelligent technique

A **deterministic weighted-signal engine** — six independent rules, each of which either fires
(adding its weight to the score) or explains why it did not:

| Signal | Weight | Fires when |
| --- | ---: | --- |
| Failed-attempt velocity | +25 | A failed attempt with ≥ 5 attempts in the trailing 10-minute window |
| Impossible travel | +40 | Previous login → this attempt implies travel faster than 900 km/h between country centroids |
| New device | +15 | Device never seen on an account at least 7 days old |
| Unusual hour | +10 | Attempt lands 00:00–05:00 local time in the attempt's country |
| Bot-like client or pace | +20 | Scripted user agent (python-requests, curl, HeadlessChrome, …) or ≥ 8 attempts in the window |
| Password-spray pattern | +25 | One IP attempts ≥ 4 distinct accounts in the scored batch and this attempt failed |

Score = sum of fired weights, clamped to 0–100. **Allow < 40 · Flag 40–69 · Block ≥ 70.**

A learned classifier was considered and rejected as the primary scorer: trained on synthetic
data it would emit a number nobody can interrogate. Instead, the weights were **calibrated
against the labelled fixture set** — the learning lives in that calibration loop, and every point
of every score can be traced to a named rule and a sentence a human can argue with. Calibration
rules: no single soft signal (device, hour) can Flag on its own; impossible travel always at
least Flags; realistic attack combinations cross Block.

Two patterns are invisible inside a single event — spraying (one IP, many accounts) and device
history — so the engine takes them as explicit **context** inputs rather than pretending. In the
Batch Lab the context is computed from the fixture set; on the Single Event page you supply it.

## Test evidence

Automated suite (Vitest), covering validation, each signal firing and not firing, both decision
threshold boundaries, score clamping, determinism, and the full fixture batch:

```
$ npm test
 ✓ src/engine/engine.test.ts (21 tests)
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

Batch results on the shipped fixture set (v1.0.0, reference time `2026-11-15T12:00:00.000Z`),
produced by the same engine entry point the UI uses:

| Metric | Result |
| --- | ---: |
| Exact decision accuracy (Allow/Flag/Block vs calibrated label) | 18/18 — 100% |
| Detection accuracy (attack = Flag or Block) | 18/18 — 100% |
| True positives / true negatives | 10 / 8 |
| False positives | 0 |
| False negatives | 0 |

> **These are synthetic fixture results.** They show the engine behaves as designed on known,
> invented patterns. They are **not** real-world detection accuracy and must never be quoted
> as such.

## Setup

```bash
npm install     # install dependencies
npm run dev     # dev server on http://localhost:5173
npm test        # run the engine test suite
npm run build   # type-check + production build into dist/
```

No environment variables, no secrets, no backend — scoring runs entirely in the browser in
well under 50 ms per event.

## Project layout

```
src/engine/    pure TypeScript scoring engine (types, validation, signals, scoring, batch)
src/data/      labelled synthetic fixtures + Single Event samples
src/pages/     Single Event · Batch Lab · How It Works
src/components decision card with the signal-by-signal explanation
```

## Synthetic data statement

Every account id, device id, timestamp and IP in this repository is invented. IP addresses use
the RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), reserved for
examples and never routable. No real credentials, real IPs or personal data appear anywhere.

## Known limitations

- **Coarse geography** — travel speed uses country centroids and standard-time offsets; no IP
  geolocation, no daylight-saving handling. Countries outside the built-in table cannot fire
  the travel or hour signals (the explanation says so).
- **Context is only as honest as its source** — device history, previous-login data and
  per-IP account counts come from the caller; a real deployment would compute them from login
  history.
- **Published rules are gameable** — an attacker who knows the thresholds can stay under them;
  that is the honest price of full explainability.
- **No real authentication** — nothing here logs anyone in or stores events. It is a scoring
  demonstrator.

## Attribution

Built by Pintu Kumar for Aegython, organised by AeglysAI (Track 1 challenge: Smart Login
Guardian). Stack: Vite, React, TypeScript, Tailwind CSS, Vitest. Country centroid coordinates
are approximate capital-city locations compiled from public geographic references. UI built
following the Impeccable design skill.
