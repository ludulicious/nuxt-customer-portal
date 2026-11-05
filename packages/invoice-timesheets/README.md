# `@nuxt-customer-portal/invoice-timesheets`

Optional integration that creates invoices from approved, billable Timesheets entries.

For SaaS portals, enable **Invoice from timesheets** in **Portal settings → Modules**, together with **Invoices** and **Timesheets**. Installing the integration layer alone does not enable it. Disabled integrations are omitted from invoice source choices without making a blocked API request or showing a source-loading warning. Standalone hosts without SaaS module settings continue to load the source normally.
