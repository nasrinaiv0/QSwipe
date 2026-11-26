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
