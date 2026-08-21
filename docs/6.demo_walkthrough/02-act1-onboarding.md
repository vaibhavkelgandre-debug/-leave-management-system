# Act I — Onboarding a new employee

> Part of the [Demo Walkthrough](README.md). ~6 minutes. Windows A/B (admin) and D (the new employee).

**The story**: a person joins. Their account exists immediately, but nobody trusts it until a human has checked their
documents against what they typed.

---

## Scene 1 — Invite them (window B, HR)

**Go to** `/dashboard/employees/new` — *Add Employee*. From `/dashboard/team` (My Team) for HR, or
`/dashboard/employees` (All Employees) for the super admin.

Fill in name, email, role `EMPLOYEE`, and pick a manager.

> **Say**: "The manager dropdown only offers people who could legitimately be this person's manager. An employee can
> report to a manager or an HR admin; a manager only to an HR admin. That's enforced on the server too — the dropdown
> is a convenience, not the rule."

**Click Invite.** You get a green panel: *"Invited. We emailed the link to …"* plus the link itself as a fallback.

> **Say**: "Two things happened. The account exists now, in an `INVITED` state — they can't log in, they have no
> password. And an email went out with a single-use link that expires in 12 hours."

**If the panel is amber** — *"Invited, but the email wasn't sent"* — the account was still created and the link still
works. Read it as designed behaviour, because it is:

> **Say**: "Mail is a side effect, not part of the transaction. The account, their leave balances and the invitation
> row all committed before the email was attempted, so a mail outage can never cost you the employee you just created.
> The UI promotes the link instead."

**Copy the link.**

## Scene 2 — They accept (window D, logged out)

**Paste the link** — `/invite/:token`. They set their own password.

> **Say**: "HR never sees or sets this password. The token is stored only as a SHA-256 hash, and it's single-use — the
> row is marked accepted the moment it's used."

They land on the dashboard. Point at the notification bell.

> **Say**: "They already have a notification telling them what to do next: fill in your profile and upload your
> documents. That's generated the moment their account becomes active, rather than leaving a new joiner staring at an
> empty dashboard."

## Scene 3 — Profile and documents (window D)

**Go to** `/dashboard/profile`. Fill in the required fields. Upload the four required documents: **PAN card, Aadhaar
card, bank passbook, offer letter**.

> **Say**: "Four documents are required. They can also upload extras — real onboarding always has a fifth document
> nobody anticipated — but only these four gate anything."

**Click Submit for verification.** Then, to show a guard, try submitting with a field blank first:

> **Say**: "It won't submit half-finished, and it names exactly what's missing rather than saying 'invalid'."

## Scene 4 — HR reviews each document (window B)

**Go to** `/dashboard/profile-verification`, then open the new employee — `/dashboard/profile-verification/:id`.

**Open a document.** It previews inline; it doesn't download.

> **Say**: "That preview is less trivial than it looks. The files live in Cloudinary as raw assets, and Cloudinary
> serves those with a header that forces a download — so a direct link could never preview. The server fetches the
> bytes and re-serves them with our own headers. Someone whose job is looking at documents shouldn't have to download
> each one first."

**Now the moment worth building the act around.** Review the documents, and **reject one** with a reason — say the name
on the PAN card doesn't match the profile.

**Then click Verify Profile.** It refuses, and names the document.

> **Say**: "HR can't verify past a document a human rejected. And it can't verify while any of the four is simply
> unreviewed either — a missed document is impossible, not just discouraged."

**Click Send Back**, with the reason.

> **Say**: "The reason is required and it's stored on the employee's record, not just logged. Being told 'your profile
> was returned' without being told what was wrong just produces a resubmission of the same thing."

## Scene 5 — Fix and verify (windows D then B)

**Window D**: the employee sees the notification with the reason. Re-upload the corrected document.

> **Say**: "And they can't just resubmit without fixing it — submitting again while a document is still rejected is
> blocked at submit time, where it's actionable, rather than at HR's Verify button where it isn't."

**Window B**: review the replaced document, mark it verified, **Verify Profile**. It goes through.

> **Say**: "Now they're verified — which matters because verification is a precondition for payroll. That's Act III."

---

## What you just demonstrated

| Guard | Where |
|---|---|
| A reporting line must be legal | invite form + server |
| A profile can't be submitted incomplete | `REQUIRED_PROFILE_FIELDS` |
| All four documents must exist to submit | `REQUIRED_DOCUMENT_TYPES` |
| Every document must be individually verified | `assertRequiredDocumentsVerified` |
| A rejected document blocks verification | `assertNoRejectedDocuments` |
| A send-back must carry a reason | `sendProfileBackSchema` |
| Mail failure never fails the request | invitation service |

Full technical detail: [`architecture/08-workflow-documents-and-verification.md`](../architecture/08-workflow-documents-and-verification.md).

**Next**: [Act II — Applying for and deciding leave](03-act2-leave.md).
