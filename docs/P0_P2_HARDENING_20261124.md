# QSwipe P0–P2 hardening — 2026-11-24

Base: 7aadaaa2518d12e75275b27eef44953fba426b83. Scope: isolated branch and preview only. No merge, production configuration, database execution, paid provisioning, or real personnel data. Main application UI and games must remain byte-identical.

## Pre-implementation review
- Existing transport allows any Supabase hostname, including accidental production coupling, and follows redirects by default. Require independent expected staging and production project references, exact host and default HTTPS port; deny redirects and minimize returned roster fields.
- Existing SQL policies allow manager scope without MFA and suspended units can remain readable. Require provider-issued AAL2 for role grants, and active workspace/unit for grants and roster. No client write rights added. Existing migration is explicitly unapplied on the connected QSwipe project; amend it only as a review candidate for a fresh isolated staging project. If any environment applied the old hash, stop and prepare a forward migration after approval.
- Staging panel selector is broken; fix only the isolated staging page. Clear stale roster on workspace switch or sign-out, and discard obsolete responses. OTP remains invited-only and tokens remain memory-only. MFA enrollment/recovery UX and direct REST session revocation are still release gates; OTP-only managers must not see other members.
- Supabase event-trigger privilege warnings: prepare a separate, manually reviewed SQL remedy; do not run it. Confirm function owner, trigger dependency and inherited privileges, preserve trigger behavior and verify in isolated DB.

## Acceptance
- Mocked fail-closed and SQL contract tests; no live database tests without approval. Exact-head CI and preview must be checked; a successful build is not release authorization.
- Independently verify AAL1/AAL2, suspended units/workspaces, expired/revoked subjects and actors, cross-tenant reads, direct REST bypass, recovery, rate limits, and session revocation with fictional identities. The existing roster policy may expose an inactive target whose projection was not maintained; require a reviewed target-status enforcement design before real use.
- Main protection, protected preview and production deployment approvals require separate settings review/authorization. Request independent Claude code/security/frontend review if available; do not claim it ran without evidence.
- No merge until all live acceptance gates pass and explicit owner approval is received.
