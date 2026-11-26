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
