# QSwipe PR #4 — isolated staging setup and fictional-tenant RBAC test plan

**State:** Prepared for review only. **No Supabase project provisioning, user invitations, SQL execution, Vercel configuration, PR merge, or production changes authorized or performed.**  
**Source head inspected:** `468c73351b22a6e73f1d8de6c793fe952c875048`.  
**Scope:** P0–P2 *read-only* identity, organization/workspace membership and unit-scoped manager roster access. P3 attendance writes and P4 approvals are out of scope.

## Progress documented before this documentation commit
- Read the existing PR #4 SQL migration, Auth/API handlers, integration tests, staging runbook, and acceptance checklist directly from the exact GitHub head.
- Connected Supabase project listing contains **MOVO** and **NasrinAI**, with **no QSwipe staging project**. Do not reuse either existing project.
- Existing `test/staging-integration.test.js` has **two live tests gated by explicit staging-only environment flags**. Those tests are skipped until a separate approved staging fixture exists. Static test success is not live-RLS proof.
- The PR migration uses eight `public.qs_stg_*` tables, explicit SELECT privileges, RLS, composite workspace foreign keys, and role grants per *individual unit*. The earlier correlated-column qualification was code-reviewed but **not validated against PostgreSQL**.
- Review-only risk: `qs_stg_my_units` permits any active workspace member to enumerate all units in that workspace (via `qs_stg_workspaces` RLS). This may be intentional for a directory; obtain an explicit least-privilege/privacy decision before applying SQL.
- This file is a *test plan*, not approval to provision, apply, seed, enable, or merge.

## 1. Isolation contract — mandatory preflight

| Boundary | Required value / action | Do not do |
| --- | --- | --- |
| Project | NEW dedicated `QSwipe Staging` Supabase project; record its own project reference | Never point at MOVO or NasrinAI, even temporarily |
| Industry templates | Only fictional BPO and government records in initial fixture; school labels may be tested without real students | No employee, student or government personal records |
| Region | Select an approved region for tests (Singapore is a candidate subject to availability, policy and cost review) | Do not assume a region satisfies all privacy/data-residency laws |
| Credentials | Publishable key and URL only to **Preview** environment after authorization | No database passwords, privileged keys, session tokens or service-role key in GitHub, browser bundles or logs |
| Auth | User-controlled test email inbox aliases; disable open sign-ups; invite-only accounts; code-delivering email OTP template | Never rely on nonexistent `@example.test` inboxes for real OTP delivery |
| Network | Protected Vercel preview; keep SSO/Deployment Protection enabled | Do not disable protection for E2E |
| Schema | Review PR file `supabase/migrations/20261123000000_qswipe_staging_identity_rbac.sql`; record SHA-256 before any **separately approved** apply | No SQL against live projects; do not run privileged commands as an RLS test caller |
| Lifecycle | Dedicated fixture-only accounts, least-privilege administrator, approvals recorded, teardown plan | No unattended cleanup or destructive operations without approval |

**Approval checkpoints:** A: project creation and prospective cost; B: independently reviewed migration application; C: fictional identity/fixture seed; D: preview-only environment activation and protected E2E; E: any merge or production change. **None of these checkpoints is granted by this document.**

## 2. Future setup runbook (NOT executed)

1. **After explicit approval A:** In Supabase Dashboard, select the correct organization and **New project**. Choose a clearly named `QSwipe Staging` project, an approved region, independent DB password in a credential manager, and non-production billing controls. Capture the new project ID and confirm it does not match either pre-existing project's ID.
2. Review Auth settings before invitations: require email verification, disable public self-registration, review email OTP expiry/rate limits, set the confirmation email template to contain a numeric `{{ .Token }}` code, configure a controlled test-mail delivery service where needed, and use only approved tester-owned inboxes.
3. **After separate approval B and independent security review:** Inspect the migration's table privileges, RLS nesting, unit-name visibility, grant expiration, workspace linkage, and trigger behavior. On the *new* staging project only, apply the reviewed migration once using an approved administrative deployment path. Save the SQL hash and migration result. Never assume green static tests mean SQL execution will succeed.
4. **After separate approval C:** Invite controlled test users, create fictional organizations/sites/workspaces/units, and provision active memberships and individually scoped role assignments using a reviewed admin-only fixture procedure. Grant clients no direct write to memberships, grants, units, or roster tables. Record fixture UUIDs privately (not in GitHub).
5. **After approval D:** In Vercel QSwipe **Preview only**, set `QSWIPE_STAGING_ENABLED=true`, `QSWIPE_STAGING_SUPABASE_URL`, and `QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY` using the *new* QSwipe project. Do **not** add these values to Production. Redeploy preview only if authorized, ensuring SHA matching. The existing API must still report `STAGING_DISABLED` outside Preview.
6. Test the protected `/staging/` page and the three read-only endpoints with real fictional identities. Use a trusted, authenticated browser (or approved Vercel OIDC Trusted Sources flow) without disabling deployment protection.
7. Restore the preview to disabled after the test window if required by the approved runbook. Fixture cleanup, account revocation and project deletion require separate authorization. Preserve redacted evidence and audit history as agreed.

## 3. Deterministic fictional fixture blueprint

Create **2 organizations, 4 sites, 4 workspaces, 5 units, 9 active user identities, 1 revoked identity and an anonymous caller**. Use nonidentifying display names such as `Test Member Orion 01`. The actual auth email addresses must be tester-controlled and must not appear in test logs.

| Org | Industry | Site | Workspace | Unit |
| --- | --- | --- | --- | --- |
| A — Vertex Fictional Support | BPO | A-Site-01 | A-W1 | **A-Orion** |
| A | BPO | A-Site-01 | A-W1 | **A-Nova** |
| A | BPO | A-Site-02 | A-W2 | **A-NightOps** |
| B — Civic Fictional Lab | Government | B-Site-01 | B-W1 | **B-Records** |
| B | Government | B-Site-02 | B-W2 | **B-Services** |

**Schema constraint:** `qs_stg_workspaces.site_id` assigns each workspace to one site, so this fixture uses **one workspace per site**. A-W1 has Orion/Nova, A-W2 has NightOps, B-W1 has Records, and B-W2 has Services. Grant Level 2/3 managers explicit memberships and unit roles in each workspace they need to access; never infer cross-workspace permission from a title.

| Identity label | Tenant membership(s) | Explicit allowed unit(s) | Negative scope |
| --- | --- | --- | --- |
| `A-member-orion` | A-W1 (member) | Own roster row only | A-Nova, A-NightOps, B |
| `A-member-nova` | A-W1 (member) | Own roster row only | A-Orion, B |
| `A-L1-orion` | A-W1 | `level_1`: A-Orion | A-Nova, A-NightOps, B |
| `A-L2-ops` | A-W1 | `level_2`: A-Orion, A-Nova | A-NightOps, B |
| `A-L3-site01` | A-W1 | `level_3`: A-Orion, A-Nova | A-NightOps at another site, B |
| `A-L3-multisite` | A-W1 and A-W2 | `level_3`: all three A units, per workspace | B |
| `B-member-records` | B-W1 (member) | Own roster row only | B-Services, A |
| `B-L1-records` | B-W1 | `level_1`: B-Records | B-Services, A |
| `B-member-services` | B-W2 (member) | Own roster row only | B-Records, A |
| `A-revoked` | A-W1 revoked | None (stale JWT test) | Every roster / role / membership |
| `Anonymous` | None | None | All private tables |

**Seed constraints:** The nine active identities may also have their own member roster rows, but role assignments alone never authorize another unit. Use unique, realistic UUIDs generated at seed time. All fictional rows must have an active status unless a particular test intentionally changes it. Keep project URL and token values in temporary protected test configuration, never committed fixture files.

## 4. Acceptance matrix — expected results

For read APIs, a denied RLS-filtered query typically yields **200 with an empty array**, whereas a missing table privilege may return **401/403 or PostgREST 42501**. Accept **either proven denial**, but **never returned unauthorized rows**. Distinguish application authentication failures from RLS-filtered reads. Execute with **real user JWTs and the publishable key**, not service-role or database-owner privileges.

| ID | Caller / operation | Expected result |
| --- | --- | --- |
| ENV-01 | Production `/api/staging/config` with switch copied in error | `503 STAGING_DISABLED` |
| ENV-02 | Preview with staging switch absent | `503 STAGING_DISABLED` |
| ENV-03 | Preview with malformed URL/publishable key | `503 STAGING_NOT_CONFIGURED` |
| AUTH-01 | Uninvited alias attempts OTP | No user created; cannot reach protected roster |
| AUTH-02 | Invited but unverified email | `VERIFIED_IDENTITY_REQUIRED` or denied session |
| AUTH-03 | Valid invited fictional user | Auth identity ID matches project; membership from DB only |
| AUTH-04 | Anonymous/no bearer on `/api/staging/me` | `401 INVALID_SESSION` (or documented upstream auth denial) |
| AUTH-05 | Forged `user_metadata` manager role | Does not change visible units or grant rows |
| AUTH-06 | Change role in browser local UI/requests | No additional permissions; no demo role fallback |
| RLS-01 | `A-member-orion` reads own roster row | Exactly own authorized row(s), not another member |
| RLS-02 | `A-member-orion` guesses Nova roster UUID | No Nova roster |
| RLS-03 | `A-L1-orion` reads A-W1 | Only Orion roster and own legitimate row(s), never Nova |
| RLS-04 | `A-L2-ops` reads A-W1 | Orion and Nova roster; no units outside explicit grants |
| RLS-05 | `A-L3-site01` reads A-W2 | Denied: no A-W2 membership or NightOps grant |
| RLS-06 | `A-L3-multisite` reads A-W1 and A-W2 | Only explicitly granted A units across their memberships |
| RLS-07 | A users guess B-W1/B-W2 workspace UUIDs | No B memberships, grants, rosters, site or org data |
| RLS-08 | B manager guesses A-W1 | No A records |
| RLS-09 | Unit grant expires; caller retains old JWT | Scoped roster disappears without token refresh |
| RLS-10 | Active manager membership revoked; JWT remains unexpired | No associated membership/grants/roster access |
| RLS-11 | New membership after revocation | Old grants do **not** reactivate; require new explicit grants |
| RLS-12 | Workspace status suspended | Corresponding scoped roster unavailable |
| RLS-13 | Manager's membership `ends_at` passes | Access unavailable with old JWT |
| RLS-14 | Unrelated unit is suspended | **Review-dependent:** define intended visibility before approval; current roster SQL does not check unit status |
| RLS-15 | Member enumerates `qs_stg_units` in same workspace | **Privacy decision required:** current policy exposes unit names across that workspace |
| RLS-16 | Anonymous reads all `qs_stg_*` tables | No private rows / no unauthorized privileges |
| WRITE-01 | Member INSERT/UPDATE membership or role assignment | Denied; membership/role cannot be self-granted |
| WRITE-02 | Member attempts to write roster or workspaces | Denied |
| WRITE-03 | Member edits *own* profile presentation fields | Allowed; other users' profile writes denied |
| WRITE-04 | Cross-workspace membership/unit relationship inserted by fixture admin | Composite FK rejects mismatched pairing |
| WRITE-05 | Revoked membership changed back to active by fixture admin | Trigger rejects; new membership required |
| API-01 | Invalid workspace UUID on roster endpoint | `400 INVALID_IDENTIFIER` |
| API-02 | Authenticated user requests unauthorized workspace | `403`; no cross-tenant data |
| API-03 | Roster response contains profile email, legal ID, private bio, or token | **Fail**; only minimal permitted roster fields |
| API-04 | Browser request from arbitrary origin | No permissive CORS and no exposure of user bearer token |
| UI-01 | Protected preview OTP + granted roster (320/390/768/1280 px) | No horizontal overflow; text legible; status feedback |
| UI-02 | Keyboard, screen reader, reduced motion | Navigable labels, visible focus, no inaccessible swipe-only actions |
| UI-03 | Sign out and refresh | Memory-held token cleared; cannot query without new verification |
| OPS-01 | Database security/performance advisors | Review and resolve actionable findings; attach redacted evidence |
| OPS-02 | Production QSwipe, MOVO and NasrinAI after testing | Unchanged |

For **WRITE-03–05**, authorization for a staging fixture admin's seeding/test mutations is a **separate approval C**. Do not execute them in this documentation-only phase. No attendance/approval API exists in P0–P2; the P3/P4 race, self-approval, audit and idempotency tests are **future gates**, not passed/failed tests in this PR.

## 5. Existing runnable tests and limitations

- Safe now, offline only: `npm run check` and `node --test test/staging-security.test.js test/staging-sql.test.js`; neither provisions nor migrates a database.
- The existing **two** `test/staging-integration.test.js` cases test cross-tenant denial and a member's absence of manager grants; they **skip** until deliberately enabled with the required `QSWIPE_STAGING_*` test variables. **Skipped ≠ passed.**
- After explicit approvals A–D and verified isolated fixture, run live tests using authenticated user JWTs over PostgREST; expand automated integration coverage to include the matrix above rather than claiming manual results are automated.
- Test production gating from a **non-mutating** request only; don't set Preview flags in Production.
- Capture a run manifest with PR head SHA, deployment ID, isolated project ref, SQL SHA-256, fixture manifest revision, test identity labels, timestamp, each case's expected and observed status, approval record, reviewer and redacted evidence URLs.

## 6. Independent review and sign-off

Before approving any SQL apply or merge, obtain independent checks for:
1. Correct SQL correlation after the earlier qualified-column fix; no unintended recursion; cross-workspace FK constraints; role expiry, revoked membership and stale-token semantics;
2. Whether workspace members should see *all* unit names and whether suspended units should hide roster rows;
3. Grant/deny permissions on every exposed table, default Auth sign-up controls, no RLS-bypassing privileged key in API or client, and no secrets/PII in logs;
4. UI accessibility, actual protected preview login, mobile Safari/Chrome, and regional privacy/security requirements;
5. Final staging separation and a named, authorized owner for preview environment variables, fixture seeding, and eventual cleanup.

**Decision: NO-GO** until dedicated staging, separately approved migration/fixture execution, live negative RLS and revocation tests, protected preview E2E, independent review, and explicit merge approval are complete.

### Reference source files in PR #4
- `docs/STAGING_AUTH_RBAC.md`
- `docs/STAGING_ACCEPTANCE_CHECKLIST.md`
- `supabase/migrations/20261123000000_qswipe_staging_identity_rbac.sql`
- `test/staging-integration.test.js`
- Supabase documentation: https://supabase.com/docs/guides/api/securing-your-api , https://supabase.com/docs/guides/auth/auth-email-passwordless , https://supabase.com/docs/guides/deployment/going-into-prod .
