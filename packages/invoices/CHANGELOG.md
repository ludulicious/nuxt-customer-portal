# @nuxt-customer-portal/invoices

## 0.3.2

### Patch Changes

- Updated dependencies [d8c40f1]
- Updated dependencies [5dcf164]
- Updated dependencies [8815843]
- Updated dependencies [6994c36]
- Updated dependencies [f23f664]
  - @nuxt-customer-portal/ui@0.3.2
  - @nuxt-customer-portal/core@0.3.2
  - @nuxt-customer-portal/clients@0.3.2
  - @nuxt-customer-portal/organizations@0.3.2

## 0.3.1

### Patch Changes

- @nuxt-customer-portal/clients@0.3.1
- @nuxt-customer-portal/core@0.3.1
- @nuxt-customer-portal/organizations@0.3.1
- @nuxt-customer-portal/ui@0.3.1

## 0.3.0

### Minor Changes

- ca166fd: Extract invoices into an independent Nuxt layer and add an optional Timesheets source bridge.

  This removes the legacy `/timesheets/invoices`, `/admin/timesheets/invoices`, and Timesheets invoice API routes without redirects or delegates. Use `/invoices`, `/admin/invoices`, `/api/invoices`, and `/api/invoice-timesheets` instead.

### Patch Changes

- @nuxt-customer-portal/clients@0.3.0
- @nuxt-customer-portal/core@0.3.0
- @nuxt-customer-portal/organizations@0.3.0
- @nuxt-customer-portal/ui@0.3.0
