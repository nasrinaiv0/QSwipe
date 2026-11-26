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
