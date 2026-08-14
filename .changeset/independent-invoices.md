---
'@nuxt-customer-portal/timesheets': major
'@nuxt-customer-portal/invoices': minor
'@nuxt-customer-portal/invoice-timesheets': minor
---

Extract invoices into an independent Nuxt layer and add an optional Timesheets source bridge.

This removes the legacy `/timesheets/invoices`, `/admin/timesheets/invoices`, and Timesheets invoice API routes without redirects or delegates. Use `/invoices`, `/admin/invoices`, `/api/invoices`, and `/api/invoice-timesheets` instead.
