---
'@nuxt-customer-portal/invoice-timesheets': patch
'@nuxt-customer-portal/invoices': patch
---

Skip invoice source discovery when the Timesheets invoicing integration or its required modules are disabled, preventing misleading loading warnings for intentionally unavailable sources. Preserve standalone source discovery and warnings for genuine request failures.

Skip the invoice source-selection step when only free-form invoicing is available. Keep back navigation within the applicable steps and display the correct step count for the chosen flow.
