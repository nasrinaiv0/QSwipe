# QSwipe team play refresh — preview only
Base main 7aadaaa2518d12e75275b27eef44953fba426b83; deliberately independent of draft PRs #7–#16 and abandoned enterprise planning branch. Do not merge, provision resources, apply SQL, or modify production. Existing local-first attendance, QR, hierarchy and games retained. No new HR/payroll features.

Audit: existing wheel and duck race choose fair crypto-random winners; trivia is solo and best score global; history is memory-only and global across workspaces. Cards can show stale or ordered decks when entries change; race animation assumes mounted nodes; hash navigation/refresh can leave timers or results in the wrong workspace. Existing local-only app has no shared server/game rooms; do not describe local play as authenticated remote multiplayer.

Scope: add opt-in shared-device team trivia (2–8 roster players, round-robin equivalent generated math challenge, no speed bonuses, private practice), persistent bounded workspace score ledger keyed by roster IDs, one scoring entry per player/local calendar day (practice unlimited), weekly/all-time recorded-history leaderboard, milestones and cosmetic reward unlocks only. No cash, wagering, attendance penalties or employee performance scoring. Points from correct trivia answers plus completed participation; random wheel/race/card picks do not grant competitive points. Limit retained records, validate imports, prevent duplicates, exclude removed members from display. Never award when previewing another role. Scores local and editable by device owner; no claim of anti-cheat or cross-device sync. Local attendance remains unchanged and visible via Today quick entry.

Fix existing play lifecycle, duplicate/truncated entries and stale decks; improve touch layouts, smooth reduced-motion-aware transitions. Browser acceptance on fictional workspace: attendance entry, all four games, team trivia completion, leaderboard persistence/reload, workspace separation, dark/mobile no overflow; retain existing test suite. Independent Claude/frontend review requested as handoff only, not claimed performed. No real data or production changes.

## Verification refinement
Remove an unused import under strict TypeScript; exercise repeat daily scoring and workspace isolation in the built browser app. Score rewards are non-redeemable cosmetic recognition; no remote game room or cross-device score authority in this PR.

CI reported missing `$$` selector after replacement-string dollar escaping; correct the import using literal concatenation and rerun.

Browser run timed out waiting for the wheel spin button: fictional roster was injected into localStorage while the app still held the old in-memory workspace, so the pagehide flush can overwrite it. Dispatch the same storage-change event used by the app before reloading, assert the fixture survives, then run all games again. This is a fixture-only change.
