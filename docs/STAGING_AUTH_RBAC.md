# QSwipe staging authentication + RBAC (P0–P2)

Status: **review-only, fail-closed, staging-only. No database migration applied.** Prepared from `QSwipe_Secure_Auth_RBAC_Implementation_Plan.md` dated 2026-11-23. This PR must not be merged, promoted, or connected to production without full acceptance evidence and explicit approval.

## Scope delivered

- `public/staging/` is a separate, responsive test-only authentication UI. It preserves the existing QSwipe demo and all games unchanged. Invited fictional test users can request a Supabase email OTP (`create_user:false`), verify it, and keep access tokens **in memory only**. Refreshing the page signs them out. There is no role selector or role stored in a client token.
- `/api/staging/config` publishes **only** the Supabase staging project URL and **publishable** key; `/api/staging/me` verifies the access token using Supabase Auth's `/auth/v1/user` endpoint and returns live active memberships and explicit unit grants; `/api/staging/roster` verifies workspace membership and makes an RLS-limited, read-only roster query capped at 100 rows.
- All endpoints return `503 STAGING_DISABLED` unless **both** `VERCEL_ENV=preview` and `QSWIPE_STAGING_ENABLED=true`. They also refuse missing or malformed config. `QSWIPE_STAGING_LOCAL_TEST=1` is allowed only with `NODE_ENV=test`, and is not a deploy configuration. No `service_role` or secret key is used.
- The **unapplied** migration provisions staging-prefixed organization, site, workspace, unit, self-service profile, active membership, explicit manager grant, and read-only minimal roster tables. Explicit grants plus `TO authenticated` RLS policies protect reads. There are no employee-facing write privileges to role, membership, unit or roster tables. A role row authorizes a **single** unit; a manager with multiple units requires an explicitly approved row per unit. Industry labels **do not** expand permissions.
- Revoked memberships cannot be reactivated, preventing old grants from being inherited by a newly invited user. Units and memberships from different workspaces cannot be joined due to composite foreign keys.
- The API does not implement live attendance swipes, manager approvals, role granting, private avatars, real exports, or tenant-admin operations. These require separate P3/P4 PRs with atomic transaction/audit and high-risk MFA. The original role-switching demo remains demo-only; it must not be used with real staff data.

## Dedicated staging project prerequisite

The connected Supabase account currently lists **MOVO** and **NasrinAI**, not a QSwipe staging project. Neither may be used. A user-authorized administrator must provision a NEW QSwipe-specific non-production Supabase project and use fictional accounts only; no migration is executed by this PR.

1. Review `supabase/migrations/20261123000000_qswipe_staging_identity_rbac.sql` and obtain independent security/DB review. Apply **only** to the isolated, newly approved QSwipe staging database (after reviewers check role privileges, grants, RLS, composite tenant FKs and policy semantics). Record the Supabase project reference and migration hash in the test report; do not paste any secrets into the PR.
2. In Vercel → QSwipe → **Preview environment only**, configure `QSWIPE_STAGING_ENABLED=true`, `QSWIPE_STAGING_SUPABASE_URL=https://<qswipe-staging-ref>.supabase.co`, and `QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY` with its `sb_publishable_` value. Do not set these in Production. Enable only after confirming the preview targets an approved protected development branch.
3. Configure Supabase Auth email OTP templates to provide a one-time **numeric code** (not solely a magic link); invite fictional accounts through an audited staging-only admin setup, and link them to active memberships/explicit grants via a reviewed setup procedure. Allow only exact staging callback origins if OAuth is later enabled; do not auto-grant by email domain or browser role.
4. Open **Preview → `/staging/`**, sign in with the invited account, and confirm workspace and minimum role visibility. Verify member A cannot query org B and Level 1 Orion cannot query Nova using signed RLS queries. A revoked user must immediately lose access even if an old JWT is still unexpired.
5. Never add the staging credentials to `public/` files or GitHub source. A publishable key is non-secret, but still supply it only as a Preview environment variable to prevent accidental production project coupling. Keys granting bypass RLS must never be used by browser code or APIs.

## Authorization contract

| Actor | Database read scope | Implemented in this PR? |
|---|---|---|
| Unauthenticated/anonymous | None | Yes; no `anon` grants, verified user required |
| Member | Own profile, workspace membership, own roster assignment | Yes, DB RLS |
| Level 1 | Own explicitly granted units | Yes, DB RLS on roster reads |
| Level 2 | Units explicitly granted within the assigned operational scope | Yes, DB RLS; scope enumeration provisioned by admin |
| Level 3 | Units explicitly granted for their designated site | Yes, DB RLS; no implicit org-wide access |
| Org administrator | Separately provisioned unit grants, no client grant mutation | Read-only staging; admin flows NOT implemented |
| System operator | No implicit personnel access | Yes, no default grants |

**Important:** Read-only role grants do not yet constitute a complete production manager workflow. Do not enable real approvals until the P3/P4 authorization and audit implementation is reviewed.

## Security acceptance gate — NOT YET SATISFIED

- [x] Code-level tests: production off, invalid configuration denied, malformed bearer and UUID denied, unverified user rejected, out-of-workspace denied before roster read, least-privilege SQL grant checks, explicit unit scope logic.
- [ ] Independent SQL review and `pg` migration validation against an isolated QSwipe staging database.
- [ ] Supabase security and performance advisors, role audit, and staging schema exposure checks completed.
- [ ] Tests with two real **fictional** identities in two staging organizations, two sites, Orion/Nova separate teams; include revoked and stale JWT, L1/L2/L3, self-approval prohibition, negative IDOR/CSV tests.
- [ ] Protected Vercel preview E2E login/roster, 320/390/768/1280 screen shots, iPhone Safari/Android Chrome, keyboard and VoiceOver/TalkBack.
- [ ] Physical-device, concurrency/transaction, high-risk MFA, production privacy/retention/legal review. Attendance and manager write paths are **not** implemented in this PR.
- [ ] External security review (request Claude Opus 5.5 if it becomes available), exact-head tests/preview verification and explicit user approval before merging or production rollout.

## How to test without staging access

Run `npm run check` (existing QSwipe unit tests + new isolation/contract tests) and `node --test test/staging-security.test.js test/staging-sql.test.js`. The live test in `test/staging-integration.test.js` intentionally SKIPS without separate staging-only fixture environment variables. **A skipped test is not a pass.** No database or production state is changed by these commands.

## Design trade-offs

| Choice | Advantage | Disadvantage |
|---|---|---|
| Supabase Auth + PostgREST with caller JWT | Reuses provider identity; RLS evaluates current user and membership | Requires staging project and careful RLS review/verification |
| Explicit per-unit role assignments | Revocation and scope easy to reason about; no hidden hierarchy inheritance | Needs audited grant provisioning when teams or trees change |
| Preview-only, read-only APIs first | Very low risk of accidentally writing real personnel data | Manager approvals and production workflows remain unavailable |
| Session token only in memory | No persisted access token in localStorage | Signing in again after refresh; a future BFF cookie design requires CSRF and refresh handling |

**Next PR boundaries:** P3 atomic attendance and audit; P4 approvals/reassignments, invitation and MFA administration, avatar storage and reporting; P5 actual devices and UI. These must each retain deny-by-default backend permissions and real-stage negative tests.
