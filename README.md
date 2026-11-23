# QSwipe

Attendance, commitments, team hierarchy and QR team onboarding: a local-first web app written in strict TypeScript.

> **Scope.** This repository is an independent app and is **not** the source of the privately hosted QSwipe site. Merging here does not deploy or change that site. Data lives only in the browser that created it: there is no server, account system or shared database.

## Features

| Area | What it does |
| --- | --- |
| **Workspaces** | Create one or more workspaces from a terminology template (business, school, government, custom). Every label, title, shift and session day is editable. Nothing is pre-filled: no sample people, records or questions. |
| **Hierarchy & access** | Four levels (e.g. Member → Team Leader → Manager → Director). People act only inside their own branch. A per-workspace access matrix sets the minimum level for each feature; the owner can do everything and can **preview the app as anyone**. |
| **QR onboarding** | **Join my team**: a leader shows an invite QR (expiry and use limits). **Join the team**: a new member scans it with the camera, enters their name, and shows a confirmation QR back. The leader scans it to add them. No server is involved. |
| **Check-in passes** | Members who joined by QR get a daily pass QR, signed with HMAC-SHA256 using a key exchanged only during the join handshake. Leaders scan passes back-to-back to mark people present. |
| **Attendance** | Swipe deck with drag physics, velocity flings, keyboard (←/→/S/Z), undo window, per-branch queue, self check-in, roster search/filters and reason-required corrections with an audit log. Unmarked is never counted as absent. |
| **Commitments** | Members confirm availability for upcoming sessions (with optional notes). Leaders see a conservative projection: confirmed replies only, against a coverage target, per branch. |
| **Reports** | Attendance rate with trend vs. previous period, completion, absences, perfect attendance, a daily stacked chart with tooltips, per-branch rates, audit log, sortable register and CSV export (formula-injection safe). |
| **Updates** | Announcements scoped to a branch or the whole workspace, importance flag, acknowledgements with read counts. |
| **Play** | Crypto-fair wheel, duck race, pick-a-card, and trivia from the team's own question bank plus generated math. |
| **Settings** | Theme (system/light/dark), accent, compact/comfortable density, text size, motion, undo window, swipe sensitivity, haptics, sounds, workspace schedule and labels, access matrix, JSON backup export/import, clear/delete. |

Also: command palette (`Ctrl/⌘ K`), keyboard shortcuts (`?`), responsive layout from 320 px with an icon rail and mobile tab bar, view transitions, and reduced-motion support.

## Develop

Requires Node.js 22.12+.

```bash
npm ci
npm run dev        # http://localhost:4173
npm run check      # typecheck + unit tests + production build
npm run preview    # serve the production build (CSP enforced)
```

Camera scanning needs a secure context (`https://` or `localhost`). Without a camera you can scan a photo of a code or paste the link.

## Project layout

```
src/core/      pure domain logic: model (hierarchy, policy, attendance, reports), codes (QR payloads), games, data (validation)
src/state/     store: persisted AppData, session state, permission-checked mutations
src/qr/        QR rendering, camera scanner (BarcodeDetector, lazy jsQR fallback), join/check-in flows
src/views/     one module per page; src/shell.ts holds navigation, menus and the command palette
src/boot.ts    pre-paint theme script, inlined at build with a CSP hash (see vite.config.ts)
tests/         Vitest unit tests for everything in src/core
```

Runtime dependencies: [`uqr`](https://github.com/unjs/uqr) (QR encoding, MIT) and [`jsqr`](https://github.com/cozmo/jsQR) (QR decoding fallback, Apache-2.0, loaded only when the browser lacks `BarcodeDetector`).

## Before real-world use

QSwipe stores personal data (names, attendance) in browser storage, and its QR handshake has no central authority. Read [docs/RELEASE_GATES.md](docs/RELEASE_GATES.md) before using it for real people.
