# QSwipe — Profile and manager workflows (demo)

## What's new

The responsive Profile page gives a sample user a display name, position, short introduction, role/organization summary, reporting line, and JPG/PNG/WebP avatar preview (max 2 MB). Profile text is saved in local browser storage. Photo previews are object URLs **kept only for the current tab session**; images are never uploaded. For the sample member, the name and picture also appear on attendance and team cards. Do not enter real personnel information.

The Manager page adds a role-scoped roster, date/team filter, unresolved check-ins, staffing coverage summary, an approval inbox, scoped announcements, team assignments, status export, audit timeline and target editing. The level model is:

| Demo identity | Reads | Actions |
| --- | --- | --- |
| Member | Own demo attendance / profile | Check in, submit correction and leave requests |
| Level 1 / Team Leader | Assigned team only | Swipe unmarked attendance, review team requests, announce, view reports |
| Level 2 / Operations | All sample teams | Level 1 actions plus CSV export, team reassignment and audit view |
| Level 3 / Director | All sample teams | Level 2 actions plus staffing target editing |

A manager's scope is applied again in each write handler, not only in page visibility. Existing check-ins are not silently overridden: managers must approve an explicit correction request. Leave approval is separate from Absent. Repeated pending requests for the same person/type/date are rejected. Audit records store the actor, action, subject, and timestamp (locally, for illustration).

## Test walkthrough

1. In the top-right **Demo role** selector choose **Member**; open **Profile** using the nav or avatar, change the sample name and job title, then save. Verify that the member portrait card and team roster show the name.
2. As Member, mark Present for the date and submit a correction request to Absent through Profile. Choose Level 1, open Manager, approve the request, then check the attendance register. Approving an existing check-in directly is not supported; the correction request is the audited path.
3. As Level 1, verify only the primary group can be reviewed and that export and team assignment controls are unavailable.
4. As Level 2, verify organization-wide roster, team transfers, CSV export and audit. As Level 3, adjust the staffing target.
5. Change between the BPO, School, Government and Custom workspaces; verify the first-level manager only sees their group's sample people.
6. On phones, check bottom-nav horizontal scrolling; verify all controls have keyboard-accessible alternatives, and test reduced-motion preferences.

## Production blockers

**This feature is not role-based authentication.** The role selector is a visual demo switch and localStorage is not a protected storage mechanism. The private `chatgpt.site` deployment remains separate from this GitHub repository. No employee/student data, regulated personal records or live personnel approvals should be put in the demo.

Before an operational release, implement identity-provider login, invitation and membership workflows, organizational assignment policy, backend-enforced RBAC/RLS, per-tenant isolation, atomic attendance transactions, server-side audit trails and record versioning, review notifications, profile/avatar storage policies, immutable audit export, retention/deletion processes, and real-device accessibility/security testing. Do not wire this demo up to real people or production backends without those gates.
