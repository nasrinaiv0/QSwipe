# QSwipe — complete Codex handover

**Release HOLD. Local artifacts only.** This package makes the Markdown and source files visible to Codex after extraction; it does not synchronize them to GitHub. It consolidates the entire available Phase 2.0–3.4 local implementation series, original PR evidence and the security-review packages. Phase 3.4 remains a partial original-source acceptance candidate.

## Open in Codex
1. Download and extract the archive into a new local directory (not on top of QSwipe or a Git worktree). Open the extracted `QSwipe_Codex_Handover` folder as the Codex workspace, so root `AGENTS.md` is discoverable. For a Codex cloud task, attach the archive or place extracted files in an authorized accessible workspace; a local path on another device will not be visible to that cloud task.
2. Run `python tools/verify_handover.py` (standard library only). Read the documents in the order given by `AGENTS.md`.
3. Give Codex this exact instruction: **Read AGENTS.md and all linked docs. Continue the remaining QSwipe implementation in an isolated local workspace from candidate/. Recover and verify the exact original source before full integration. Make the frontend award-quality, compact, responsive, accessible and motion-polished. Preserve the frozen reference, existing business rules and production HOLD. Do not commit, push, deploy, provision, merge, migrate remotely or activate hosting. Document every change and verify actual results.**
4. Recover the exact original merge archive through existing authorized GitHub access if available: https://github.com/nasrinaiv0/QSwipe/archive/02bfb8d1bed633671939bbd0f769338c946f650d.zip . Do not mistake `candidate/` for a full original repository. Follow `candidate/docs/PHASE34_SOURCE_CONSOLIDATION.md`; see acceptance and remaining tasks.

## Contents
| Location | Contents |
|---|---|
| `AGENTS.md` | Mandatory coding-agent instructions and scope |
| `docs/` | Current status, master roadmap, full phase history, remaining tasks, UI/UX/motion brief, acceptance and review |
| `candidate/` | Exact extracted Phase 3.4 local candidate, all source/tests/SQL/docs/evidence (527 original files) |
| `history/packages/` | Byte-preserved original ZIPs for all 14 implementation milestones and four security/CI packages (full edition only) |
| `history/phase-readmes/` | Historical README for each archive; no need to open all old ZIPs |
| `evidence/` | Read-only GitHub evidence, package verification, original PR #26 visual evidence (81 PNGs, 7 contact sheets in ZIP; full edition) |
| `tools/verify_handover.py` | Offline package integrity verifier; no side effects |
| `SHA256SUMS.txt` | Top-level manifest, separate from candidate's original manifest |

Core edition omits prior milestone ZIPs except the latest Phase 3.4 archive and latest security-CI review package; original visual evidence ZIP is omitted, contact sheets retained. Complete edition preserves every available milestone ZIP. Both contain the entire extracted latest candidate and all core docs. The candidate and original PR evidence were not re-executed during this handover. File checksums and five engine Git blobs were reverified; live status was checked read-only. Do not sum cumulative historical test totals across phases.

See `docs/CURRENT_STATUS.md` for the material PR merge-state change and missing source. All hosted, database, provider and physical-device release gates remain on HOLD.


---

# QSwipe — mandatory Codex contributor instructions

## Start here
Read `README.md`, `docs/CURRENT_STATUS.md`, `docs/MASTER_ROADMAP.md`, `docs/REMAINING_TASKS.md`, `docs/IMPLEMENTATION_HISTORY.md`, `docs/UI_UX_MOTION_BRIEF.md`, `docs/ACCEPTANCE_GATES.md` and `docs/INDEPENDENT_REVIEW.md` before changing code. The prior detailed agent brief is `docs/QSwipe_CODEX_MASTER_HANDOFF.md`. Root documents supersede historical status claims, but do not supersede original business rules or broaden authorization. The complete latest isolated candidate is already extracted at `candidate/`; its exact upstream archive and prior milestone archives are in `history/packages/`. Do not extract older phases over it. Verify with `python tools/verify_handover.py` from this directory. Work in a separate disposable copy; preserve the archives unchanged.

## Mission and boundaries
QSwipe is an attendance, team-tracking, games and gamification app. Build a playful, premium, compact, accessible product. No enterprise HR/payroll expansion. Preserve the canonical scoring, roster eligibility, attendance, rewards, identity and authorization semantics. Do not create duplicate engines, navigation, stores or transports. Retire historical paths only after demonstrated behavioral equivalence and review.

Original frozen baseline `093d127f7037b9bd2403d0e813814df727529528`; observed PR #26 merged head `abf6337c5edc56da6a586ba57a7a696f8161e7f1`, merge/main `02bfb8d1bed633671939bbd0f769338c946f650d`. The freeze is an instruction to preserve the reference, not a claim that PR is still open. Do not revert or reset. No remote modifications, commits, pushes, pull requests, merges, deployments, provisioning, remote SQL/migrations, flags or production activation without separate explicit user authorization. No credentials, real data or billable resources. No administrator-policy bypass. Do not execute historical workflows or SQL as a side effect of unpacking. Keep fictional demo and production routes separate. Use only already-approved isolated execution resources and exact reviewed dependencies. Report blockers rather than substituting unapproved versions or inventing results.

## Implementation order
1. Verify package and recover the complete exact merged source. Compare all 120 Git blobs using `candidate/source-intake/verify-source.py`; current recovered source is only 17/120. A successful partial compile is not a full build.
2. Establish original locked baseline build and tests, separate from the candidate. Capture original behavior and screenshots before edits.
3. Reconcile original frontend and candidate by capability; preserve original storage and explicitly review any migration. Keep the canonical engine and existing authorization gates. Integrate original game shell and local/live navigation before retiring preview components.
4. Deliver UI/UX/motion improvements from the brief, with actual interaction evidence, not only static mockups. Keep one set of tokens, controls and responsive components. Avoid cosmetic changes that alter game timing or scores.
5. Run regressions, real browser and device acceptance where authorized, actual PostgreSQL acceptance when available, security/retention and recovery gates, then independent review. Production HOLD until separately approved.

## Mandatory progress protocol
Before any edit, append contributor/model, date, objective, baseline SHA, intended files, risk, test plan, and restrictions to a working implementation log. After edits append exact diff scope, test commands and exit results, screenshots/traces, dependency/license review, unresolved items and rollback procedure. For future authorized commits, document BEFORE every commit, verify exact-head CI and inspect actual artifacts, then record pass/fail/draft/merged status accurately. This handover authorizes no commits. No status inflation, no claiming a reviewer acted unless actually reviewed. Distinguish historical tests, actual executed tests, mock/contract tests, static renders, and blocked tests.

## Final deliverables from Codex
Local diff + complete changed source; updated Markdown documents; reproducible tests and commands; actual screenshots/contact sheets at 320/390/768/1280 CSS px and light/dark; physical iOS/Android and accessibility evidence where possible; measured motion/performance traces; dependency and security findings; known limitations; rollback plan; separate Claude review request (or evidence of actual review if independently authorized). Include recommendations with tradeoffs. Never claim award wins or release readiness from local tests alone.


---

# Current status — supersedes stale PR states in historical packages

**Decision: RELEASE HOLD.** No mutation during preparation. This is a handoff, not a new implementation run, not a complete repository checkout, and not a reviewer sign-off.

## GitHub read-only observation
Repository `nasrinaiv0/QSwipe`. Original preserved reference `093d127f7037b9bd2403d0e813814df727529528` (historical run [45698091623](https://github.com/nasrinaiv0/QSwipe/actions/runs/45698091623), success). Current PR #26 is closed/merged at head `abf6337c5edc56da6a586ba57a7a696f8161e7f1` (historical run [45729798809](https://github.com/nasrinaiv0/QSwipe/actions/runs/45729798809), success), merge `02bfb8d1bed633671939bbd0f769338c946f650d`, merged 2026-11-26 00:56:36 UTC. Current main matches merge. PR #24 remains open draft at `cded8a252bbd27b9e8b8a24704c0ec5c179729b8`. PR #25 is closed/merged at advanced head `77f99ea5bdd8229bf728d83876256eaaaf8784c5`, merge `4b466df8051c04357ec6b58dc048ad41da6db610`. See `../evidence/github-read-only.json`. Do not revert/reset these changes. The PR-event-only run endpoint returned no runs for merge SHA, so **merge-commit CI is unverified**, not necessarily absent. Current production deployment health is unverified. Historical Vercel ignored-build cancellation and Supabase findings are not current status assertions.

## Local implementation
Recovered all published Phase 2.0–2.8 and Phase 3.0–3.4 packages, including later completed 2.5 (superseding the interrupted earlier work in this chat). Use Phase 3.4, not 2.4, as active candidate. 526/526 manifest entries verified, five frozen engine Git blobs verified. Historical Phase 3.4 checks: 254 Node, 239 HTTP, 48 QR, 10 Python intake = 551. Actual SQLite/local HTTP, QR and pure tests; PG driver doubles are not PG execution. Six source-based offline renders and limited static accessibility, not interactive screenshots. 17/120 original merged source blobs recovered; 103 missing. This handover attempted original archive retrieval again and failed DNS. Exact locked full app build not run. No real migration or preview component removal. Source-intake inventory and validator included. No fresh behavioral run or independent Claude review during packaging.

## Blockers
Complete original source and dependency cache, full baseline build, original UI parity and migration safety, actual browser storage/IME/animation/device/camera verification, actual PostgreSQL 17 privilege/RLS/differential/concurrency, provider revocation/step-up/deletion, production isolation, disaster recovery and retention policy, current hosted status, independent review and explicit owner authorization. No speculative new feature/security phase until source and parity are addressed.


---

# Master roadmap — requirements and order of execution

Roadmap follows the original frozen canonical roadmap, with later local milestones recorded in `IMPLEMENTATION_HISTORY.md`. Product: attendance and team tracking for schools/BPO/organizations plus playful local and multiplayer games. Not HR/payroll. No new infrastructure or production changes.

| Workstream | Existing coverage | Required completion | Gate |
|---|---|---|---|
| 1 Original consolidation | PR #26 merged independently; original local Color Rush, duck art, play/report/navigation, server engine | Exact full merged source, original locked build, cross-check original requirements and local candidate | P0 |
| 2 Hosted identity/persistence | Local Phase 2.0–2.8 recovery, identity, scopes, atomic persistence, outbox, retention, admission and protected recovery | Actual PG17, provider, independent multi-host concurrency, backup restore and hosting isolation; minimal security fit | P0 |
| 3 Attendance | Original swipe/manager commitments, candidate scoped self-check-in, historical roster, owner/manager/member, transfer/closure | Integrate original UI, attendance projections/reports/CSV, announcements, verified roles, local-to-shared consent, offline reconciliation; avoid payroll | P1 |
| 4 Multiplayer/local games | Original wheel, race, pick, trivia, memory, bingo, charades, drawing; candidate room UI/QR, local original rule modules, typing and Color Rush | Restore original shell, host/join/reconnect, authoritative scoring, correct transitions, tournament/history, guest/device recovery, QR camera; more game features only if approved after parity | P1 |
| 5 Gamification | Player passport, daily/seasonal rewards, challenges, trophies, mascots (5 originals + 12 zodiac), device-only practice/bests | Integrate without double rewards; preserve ownership, cosmetic unlock, explicit local/shared separation; no paid/cash rewards | P1 |
| 6 Premium UI/performance | Offline candidate source renders and historical original CI images | One token system, clean shell, premium motion, actual mobile/desktop interaction and profile; optimize measured bottlenecks | P1 |
| 7 Release | Local tests cumulative; historical CI pass | Exact original/working-head checks, actual screenshots, dependency/region/privacy review, PG/provider/device/restore acceptance and owner sign-off | P0 HOLD |

## Delivery sequence
A. Intake exact source, verify 120 blobs and lockfile; build unmodified baseline. B. Requirement-by-requirement behavior comparison and original frontend integration; preserve legacy data; migration design first. C. Unified responsive experience and motion, with actual screen traces. D. Regression, PostgreSQL and authorized provider acceptance, recovery and independent review. E. Prepare release evidence; no merge/deployment/activation until separate permission. Do not introduce redundant compatibility implementations; retire reference paths only after proof and approval. Keep original game logic stable and trace every changed business rule.

Product scope constraints: portrait right=present/left=absent, no claim of physical presence, manager scope and eligible historical rosters, simple org/team hierarchy, games local or live clearly distinct, flexible screen sizes, multilingual readiness without fabricated translation coverage, no unnecessary buttons or duplicated settings. Use existing brand assets; no unauthorized copying of fonts, music, animation or artwork.


---

# Implementation history — cumulative milestone evidence

Every number below is historical from the included archived README/logs, not freshly executed by the handover. Earlier checks are included in later counts; do not add milestone totals together. Each exact archive is preserved in the complete edition. Phase 2.5 and later milestones were recovered from the user's prior completed packages; the earlier interrupted chat is not the latest source.

| Phase | Completed local candidate / scope | Historical successful checks |
|---|---|---:|
| 1 / original PR #26 | Canonical consolidation of #24/#25; original browser and CI evidence, not new local candidate | Historical CI passes, 81 corrected screenshot PNGs |
| 2.0 | Identity, guest credential rotation, SQLite transactional snapshot, room recovery, scoped attendance, idempotency/rate limiting | 31 Node |
| 2.1 | PostgreSQL transaction draft, JWT verification, consent-based passport claim, outbox and account UI | 57 Node + 15 HTTP = 72 |
| 2.2 | Scoped managers, transfer/closure, deletion/redaction, retention and conflict reconciliation | 85 + 42 = 127 |
| 2.3 | Versioned room/team/profile rows, event cursors, recipient transfer acceptance, retention | 119 + 66 = 185 |
| 2.4 | Explicit state port, single authorized workspace read, one active local runtime, differential harness | 133 + 81 = 214 |
| 2.5 | Trusted revocation cutoff, admission before reconstruction, bounded maintenance, encrypted fictional restore | 145 + 93 = 238 |
| 2.6 | Recovery ledger, deletion replay, generation fences, operator quiescence, backup reconciliation | 163 + 113 = 276 |
| 2.7 | HMAC chain, independent local anchor, cooperative lock, conservative authorization recovery | 182 + 129 = 311 |
| 2.8 | Authenticated checkpoints, bounded capacity, transaction-local cache, workspace game controls | 195 + 159 = 354 |
| 3.0 | Product integration, passport, QR, drawing, tournament/room presentation | 207 + 197 = 404; 48 QR separate |
| 3.1 | Distinct zodiac vectors, settled game motion, transport, responsive boards | 218 + 217 + 48 QR = 483 |
| 3.2 | Exact original typing/games/rush cores with adapters, local game dialog | 231 + 231 + 48 QR = 510 |
| 3.3 | Practice continuity, ghosts, bests, history and original challenge rules | 246 + 239 + 48 QR = 533 |
| 3.4 | Exact merged source intake and review-only legacy mapping; original full source/build blocked | 254 + 239 + 48 QR + 10 Python = 551 |

## Evidence navigation
`../history/phase-readmes/` contains per-milestone original documentation. `../candidate/docs/IMPLEMENTATION_LOG.md` and phase-specific docs preserve the contributor history, limitations and architecture. `../candidate/evidence/` contains the inherited actual local test logs and offline render evidence; historical original PR captures are in `../evidence/`. Security preflight and standalone PG17 review-only workflow packages preserve the original SQL and image pin evidence, but actual privilege remediation and PG behavior are not tested. Original merge status in early documents is historical only.

## Handover packaging log
Read-only repository state checked; original and current PR SHAs recorded. Retrieved archived milestones; verified ZIP CRCs, internal SHA256 manifests (where present), path safety and five canonical Git blob hashes. Preserved exact archives and extracted latest candidate without modifying it. Added agent-readable docs, master roadmap and verification script. No source changes, no commits, no tests or deployments triggered. Original source archive attempted; DNS failure. No independent review performed. See verification JSON for counts and digests. This is not a fresh CI acceptance.


---

# Remaining tasks — ordered execution backlog

## P0 source and baseline (must precede integration)
- [ ] Obtain exact merge ZIP (`02bfb8d1bed633671939bbd0f769338c946f650d`) via authorized access or owner upload. Verify all 120 blobs; 17 recovered/103 missing. Do not synthesize original missing files.
- [ ] Verify lockfile Git blob `270f46772346b5a2fc888f45ee7136c612cd7cae`; inspect package scripts and dependency cache; no silent version substitutions. Use original toolchain and exact locked dependencies, no unapproved installs. Exact TypeScript 7.0.2, Vite 8.3.8, Vitest 5.1.1 per recovered prior manifest; confirm from full source. Run original baseline checks and build. Capture baseline actual interaction evidence.
- [ ] Read original and candidate routes/state/storage; create per-feature mapping with missing requirements, existing implementation and acceptance test ID. Preserve 5 online engine blobs and 4 local rule cores. Use candidate active domain entrypoint `lib/phase28.mjs` (verify in actual source), not earlier reference paths.

## P1 original UI integration and safe consolidation
- [ ] Reconcile original shell and `web/` candidate; one shared transport, account, team, live/local games and settings navigation. Preserve Today/Team/Reports/Commitments/announcements, original deep links and local functionality.
- [ ] Restore complete original games: typing 1/3/5/10 min, punctuation/dash/ghost/pacer/IME, Color Rush 108-card conservation/legal rules, wheel, pick, duck, trivia, memory, bingo, charades, drawing, tournaments, standings and cosmetics. Preserve original gameplay timing/scoring and hidden information. Use tested local core; no duplicate awards.
- [ ] Complete actual local practice continuity/legacy migration preview, separate workspace/demonstration/practice data. No live migration. Test malformed, expired, duplicate, future and interrupted imports; backup and rollback; consent; cross-tab race. No automatic score sharing or identity import.
- [ ] Integrate shared attendance (scope, frozen roster, self present only, owner/manager permissions, recipient acceptance, close/archive, deletion, exact receipt/outbox). Test role switching, removed members, stale revisions, account changes. Keep offline and confirmed status visibly different.
- [ ] Remove redundant dialog/preview/compatibility paths only after feature-level parity, original storage preservation, test evidence and independent review. Keep historical fixtures and archived snapshots.

## P1 premium UI and measured performance
- [ ] Implement `UI_UX_MOTION_BRIEF.md` across real original shell, not only preview dashboard. Test mobile safe areas, keyboards, desktop and tablet. Capture actual light/dark screenshots and interaction traces; fix reproducible overlaps, empty states, clipped labels and stale controls.
- [ ] Profile real runtime on representative low-end Android and iPhone; measure p50/p95 frame time, long tasks, memory/CPU, startup and input latency. Reduced motion, screen readers and keyboard. No unmeasured performance claims.

## P0 release acceptance (no activation)
- [ ] Actual isolated PostgreSQL 17 privilege and RLS security tests; review exact image digest, SQL and rollback contract; no remote SQL. Execute differential and contention tests against SQLite and PG, including separate team writes, transfer races, same-ID retries, failover and rollback. Global coordination remains; independent writers require proof.
- [ ] Real approved provider authentication integration, authoritative session/revocation/step-up/deletion; data erasure and retention/backup review; no fake demo exposed. No live credentials in evidence.
- [ ] Actual browser IndexedDB, storage/multi-tab, offline recovery, IME, keyboard/focus, QR camera, physical iOS/Android. Respect policy; no bypass. Verify event polling and reconnect/clock/generation fences.
- [ ] Protected backup/restore, durable independent anchor and recovery ledger, anti-rollback/key compromise limitations, scheduler/maintenance and documented RPO/RTO; fictional local tests first.
- [ ] Current GitHub exact-head check/merge CI, actual Vercel ignored-build policy, Supabase isolation, Auth config, quotas/backup availability, dependency advisories; no resource changes. Do not assume old preview is live. Manual owner checks if connector cannot read.
- [ ] Independent Claude review with exact source/patch and evidence. Resolve reproducible blockers and rerun relevant suites. Obtain explicit owner approval before any commit, migration, deployment, release or resource activation. HOLD until then.


---

# Codex frontend brief — award-quality QSwipe experience

Target premium craftsmanship, not an award guarantee. Implement inside original product after verified source/build. Keep QSwipe playful (zodiac creatures, duck, team spirit) and make attendance fast. Avoid excessive buttons, stacked menus, redundant pages and enterprise complexity. Do not introduce cosmetic frameworks without measured need, reviewed licensing/security and exact dependencies. Research visual references only from authorized public sources; implement original assets, do not copy protected motion/art/music. No extra hosted services.

## Information architecture and design system
- One mobile-first shell: Attendance / Games / Player, with context-aware Today, Team, commitments, reports and Settings; integrate original required routes rather than discarding them. Games: explicit On this device / Live rooms switch, one host/join surface, collapsed advanced choices. Player passport and collection consolidated. Settings grouped into Account & recovery, Appearance & accessibility, Data & privacy, About. Use progressive disclosure; no duplicate actions. Destructive actions separated and confirmed. Avoid unnecessary feature invention.
- Design tokens: existing brand jade/amber with semantic states; accessible light/dark palettes and neutral surfaces, crisp borders/shadows, subtle glass only where supported, readable text over motion. Use original licensed Inter/approved fallback; proposed body 14–16px, headings 20–28px, numeric tabular scores, comfortable line height. Compact 4/8 spacing scale; 16px mobile outer gutters, 24px desktop, 12–16px card internal padding; allow 320px fit and enlarged text. Touch targets at least 44 CSS px where practical, visible focus, no color-only statuses. Avoid hardcoded heights and truncated critical labels. Use responsive grid with minmax(0,1fr), safe-area insets, dynamic viewport, keyboard-aware sheets, horizontal overflow only for intentional game boards. Test 320/390/768/1280 widths and real iOS/Android.
- Components: consistent Button (primary/secondary/quiet/destructive), icon button with accessible name, chip, tabs, segmented control, bottom sheet/dialog, toast/status, skeleton, empty state, player avatar and score, roster card. Reuse CSS tokens and actual DOM components. Avoid duplicating animation layers across views. Keep contrast and focus independent of decorative effects. Use semantic native inputs and dialogs where appropriate.

## Interaction and motion specification (proposed, tune after measurement)
| Interaction | Motion / behavior |
|---|---|
| Initial screen | Short 180–240ms opacity/translate reveal for content; no blocking intro |
| Tab switch | 160–220ms indicator transition and retained scroll/state; no full reload |
| Button press | 90–120ms subtle scale/opacity, immediate feedback; no delayed action |
| Card swipe | Finger-following transform and threshold, clear present/absent cue, snap-back if cancelled, equivalent accessible buttons; pending only until server ack |
| Sheet/dialog | 220–300ms transform/opacity; focus trap, Escape/back and restore focus; no unsafe action by swipe |
| Loading/error | Stable skeleton dimensions, cancellable request where safe, inline retry and real status; do not fake progress |
| Wheel | Server-authoritative result; deterministic visual deceleration derived from settled outcome, no client winner selection or leaked future result |
| Duck race | Time-synchronized track, player skins and subtle parallax; one bounded animation loop, pause offscreen/hidden, final position from canonical result |
| Memory/Bingo | Responsive cards, quick flip/mark feedback, no hidden answer leakage, animate transform only; preserve focus/turn locks |
| Trivia/Typing | Low-jitter timers, no layout shift; keyboard/IME, ghost/pacer and accuracy from original rules; no animation delaying inputs |
| Color Rush | Deck/hand conservation, legal turns; compact hand layout, no overlapping hit targets; clear wild choice and draw states |
| Drawing/Charades | Coordinate/pointer sampling bounded; preserve turn scope and explicit submit; no unsent drawing leakage |
| Rewards | One brief celebration after canonical acknowledgement, original trophies/mascots; reduced-motion static equivalent |

Use transform/opacity and time-based animation, not per-frame layout reads. No indefinite decorative loops in background, no frame-driven network requests, no excessive blur or expensive filters. Cancel RAF/timers on route/unmount, hidden document and generation change. Respect prefers-reduced-motion, battery/low-end performance, pause/skip. Haptic/audio optional and only with user controls and allowed assets. Never trade correctness for animation or use motion as the only status signal.

## State completeness and evidence
Design each screen for empty, loading, success, pending offline, conflict, expired, revoked, closed, error and retry. Distinguish local/demo/shared and owner/manager/member/guest. Show only authorized fields. Actual roster cards must remain usable with large text, long names and keyboards. Keep original game board behavior and scores. Confirm all visible controls work; no dead buttons. Review layout/padding/font sizes/spacing alignment/touch targets on actual browser and device. Capture before/after at 320/390/768/1280 light/dark; record interaction GIF/trace only if actually captured. Propose performance budgets (p95 frame interval ≤33.3ms on target low-end device during gameplay; target 60fps where feasible, no unsupported claims). Record measurement device, build, samples, p50/p95, long tasks and dropped frames. Measure cost of each added library/asset; favor CSS/WAAPI and existing code. Evaluate VoiceOver/TalkBack, keyboard, contrast, reduced motion and no scroll clipping. Static renders alone are insufficient. Independent review must check visual quality and all state transitions.


---

# Acceptance gates — evidence before release

Use `candidate/docs/PHASE34_ACCEPTANCE.md`, `candidate/docs/PHASE34_SOURCE_CONSOLIDATION.md`, `candidate/docs/PHASE24_POSTGRES_ACCEPTANCE.md`, and the exact archived tests as source of detailed procedures. Fresh runs must use a disposable working copy, fictional data, approved tooling, no real provider secrets or network access to remote databases. Do not bypass managed browser rules. Historical tests are not a release check for a changed build.

| Gate | Current evidence | Required next evidence |
|---|---|---|
| Package integrity | 526/526 latest internal manifest; five engine Git hashes | Verify before working; retain original archive |
| Full original source | 17/120 | Exact merged ZIP all 120 blobs, lockfile verified |
| Original build | Partial original-rule compile only | Exact locked toolchain, original npm run check/build, no silent substitution |
| Domain regression | 254 Node, 239 HTTP historical | Fresh original + candidate tests after integration, exact logs, no hidden skips |
| QR and source intake | 48 QR, 10 Python historical | Actual scan/camera/device and intake negative cases |
| PG17 | Driver doubles/review SQL only | Actual PG17 local-socket, network-isolated privilege/RLS, rollback, differential/concurrency, version/digest evidence |
| Security | Local bounded/session/recovery checks | Provider revocation/step-up, actual PG privileges, retention and backup review, multi-host admission |
| UI | 6 offline source renders + separate historical original CI captures | Actual interactive browser/device/IME/storage, visual contact sheets, focus/contrast/large text/reduced motion |
| Performance | Prior local microbenchmarks only | Reproducible real-device metrics and traces; compare baseline vs candidate |
| Release | HOLD; historical PR-head CI success | Exact current working SHA and merge CI, independent review, owner-approved deployment/hosting plan |

Suggested local reproduction (only after review and verified exact environment): in working copy of candidate, follow README. `python source-intake/verify-source.py --inventory`; `python tests/build-local-core.py`; `unshare --user --map-root-user --net sh -c 'node --test tests/*.test.mjs'`; `unshare --user --map-root-user --net sh -c 'ip link set lo up; python tests/http-smoke.py && for p in 22 23 24 25 26 27 28 30 31 32 33; do python tests/http-phase$p.py || exit; done'`; `unshare --user --map-root-user --net python tests/qr-verify.py`; Python intake tests and renderer per README. Verify network namespace and runtime availability; stop if denied. These commands are examples from tested candidate, not authorization for remote execution. No workflows started during handoff.

## Reporting requirements
Record command, environment/version, exact SHA or package hash, fixtures, exit code, test counts and skips, screenshots/traces and limitations. Never conflate static renderer and browser screenshots or mocks and real PG. Independent reviewer must examine actual artifacts and confirm scope. No release approval implied. If approval is later granted for commits, record progress before each commit and recheck exact-head CI. Keep original PR #26 reference immutable; no reset or revert.


---

# Independent Claude review handoff — not yet performed

Request a separately authorized Claude reviewer (use available current model, do not invent model availability) after Codex has integrated exact source and produced evidence. Supply a clean working diff, verified source and package hashes, test output, visual captures and performance traces, not secrets. Use `candidate/docs/CLAUDE_REVIEW_HANDOFF.md` and archived phase handoffs for details. Reviewer must not change frozen branches, deploy, provision or apply remote SQL. Review only unless user separately authorizes fixes.

Review priorities: (1) original engine/roster/reward equivalence and legacy storage; (2) role/membership/revocation, replay/generation, scoped event and backup recovery; (3) transaction isolation/rollback and actual PG tests; (4) navigation/duplicate component removal after parity; (5) premium visual hierarchy, layout/padding, button consistency, fonts, responsiveness, animations and transitions; (6) keyboard, screen readers, reduced motion, device/IME, touch and QR; (7) measured performance, dependency/licensing and region-appropriate privacy; (8) source/test evidence integrity and release gates.

Return P0/P1/P2 findings with file/line, reproduction, expected/actual, severity, proposed minimal fix, tests and remaining risk. Report blockers or untested conditions honestly. No speculative security expansion and no new feature until original parity. Do not label a handoff as independent approval. Codex should implement only authorized reproducible corrections, document before changes, rerun relevant regressions and report evidence. Production remains HOLD.
