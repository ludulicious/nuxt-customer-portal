---
'@nuxt-customer-portal/kit': minor
'@nuxt-customer-portal/timesheets': minor
'@nuxt-customer-portal/invoices': minor
'@nuxt-customer-portal/invoice-timesheets': patch
---

Add reusable Harvest export and one-time migration commands with read-only previews, explicit member/client mappings, invoice and payment reconciliation, atomic imports, and duplicate protection.

Preserve distinct disabled historical users, credit and written-off invoices, original invoice lifecycle events and source metadata. Track externally billed time independently of invoice links to prevent edits and rebilling. Disambiguate duplicate project names and consolidate duplicate contact email records with explicit provenance. Apply the Timesheets and Invoices history migrations before importing.
