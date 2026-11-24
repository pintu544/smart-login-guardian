# Security & Correctness Review — Smart Login Guardian

**Reviewer:** Automated adversarial review (Claude)
**Date:** 2026-11-24
**Scope:** Full codebase — engine, UI, validation, build, deployment config
**Baseline:** All 21 tests pass. Static types check clean (`strict: true`).

---

## Findings

### 1. Nginx production config missing security headers

| | |
|---|---|
| **Severity** | Medium |
| **File** | `nginx.conf:1-12` |
| **Category** | Security — deployment hardening |

**Problem:** The nginx config serves the SPA but sets no security headers. Missing:
- `X-Frame-Options: DENY` (or CSP `frame-ancestors`) — the app can be embedded in an attacker-controlled `<iframe>` for clickjacking.
- `X-Content-Type-Options: nosniff` — browsers may MIME-sniff responses.
- `Content-Security-Policy` — no policy restricts inline scripts or external resource loads.
- `Referrer-Policy`, `Permissions-Policy` — standard hardening omissions.

**Failure scenario:** An attacker iframes the app and overlays transparent controls. A user interacting with the visible page unknowingly clicks attacker-controlled elements. This is low-impact for a read-only scoring demo but becomes real if the app ever gains session-bearing features.

**Fix:** Add a `location` block or `server`-level directives:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'" always;
```

---

### 2. `attemptsInWindow` validation accepts 0 — semantically impossible

| | |
|---|---|
| **Severity** | Medium |
| **File** | `src/engine/validate.ts:65-71` |
| **Category** | Correctness — input validation |

**Problem:** The `LoginEvent.attemptsInWindow` field is documented as "Total attempts … including this one," so the minimum meaningful value is 1. The validator accepts `0`:

```ts
attemptsInWindow < 0 // rejects negative, allows 0
```

An event claiming 0 attempts (including itself) is a logical contradiction. It won't crash anything — the velocity and bot-pace signals just won't fire — but it means the engine silently scores a nonsensical input as clean instead of rejecting it.

**Failure scenario:** A user (or integration test) submits `attemptsInWindow: 0`. The event passes validation, scores 0 on velocity, and is Allowed. The user sees no error, doesn't realize the input is invalid, and concludes the engine missed an attack pattern.

**Fix:** Change the lower bound to 1:

```ts
attemptsInWindow < 1
```

And update the error message to say "between 1 and 1000."

---

### 3. Timezone-ambiguous timestamps silently accepted

| | |
|---|---|
| **Severity** | Medium |
| **File** | `src/engine/validate.ts:28-31`, `src/engine/geo.ts:62-69`, `src/engine/signals.ts:107-108` |
| **Category** | Correctness — determinism |

**Problem:** The timestamp validator only checks `Number.isNaN(Date.parse(timestamp))`. A string like `"2026-11-15T04:30:00"` (no trailing `Z` or offset) parses successfully but is interpreted as *local time*, which varies by browser/OS timezone. This affects:

- **`localHour()`** — the computed local hour shifts by the host's UTC offset, potentially flipping the unusual-hour signal on or off.
- **`impossibleTravel()`** — the elapsed-hours calculation between two timezone-less timestamps produces different speeds in different timezones.

The fixture set is safe (all timestamps end in `Z`), but user-entered timestamps on the Single Event page have no such guarantee.

**Failure scenario:** A user in UTC+5:30 enters `"2026-11-15T04:30:00"` (intending UTC). The browser parses it as 04:30 IST = 23:00 UTC the previous day. The unusual-hour signal fires (or doesn't) for the wrong local hour. Two users in different timezones score the same form input differently — breaking the "deterministic" promise.

**Fix:** Either:
- Require a timezone designator in validation: `/Z|[+-]\d{2}:\d{2}$/` after the date-time portion.
- Or normalize on input: append `Z` when no offset is present and document that bare timestamps are assumed UTC.

---

### 4. `referenceTime` threaded through scoring but never consumed

| | |
|---|---|
| **Severity** | Low |
| **File** | `src/engine/types.ts:42`, `src/engine/score.ts:18`, all six signal functions in `src/engine/signals.ts` |
| **Category** | Dead code / misleading architecture |

**Problem:** `ScoreContext.referenceTime` is a required field, documented as "ISO 8601 'current time' for this scoring run. Pinned by fixtures." It is passed through `scoreEvent` → `evaluateSignals`, but *none of the six signal functions read it*. Every time-dependent computation uses `event.timestamp` and `context.previousLogin.timestamp` directly.

This contradicts the type-level contract (`types.ts:4-7`: "the engine never reads the system clock; 'Now' is always supplied through ScoreContext.referenceTime") and means the field is pure dead weight.

**Impact:** Misleading for contributors. If a future signal (e.g., "account age relative to now") is added using `event.timestamp` instead of `referenceTime`, the fixture-pinning guarantee silently breaks while the unused `referenceTime` sits there looking authoritative.

**Fix:** Either use `referenceTime` where "now" matters (e.g., derive account-age-at-scoring-time from it, or validate that `event.timestamp ≤ referenceTime`), or remove the field and its documentation until it's needed.

---

### 5. `sampleContext()` uses live clock, breaking determinism on the Single Event page

| | |
|---|---|
| **Severity** | Low |
| **File** | `src/data/samples.ts:40` |
| **Category** | Correctness — determinism contract |

**Problem:** `sampleContext()` sets `referenceTime: new Date().toISOString()`. This is the only place in the codebase that reads the system clock. Because `referenceTime` is currently unused by any signal (Finding 4), this has no effect today. But if the dead field is ever rewired up, every Single Event page score will become non-deterministic — varying by the second.

The Batch Lab correctly uses the pinned `REFERENCE_TIME` constant.

**Fix:** Use `REFERENCE_TIME` (or the event's own timestamp) as a default in `sampleContext`, matching the Batch Lab's behavior.

---

### 6. No length limits on free-text string fields

| | |
|---|---|
| **Severity** | Low |
| **File** | `src/engine/validate.ts:22-57` |
| **Category** | Robustness |

**Problem:** `id`, `accountId`, `deviceId`, and `userAgent` are only checked for non-emptiness (`typeof x === 'string' && x.trim() !== ''`). There is no upper bound. A user (or fuzzer) can submit a 10 MB `userAgent` string. The engine will:

1. Run every `BOT_UA_PATTERNS` regex against it (11 patterns, all simple — no ReDoS, but still 11 × 10 MB of matching).
2. Embed it verbatim in explanation strings ("The user agent identifies as …").
3. Store it in the React state tree and render it in the DOM.

**Failure scenario:** Paste a very large JSON payload with a multi-megabyte `userAgent`. The page freezes or becomes unresponsive as React re-renders a massive explanation string. This is a client-side DoS during a live demo.

**Fix:** Add a reasonable `maxLength` check (e.g., 2048 characters for `userAgent`, 256 for IDs) in `validateEvent`.

---

## What was checked and found clean

| Area | Notes |
|---|---|
| **XSS** | All user-controlled data flows through React JSX interpolation (auto-escaped). No `dangerouslySetInnerHTML`. Inline `style` attributes use clamped numeric values, never user strings |
| **Prototype pollution** | `validateEvent` gates on `isRecord()` (rejects arrays and nulls) before property access. No `Object.assign` from untrusted input. |
| **ReDoS** | All 11 `BOT_UA_PATTERNS` are simple fixed-string or `\b`-bounded patterns with no nested quantifiers. `IPV4_RE` and `COUNTRY_RE` are also non-vulnerable. |
| **Secrets in code** | No API keys, tokens, passwords, or `.env` files. IPs use RFC 5737 documentation ranges (192.0.2.x, 198.51.100.x, 203.0.113.x). |
| **Injection (SQL, command, template)** | No backend, no database, no server-side template engine. All logic is client-side pure functions. |
| **Error message leakage** | Validation error messages are static strings; they never interpolate the user's actual input values. |
| **Haversine implementation** | `distanceKm()` correctly implements the standard formula with `R = 6371` km. Null returns for unknown countries are handled gracefully by callers. |
| **Score clamping** | `Math.min(100, Math.max(0, raw))` in `scoreEvent` correctly bounds the output. Test covers the >100 case. |
| **Decision thresholds** | `decide()` boundary conditions (39=Allow, 40=Flag, 69=Flag, 70=Block) are explicitly tested. |
| **Batch accuracy computation** | Division-by-zero guarded (`total === 0 ? 0 : …`). Confusion matrix logic is correct (verified against fixture counts: 10 TP, 8 TN, 0 FP, 0 FN). |
| **Empty/hostile validation input** | `validateEvent(null)`, `validateEvent(undefined)`, `validateEvent([1,2,3])`, `validateEvent({timestamp:{nested:true}})` all tested — no throws. |
| **Dockerfile** | Multi-stage build, no secrets, no env vars baked in. `npm ci` from lockfile for reproducibility. Static output served by nginx. |
| **TypeScript strictness** | `"strict": true` in tsconfig. Single `!` assertion on `document.getElementById('root')` is standard React boilerplate against a known HTML template. |
| **React state management** | No global mutable state. All scoring is derived from local component state by pure functions. No race conditions. |
| **Fixture data integrity** | All 18 fixture events pass `validateEvent`. All IDs are unique. Expected decisions match actual decisions (100% decision accuracy asserted in tests). |
| **Dead routes / unreachable code** | All three pages (`single`, `batch`, `how`) are reachable via the tab nav. No unused exports or orphaned files. |

---

## Summary

The codebase is well-structured and defensively written for a client-side prototype. The engine logic is correct, deterministic (within the fixture set), and thoroughly tested. No critical or high-severity issues were found.

The six findings above are all medium or low severity: nginx hardening gaps for production deployment, two input-validation edge cases that could confuse users or break determinism, and two architectural loose ends (dead `referenceTime` field and its clock-reading counterpart in `sampleContext`). None would cause data loss or security compromise in the app's current form as a read-only scoring demonstrator.
