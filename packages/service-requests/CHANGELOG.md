# @nuxt-customer-portal/service-requests

## 0.3.2

### Patch Changes

- 903e0ce: Show service-request dashboard widgets after time and invoice widgets so daily work and billing take priority.
- 6994c36: Align customer and admin request lists with the portal collection toolbar, card layout, and fixed pagination footer. Preserve filters and sorting through detail navigation, support adjacent-page loading, and show scoped category choices independently of the current page.

  Repair request editing and deletion confirmation, add localized form validation, and provide working admin status, priority, provider-team assignment, and internal-note controls.

  Provide one request workspace with permission-aware management controls. Redirect legacy admin links while preserving collection state, and keep creation in the list header rather than the sidebar. Allow the dashboard body to shrink beneath the top bar so mobile pagination remains visible.

- 1b55b42: Place Service Requests after Invoices and before Administration in portal navigation.
- Updated dependencies [f23f664]
  - @nuxt-customer-portal/core@0.3.2
  - @nuxt-customer-portal/clients@0.3.2

## 0.3.1

### Patch Changes

- @nuxt-customer-portal/clients@0.3.1
- @nuxt-customer-portal/core@0.3.1

## 0.3.0

### Patch Changes

- @nuxt-customer-portal/clients@0.3.0
- @nuxt-customer-portal/core@0.3.0
