---
'@nuxt-customer-portal/timesheets': patch
---

Only include submitted or internally approved timesheets in client approval preparation and sending. Draft, reopened, and rejected timesheets no longer appear as awaiting internal approval or block sending other submitted work.

Default client approval periods to monthly when no interval is configured, grouping submitted weeks and partial weeks by work date. Preserve explicitly configured weekly, fortnightly, and monthly intervals.
