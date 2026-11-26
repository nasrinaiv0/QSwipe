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
