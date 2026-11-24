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

## Continuation: MFA and revocation tests (2026-11-24)

Starting head: 332bfac3b8dd994bc08decaadd6b7d6bfd3e68cf. No remote migrations or paid provisioning. Keep staging API fail-closed; no production merge. Main UI remains unchanged.

- Add provider TOTP factor discovery, manual-key enrollment, challenge and verify on the existing isolated page. Store only the returned access token in memory; never persist or log TOTP secrets, tokens or codes. No automatic factor deletion, recovery bypass or client-side role authorization. Lost device: sign out and contact the authorized staging administrator for identity-verified recovery. Verify again through the server after step-up. Use request locking and discard stale async results.
- Roster target membership must be active, within its time window, and in the same workspace even if its projection was not updated. Existing membership RLS intentionally hides other members, so a single narrowly scoped non-exposed SECURITY DEFINER boolean helper will check the actual roster row, caller active membership, exact unit grant and AAL2 (or self) plus target status. Fixed empty search path, fully qualified relations, no dynamic SQL, no public/anon execution. Retain existing invoker RLS checks as defense in depth. Review ownership and schema exposure before remote use.
- Run the actual candidate migration against a disposable PostgreSQL 17 service in GitHub Actions, with stub auth.uid()/auth.jwt() and fictional UUIDs. No cloud credentials, remote DB URLs or external tenant data. Assert direct authenticated role behavior, revoked/expired targets and actors, AAL1/AAL2, scope, anonymous access, write denial and reactivation rejection. This is SQL behavior evidence, not live Supabase Auth/PostgREST integration.
- Test mocked MFA transport and failure cases. Exact-head CI + Vercel build are mandatory. Real TOTP enrollment, verified token/session revocation, provider rate limits, independent review and protected preview browser acceptance remain pending until explicit isolated environment approval.
