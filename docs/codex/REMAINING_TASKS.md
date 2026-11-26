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
