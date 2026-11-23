# QSwipe

Attendance, commitments, manager verification, and playful team engagement in one responsive interface.

## Scope of this repository

**This repository is an independent browser demo, not the source of the existing private QSwipe site.** The hosted site was created through a separate builder; its source and database have not been synchronized into this GitHub repository. Merging code here **does not deploy or change that hosted site**.

The demo ships: four industry templates, portrait attendance swipe cards (left absent / right present), manager unresolved-roster queue, Skip/Undo, future-shift commitments, staffing projection, team hierarchy, announcements, attendance reports and CSV, plus Spin the Wheel, Duck Race, logo-backed Pick a Card, and Trivia. Everything is local to one browser session/storage. **Do not enter real employee or student data.** No real login, backend authorization, shared attendance, or protected data storage is implemented in this demo.

## Run locally

```bash
npm run check
npm run dev
# open http://localhost:4173
```

Requires Node.js 20+. No dependencies, secrets, external requests, or paid services. Uses the supplied QSwipe logo and fictional portraits. The web app is responsive to 320px mobile width and respects reduced motion.

## Before any real-world deployment

Follow [docs/RELEASE_GATES.md](docs/RELEASE_GATES.md). A production build requires server-validated access controls, an audit trail, secure storage, privacy notices, attendance policy, local legal review, accessibility and real-device acceptance. Do not use localStorage as a source of truth for real attendance.
