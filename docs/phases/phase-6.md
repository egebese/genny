# Phase 6: hardening

**Milestone:** M6

The job: it holds up under an audit, on a slow phone, and at 3am when something
breaks.

## Scope

- Accessibility audit: keyboard-only paths, screen reader labels, contrast, focus order
- Performance budget: bundle size, LCP and INP on a throttled phone
- PWA polish: install prompt, offline shell, icons, splash
- Structured logging with redaction, plus OpenTelemetry traces
- Security review against `docs/security.md`, including the SSRF path
- Load test of the generation route
- Self-hosting guide verified by someone who has not seen the repo

## Exit criteria

| # | Criterion |
|---|---|
| 6.1 | Every flow completable by keyboard alone, verified with a screen reader |
| 6.2 | axe reports no serious or critical issues on any route |
| 6.3 | LCP under 2.5s and INP under 200ms on a throttled mid-range phone |
| 6.4 | No secret appears in any log line, proven by a test over captured output |
| 6.5 | A trace covers a whole generation, from submit to ingestion |
| 6.6 | Every item in the security checklist has a test or a documented exception |
| 6.7 | A stranger self-hosts it from the guide without asking a question |

## Out of scope

i18n, native apps, on-prem inference.
