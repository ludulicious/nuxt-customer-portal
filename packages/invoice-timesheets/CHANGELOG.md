# @nuxt-customer-portal/invoice-timesheets

## 0.3.1

### Patch Changes

- @nuxt-customer-portal/core@0.3.1
- @nuxt-customer-portal/invoices@0.3.1
- @nuxt-customer-portal/timesheets@0.3.1

## 0.3.0

### Minor Changes

- ca166fd: Extract invoices into an independent Nuxt layer and add an optional Timesheets source bridge.

  This removes the legacy `/timesheets/invoices`, `/admin/timesheets/invoices`, and Timesheets invoice API routes without redirects or delegates. Use `/invoices`, `/admin/invoices`, `/api/invoices`, and `/api/invoice-timesheets` instead.

### Patch Changes

- Updated dependencies [ca166fd]
  - @nuxt-customer-portal/timesheets@0.3.0
  - @nuxt-customer-portal/invoices@0.3.0
  - @nuxt-customer-portal/core@0.3.0
