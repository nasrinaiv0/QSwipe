# Changelog

## 0.4.0: Duck race water and outfits

- **Water.** The race now runs on a canvas pond: layered flowing ripples, a drifting light sheen, twinkling glints, V-shaped wakes, expanding rings, start and finish splashes, red/white lane-rope floats and a checkered finish band. Light and dark themes. Static layers are cached, and quality adapts automatically on slow devices.
- **Ducks and costumes.** Original SVG ducks in 10 colours with 11 hats, 6 eyewear and 5 neckwear options (plus none). Tap a duck on the dock to dress it up, use *Save & next* to work through the line-up, or *Surprise outfits*. Looks are saved per participant name in the workspace (validated on load and import, capped at 200). Unsaved racers get distinct default colours.
- **Race flow.** 3-2-1-GO countdown, ducks bob and lean into their speed, live positions, a podium with each winner's duck, and a ★ “cheer for” pick that reports where your duck finished. Reduced motion skips straight to the result.

## 0.3.0: TypeScript rebuild, hierarchy access, settings, QR onboarding

**Breaking.** Storage moved to `qswipe-v3`; data from the 0.1 demo is not migrated (it was sample data). The `public/*.js` demo and `server.mjs` are removed in favour of Vite.

- **Rewritten in strict TypeScript** (Vite 8, Vitest), with no UI framework. Pure domain modules in `src/core` are fully unit-tested. Views use event delegation and partial DOM updates instead of re-rendering the page on every keystroke.
- **No hard-coded data.** Removed the fictional people, portraits, seeded history, sample announcements, sample game entries and the built-in trivia bank. Workspaces start with only their owner; terminology templates are editable defaults.
- **Hierarchy access.** Four-level org tree with placement validation (levels decrease downward, no cycles), branch-scoped actions, a per-workspace access matrix, owner-only policy editing and *Preview as* for owners.
- **Team page.** Org chart (outline on mobile), person detail with reporting chain and attendance, people table, add/edit/move/remove with photo upload (downscaled), invites management.
- **QR features.** *Join my team* invite QR (expiry, max uses, revoke), *Join the team* camera scanner (native `BarcodeDetector` with lazy-loaded jsQR fallback, photo upload, paste), join confirmation handshake, HMAC-signed daily check-in passes, continuous scanning for queues, and `#/qr/<code>` deep links so phone-camera scans open the app.
- **Settings.** Appearance (theme, accent, density, text size, motion), attendance feedback, workspace schedule/labels/titles/target, access matrix, data export/import/clear/delete, shortcuts.
- **UI.** Compact professional design system with light/dark themes, icon rail and mobile tab bar, command palette, view transitions, count-up metrics, accessible chart colours validated for colour-vision deficiency, toasts with undo, dialogs as bottom sheets on mobile.
- **Security.** Production CSP via meta tag with a hash for the single inlined pre-paint script; all user text escaped; strict validation for storage, backups and QR payloads; CSV formula neutralisation.
