# QSwipe Codex handover — repository entry point

**RELEASE HOLD. Documentation-only publication on existing draft PR #24.** This directory contains the actual handover Markdown, not the candidate source or ZIP archives. Do not treat this historic PR branch as the current integration baseline. PR #25 and #26 were already merged before this publication. Preserve original frozen reference `093d127f7037b9bd2403d0e813814df727529528`, PR #26 merged head `abf6337c5edc56da6a586ba57a7a696f8161e7f1`, merged main `02bfb8d1bed633671939bbd0f769338c946f650d`. Do not reset, reopen, or merge historical branches.

## Read first
- [Master handover](MASTER_HANDOVER.md)
- [Current status](CURRENT_STATUS.md)
- [Master roadmap](MASTER_ROADMAP.md)
- [Remaining tasks](REMAINING_TASKS.md)
- [Implementation history](IMPLEMENTATION_HISTORY.md)
- [Premium UI / UX / motion brief](UI_UX_MOTION_BRIEF.md)
- [Acceptance gates](ACCEPTANCE_GATES.md)
- [Independent review](INDEPENDENT_REVIEW.md)
- [Original package instructions](README.md) and [original agent instructions](AGENTS.md)
- [Prior detailed handoff](QSwipe_CODEX_MASTER_HANDOFF.md) (historical; current status supersedes it).

## Source package intake
The owner can supply the previously generated working archive **QSwipe_Codex_Handover_Working.zip**, SHA-256 `84e742a2ac86992b544276a0a6f5c15693af07d3eeb85e2519211a632fdf7a4d`. The full historical archive **QSwipe_Codex_Handover_Complete.zip** has SHA-256 `21317879a7cfe6567105bd8f43b95513d511f8e47370045316a526928ed29f4f`. Neither ZIP is stored in this Git branch. Do not attempt to access ChatGPT sandbox paths from Codex. Extract supplied archive in a separate disposable directory and execute its offline manifest verifier. Relative candidate/, history/, evidence/ and tools/ paths in copied documents refer to the extracted archive, not to this branch. Obtain the exact merged source using authorized GitHub access: https://github.com/nasrinaiv0/QSwipe/archive/02bfb8d1bed633671939bbd0f769338c946f650d.zip . Verify all original Git blobs; 17/120 recovered at packaging time. Do not synthesize missing original files.

## Precommit progress log
2026-11-27 — ChatGPT, authorized documentation publication. Target only open draft PR #24; parent `cded8a252bbd27b9e8b8a24704c0ec5c179729b8`; base tree `98c7d32d41af26937e5fb8f360979874a166d0ca`. Intended changes: add repository-root AGENTS.md and handover Markdown under docs/codex/. No app, workflow, lockfile, database, environment, flag or deployment changes. Preserve main and merged PR heads. Risks: historical stack must not be mistaken for integration base; copied archive-relative links must be interpreted as archive references; CI or preview checks may be triggered automatically by the branch update. Checks before commit: inspected target tree for path collision, original working and full ZIP SHA-256, read document completeness, scanned likely credential formats, retain original application tree. After push verify exact changed paths and PR head, report actual CI status; no manual workflow/deployment dispatch, merge, provisioning or remote SQL. Independent review remains pending. The user's push authorization applies only to this documentation publication, not implementation or release.
