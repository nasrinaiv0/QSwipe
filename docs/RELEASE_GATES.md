# QSwipe release gates

**Status: prototype / no production approval.** This repository is separate from the privately deployed QSwipe app. A successful merge means only that GitHub `main` contains the reviewed demo code.

## Security and data governance
- Authenticate users and enforce workspace membership and **server-side** manager/team scopes, with denial-by-default authorization.
- Store attendance with atomic status/version checks and idempotency keys. Capture actor, subject, source, event time, effective session time, reversal and reason. No silent manager overwrites.
- Keep pending, approved leave and absence distinct. Have explicit shift boundaries and local service dates for overnight shifts.
- Encrypt sensitive records in transit and at rest; configure retention, data subject requests, consent for profiling, backup recovery, export controls, and privacy disclosures based on jurisdiction.
- Avoid storing personal profiles, minors' records, or attendance histories in localStorage; the current demo uses fictional people only.
- Add rate limits, input validation, logs with PII redaction, CSP enforcement, dependency scanning and incident response.

## Testing and compliance
- Validate on physical iOS Safari and Android Chrome, keyboard-only and screen reader; honor reduced-motion settings and 320px layouts.
- Test concurrent member and manager attendance submissions, offline retry, stale head/update conflicts, denied cross-workspace access, and daylight-saving/overnight boundaries.
- Validate reporting denominator rules with HR and the organization; do not treat missing check-ins as finalized absences.
- Review Philippine Data Privacy Act, applicable labor rules, education records, and other local requirements with qualified counsel. App Store / Google Play disclosures apply only if native clients are prepared.
- Confirm backend and deployment source parity before wiring GitHub main to any existing production site.

## PR acceptance
- `npm run check` passes at the exact branch head.
- No GitHub Actions failures or unresolved security review flags.
- Browser smoke runs at desktop and mobile widths, including wheel, duck race, flip card, swipe, report and export.
- Reviewer signs off on backend gaps as **not ready** rather than implying production acceptance.
