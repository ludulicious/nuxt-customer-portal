---
'@nuxt-customer-portal/timesheets': patch
---

Clarify client approvals with one month filter for both hours to send and approval requests, compact review periods, hidden empty periods, explicit sending blockers, and no historical archive on the monthly screen.

Use the client’s Track hours module switch for new time entry, project choices, and review preparation, while preserving historical time and sent requests.

Allow an arbitrary starting month for review intervals when no recorded time or approval requests exist in that month or later, with transactional conflict protection and preservation of earlier schedules.

Show active hour-tracking clients as tags on the approvals page, with administrator controls to enable or disable tracking in place.

Include earlier submission-based approval decisions and unsubmitted hours in the selected monthly view, without duplicating already approved hours as unsent.

Show company avatars on monthly hours and approval request cards, falling back to logos or initials.

Send client approval requests only after an explicit manual action; internal approvals and submissions never create or email client requests automatically.

Show internally approved hours as Auto approved when the client does not require review, without duplicating them under hours to send.

Scope empty periods to active tracked clients and add a shared monthly client filter, with icons for both approval sections.

Reduce repetitive page explanations and shorten labels and empty states in English and Dutch.

Prepare each selected month in async setup and retain the previous view with Suspense to avoid intermediate loading layout shifts.
