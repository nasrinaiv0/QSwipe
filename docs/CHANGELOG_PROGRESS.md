# Changelog

## 0.7.0: Color Rush, mascot and layout polish

- **Color Rush** (Play → Rush): an original colour-matching card game for you and 1–3 computer players, named from the Participants list. Match the colour or symbol, use Skip, Flip (reverse), +2 and wilds, and tap *Last card!* before someone catches you (you can catch them too). Cards deal in, fly from hand or seat to the pile, the pile you can draw from bobs when you have no match, the direction arrow turns, and the winner gets confetti. Each colour also has its own shape (circle, triangle, square, diamond), so it never relies on colour alone. The rules live in a pure, unit-tested module (`src/core/rush.ts`); 60 simulated computer-only games always finish without losing a card. The old *Cards* tab is now *Pick*.
- **Mascot.** “Q”, an original duck in the accent-coloured scarf, appears in empty states, locked panels, onboarding, the *All caught up* card and game results, with moods (waving, happy, thinking, sleeping, cheering, oops) and gentle blink, wave and hop animations that stop under reduced motion.
- **No overlaps.** An automated check of every page and dialog at 320, 390 and 1366px now finds no overlapping elements, no off-centre text in buttons and chips, and nothing hidden behind the floating tab bar. To get there:
  - Cards waiting behind the top attendance card are blank, and that card's tags moved below the name.
  - Org-chart expand/collapse buttons sit below their card instead of on its edge.
  - Dialogs use one horizontal inset for header, body and footer.
- **Consistent type.** Inter is bundled (SF Pro is still used on Apple devices), so text metrics and centring match on Windows, Android and Linux.
- **More direct.** The Today tiles are tappable: Team opens the people list; Present, Absent and Unmarked open Attendance already filtered.

## 0.6.0: iOS 27-style design

- **Liquid Glass on the navigation layer only.** The sidebar, top bar, tab bar, sheets, toasts, tooltips and floating controls use a glass material: tinted body, darkened rim, bright specular edge and soft shadow, as in iOS 27's refined Liquid Glass. Content stays on solid grouped surfaces so text remains easy to read. Only layers that content scrolls under use a live blur.
- **Glass setting.** Settings → Appearance → Glass offers Clear, Regular and Tinted, mirroring iOS 27's intensity control. *Reduce transparency* and *Increase contrast* system settings make glass opaque automatically.
- **Navigation.** Floating capsule tab bar on phones with a lens-style selected tab and a soft scroll-edge fade. The top bar is clear at rest; once content scrolls under it, it becomes a uniform glass bar showing the page title. The desktop sidebar floats as a rounded glass panel with accent-tinted icons.
- **Large titles and system type.** Pages open with iOS-style large titles. The font stack prefers SF Pro (with SF Pro Rounded for numbers) and falls back to the platform UI font.
- **Controls.** Capsule buttons (filled, tinted, gray, plain) with a quick press and spring release; capsule segmented controls with a raised thumb; iOS switches whose knob stretches while pressed; filled text fields and capsule search fields; circular avatars; red notification badges.
- **Lists and surfaces.** iOS grouped palette (light `#f2f2f7`, dark true black with `#1c1c1e` cards), borderless rounded cards, separators inset to the text, settings sections with coloured glyph tiles, sheets that float inset from the screen edges with large corners.
- **Interactions.** Segmented controls and the tab bar slide their selection to the new choice with a spring. On phones, sheets follow your finger when dragged by the grabber or header: pull down far or fast to close, otherwise they spring back. Keyboard-shortcut hints are hidden on touch screens.
- **Colour.** Accents use iOS system hues, darkened where needed so white text keeps at least 4.5:1 contrast. Dark mode uses the bright iOS green, teal and orange with dark text. Chart colours keep their colour-vision-safe values.

## 0.5.0: Minimalist UI and mobile fixes

- **One size scale.** Buttons, inputs, tabs and chips share three heights (30/36/44px; 34/40/46px on touch screens) with consistent padding and radius. Buttons no longer glow; cards are flat with hairline borders; backgrounds are plain.
- **Less text.** Page headers are a title plus one short line; section titles drop their icons and captions; long hints and explanations are shortened or removed. Today is a greeting, a check-in card, four numbers, compact availability buttons, updates and a small attendance chart.
- **Mobile fixes.** Full-width bottom sheets (wide dialogs left a 32px gap); close buttons no longer get squeezed; header actions stay on one row (secondary actions become icons); tab bars and filter chips no longer get cut off or wrap; roster/reply rows show compact status icons; report charts keep readable text and the register drops optional columns; the race shows full names (tap a name to cheer) and puts the game above the participant list; inputs use 16px text to stop iOS zoom; keyboard hints hide on touch; links in sheets are no longer underlined; settings sections use a 3-column grid.
- **Fixes.** Org-chart expand/collapse toggles sit under their own card. The app no longer writes unchanged state to storage when the page is hidden, which could overwrite newer data saved by another tab.

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

**Merge note.** This release replaces the JavaScript demo that PR #3 (profile & tiered manager access) extended. Its access model is superseded by the hierarchy, access matrix and *Preview as* above. One PR #3 workflow is not yet ported: member-submitted leave/correction **requests with a manager approval inbox** (corrections here are made directly by authorised managers, with a reason). The PR #4 staging backend (`api/staging`, `lib/staging`, `public/staging`, Supabase migration) is kept unchanged and its tests still run.

## Earlier history: JavaScript demo (0.1 – 0.2)

1. Inspected `nasrinaiv0/QSwipe`: only a README on `main`; no application source was present.
2. Scoped this PR to an **independent** source-controlled demo, not an import of the existing privately hosted deployment.
3. Implemented a zero-dependency HTML/CSS/ESM project and retained the user-supplied QSwipe cube logo as a local SVG-embedded optimized raster.
4. Added responsive multi-industry workspaces, role/roster navigation, swipe attendance, conservative commitment coverage, manager reports, sample announcements, and team games.
5. Security review: all user free text escaped before HTML insertion; no third-party runtime requests; no secrets; local sample-only status explicitly marked. Real backend authorization is a release gate, not represented as complete.
6. Automated unit tests and sandbox browser checks are recorded in the PR description after execution. No production deployment or database changes are made by this PR.

## Profile & manager access update — 2026-11-23

1. Inspected the QSwipe GitHub source and confirmed it is a **local demo**, not the separate private hosted application's backend.
2. Introduced a sample identity policy for member, Level 1, Level 2 and Level 3 managers, with team-limited scopes for Level 1 across all four sectors.
3. Added Profile editing, cross-screen avatar/name preview, local attendance correction and leave requests; JPG/PNG/WebP avatar preview uses a revocable in-tab object URL.
4. Added manager dashboard, scope filters, approval/decline action, shift metrics, team reassignment, Level 2+ exports and audit, and Level 3-only coverage target setting.
5. Rechecked destructive actions: corrected attendance uses an explicit request; approved leave is excluded from the swipe queue without being counted as absent. All manager writes re-check the illustrative authorization policy.
6. Ran `npm run check`: 16 automated tests passed, including a DOM-less render smoke test and multi-industry team access policy.
7. Physical browser navigation was blocked with ERR_BLOCKED_BY_ADMINISTRATOR in the isolated test sandbox; **visual verification, real-device swipe and deployment preview remain unverified**. Do not mark ready for production or merge without completing the release gates.
8. Changes are prepared on an isolated feature branch; no production database, private site or legal settings were changed.

## 2026-11-23 — PR #3 exact-head review remediation
- Exact head `38497e761f6b6c98dcc4097288fafd16aa7b0198` passed GitHub Actions and 16/16 domain/UI smoke tests. Vercel preview `dpl_76QaEAWh6YMbm1gc8XwqndFeGKi6` was READY and source-matched.
- Reproduced a functional inconsistency: Level 2 selected Nova in Manager but the attendance swipe queue still displayed Orion. Fixed by applying the manager's existing authorized team filter consistently to the queue and the write target.
- Prevented Undo across attendance dates and ignored Skip for a member's self-check-in. Added the manager-filter regression to the DOM-less UI test.
- Browser navigation to protected Vercel preview remains unavailable in isolated Chromium; inline test harness rendered the exact source at 320/390/1280px and verified Profile, manager controls, and no page overflow, but does NOT establish hosted preview acceptance.
- Vercel Sandbox creation returned `402 payment_required`; Vercel CLI fallback not installed in runtime.
- **Release gate remains open:** authenticated backend/RBAC is absent (demo roles only), browser preview acceptance and physical iOS/Android tests remain unverified. Do not merge until required acceptance gates pass.
- Follow-up QA: after the final unresolved team member was marked, the empty queue previously hid Undo. The completed-queue state now preserves the short-lived Undo action for that date.
