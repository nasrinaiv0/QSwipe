# QSwipe release gates

**Status: local-first app, no production approval.** This repository is separate from the privately deployed QSwipe site. A merge means only that `main` contains reviewed code.

## What the current build does and does not guarantee

- **Storage.** All data is kept in one browser's `localStorage`. Clearing site data deletes it. Users should export backups (Settings → Data). Backups contain personal data.
- **Access control is client-side.** The hierarchy and access matrix decide what the UI allows on one device. Anyone with access to that browser profile can edit storage directly. This is not a substitute for server-side authorization.
- **QR handshake trust model.**
  - Invite codes carry the workspace terms, the inviting branch and a random 128-bit token. Anyone who sees an invite QR can use it until it expires, is revoked or runs out of uses. Treat invites like a door key and keep expiry short.
  - Join confirmations echo the invite token, so a leader only accepts confirmations for invites created on their own device.
  - Check-in passes are signed with HMAC-SHA256 using a per-member key exchanged during the in-person join handshake. A pass is valid for one date only, and a second scan is rejected because the record is already resolved. A screenshot of today's pass can still be shown by someone else on the same day; in-person verification remains the control.
  - Codes have a checksum and strict schema validation. They are not encrypted: they contain names and workspace labels.
- **Multi-device.** A member's device holds only a partial copy of the workspace (themselves and their leader). There is no sync; the leader's device is the record of truth for the roster and attendance.

## Required before production

- Server-side authentication, workspace membership and branch-scoped authorization with deny-by-default.
- Durable storage with atomic status/version checks, idempotency keys, an append-only audit trail (actor, subject, source, event time, reason) and backups.
- Invite and pass verification on the server (signed, revocable, rate-limited), plus device binding or liveness checks if passes replace in-person verification.
- Privacy: data-protection review for the target jurisdiction (e.g. Philippine Data Privacy Act), retention policy, data subject requests, consent for photos, minors' records handling.
- Testing on physical iOS Safari and Android Chrome (camera permissions, `BarcodeDetector` and the jsQR fallback), keyboard-only and screen reader passes, overnight shifts and daylight-saving boundaries.

## PR acceptance

- `npm run check` (typecheck, unit tests including the staging `node --test` suite, production build) passes at the exact branch head.
- No GitHub Actions failures or unresolved security review flags.
- Browser smoke at desktop and mobile widths: create workspace, invite → join → confirm, check-in pass, swipe deck, reports, settings, wheel, duck race, flip card and trivia.
- Reviewer signs off on the client-only limitations and backend gaps above as **not ready** rather than implying production acceptance.

## Manager/profile feature acceptance
- Confirm employee/manager access using authenticated identities on a backend, not *Preview as* or demo role selection.
- Verify scoped branches across Business, School, Government and Custom workspaces.
- Verify that simultaneous manager/employee attendance updates cannot race or overwrite each other.
- Confirm leave and correction approvals create immutable audit events and notify the subject.
- Ensure that uploaded profile images have access rules, retention limits, virus/type checks and deletion options.
- Test RTL/long names, tab/screen-reader navigation and all supported mobile sizes.
