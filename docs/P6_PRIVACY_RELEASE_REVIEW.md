# QSwipe privacy and production acceptance review — DRAFT, not a legal certification
Only fictional test identities are permitted. No public employee onboarding until controller approval.

## Draft staging notice
QSwipe staging is a test system for attendance, corrections, independent manager review and access security. Use fictional identities only. An invited account is verified by email and managers use MFA. Attendance session identifiers, roster records, status, correction reasons, version numbers and decision metadata are used to support the attendance workflow. Authorized managers see only records in assigned units. Optional encrypted local drafts remain on the device after sign-out, require a separate passphrase and verified account to reopen, and are eligible for removal after seven days on unlock/sync. Users may delete an unlocked vault or clear browser site data. Forgotten passphrases and evicted browser storage are not recoverable. No automatic background sync. The controller must provide the final notice, lawful basis, contact and rights process before real data are used.

## Data lifecycle and controller gates
| Data | Purpose / minimization | Proposed disposition |
| --- | --- | --- |
| Email and MFA account | Identity verification; no contact details in roster responses | Controller defines account lifecycle and revocation |
| Roster and attendance | Authorized workforce administration; no location, biometrics or photos in these new endpoints | Approve local employment-record retention schedule |
| Correction and decision ledger | Accountability and rectification; enumerated reasons only | Define lawful retention and approved privileged purge/redaction; immutable application ledger is not indefinite legal retention |
| Local draft ciphertext | Explicit retry and offline recovery; no tokens, names or keys | Seven-day logical expiry on unlock/sync; unopened ciphertext may remain until site data cleared; no remote deletion guarantee |
| Provider logs and backups | Security and recovery | Document exact regions, processors, access, backup expiry, and restoration; no sensitive payload logging |

- Philippines: RA 10173 and IRR require transparent, legitimate and proportionate processing, appropriate safeguards, retention limits and rights procedures. Assign responsible controller/DPO; complete privacy impact assessment and breach response, verify NPC registration/notification obligations as applicable.
- EU/EEA where applicable: GDPR arts. 5, 6, 13–22, 28, 32, 33–35, 44–49 and 88; determine lawful basis and local employment requirements, processor agreements, transfers and safeguards. Do not rely on employee consent by default. Verify applicable local labor, workplace-monitoring and minors rules before each territory.
- Define access/export/rectification/objection/deletion request process, identity verification, deadlines, escalation, audit retention exceptions and documented destruction. No self-service data export/deletion backend is implemented by this PR.
- Confirm data controller/processor roles, legal entity, DPO/contact, region, subprocessors, contracts, incident reporting, backups and retention schedule. Obtain independent privacy and security approval before real use; this draft is not an effective production privacy notice.
- Accessibility target WCAG 2.2 AA: keyboard/focus, labels, target size, contrast, reduced motion and screen-reader acceptance. Automated browser checks are not full conformance.
- Security remaining: verify actual Supabase private schema exposure/roles/session semantics, OTP and API abuse limits, CSP headers on deployed preview, security advisor warnings, branch protection, dependency and privileged operator review, incident drills and actual iOS/Android browser tests. No paid resources or remote SQL authorized.

References: https://privacy.gov.ph/Data-Privacy-Act/ ; https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/ ; https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/ ; https://www.w3.org/TR/WCAG22/ .
