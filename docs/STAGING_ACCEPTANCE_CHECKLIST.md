# QSwipe staging P0–P2 — independent acceptance checklist

**Do not merge or apply migrations solely because static tests or Vercel build are green.**

| Gate | Evidence required | Current assessment |
|---|---|---|
| Current PR source | Exact Git SHA matches tested preview | Pending new PR |
| No production changes | No production environment variables, deployments, migrations or merges | Required |
| Staging database | Separate QSwipe-only project, schema reviewed/applied there only | Blocked: project not provisioned |
| OAuth/OTP identity | Verified, non-anonymous, invite-only test accounts; no auto-role grants | Not live-tested |
| L1/L2/L3 RBAC | Scope read with manager assignments; tested across org, site and unit | Unit-only policy prepared; live tests pending |
| Role revocation | Old access token cannot read after grant/membership revoked | Staging test pending |
| Manager writes | Immutable audit, atomic version/idempotency, MFA and self-approval denial | Not implemented in this read-only P0–P2 PR |
| Static UI | 320, 390, 768, 1280 layout with input validation, visible focus, reduced motion | Reviewer/real-device pending |
| Release/compliance | DPA, school record and public-sector policies, privacy notice, retention, restore drill | Not approved |

## Test identities and data

Provision *fictional users only* across distinct organizations A and B, with two sites per organization. Within A, create units Orion and Nova and assign Level 1 only to Orion, Level 2 to an approved explicit subset, Level 3 to an explicitly approved set. Create a Member in each unit and at least one revoked user. A government and school fixture may be used for template label behavior but must not contain student names.

## Live negative testing

For each real staging JWT, query `qs_stg_memberships`, `qs_stg_role_assignments`, and `qs_stg_roster_assignments` with both permitted and guessed workspace UUIDs. Verify `anon` receives no rows and no data-mutating privileges, a member cannot self-promote, Level 1 cannot read Nova, no manager reads org B, expired grants do not work, and revocation applies immediately even with an otherwise valid session.

Use `QSWIPE_STAGING_INTEGRATION=1`, `QSWIPE_STAGING_TEST_ISOLATED=YES`, and temporary staging-only environment variables documented in `test/staging-integration.test.js` to run read-only live tests. Do not run this against MOVO, NasrinAI, or production.

The current staging UI intentionally omits attendance/approval writes; the security plan's conflict, leave, audit and idempotency checks must be completed in a future separate P3/P4 PR before real attendance use.
