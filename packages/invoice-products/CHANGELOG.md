# Product invoices

## 0.4.8

### Patch Changes

- @nuxt-customer-portal/core@0.4.8
- @nuxt-customer-portal/invoices@0.4.8
- @nuxt-customer-portal/products@0.4.8

## 0.4.7

### Patch Changes

- @nuxt-customer-portal/core@0.4.7
- @nuxt-customer-portal/invoices@0.4.7
- @nuxt-customer-portal/products@0.4.7

## 0.4.6

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/core@0.4.6
  - @nuxt-customer-portal/invoices@0.4.6
  - @nuxt-customer-portal/products@0.4.6

## 0.4.5

### Patch Changes

- @nuxt-customer-portal/core@0.4.5
- @nuxt-customer-portal/invoices@0.4.5
- @nuxt-customer-portal/products@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [a85ce7a]
- Updated dependencies [67b5b80]
- Updated dependencies [2a4b4d3]
  - @nuxt-customer-portal/products@0.4.4
  - @nuxt-customer-portal/core@0.4.4
  - @nuxt-customer-portal/invoices@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [eb2a85c]
  - @nuxt-customer-portal/core@0.4.3
  - @nuxt-customer-portal/products@0.4.3
  - @nuxt-customer-portal/invoices@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/core@0.4.2
  - @nuxt-customer-portal/invoices@0.4.2
  - @nuxt-customer-portal/products@0.4.2

## 0.4.1

### Patch Changes

- Keep fresh SaaS portal registration on the organization bootstrap flow. Disable public personal-client self-registration by default while preserving invitation-only personal-client access.
- Updated dependencies
  - @nuxt-customer-portal/core@0.4.1
  - @nuxt-customer-portal/invoices@0.4.1
  - @nuxt-customer-portal/products@0.4.1

## 0.4.0

### Minor Changes

- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.
- 59c8921: Replace the unused single-product purchase record with multi-item-ready orders, order lines, carts, and cart lines while preserving the current one-product checkout experience. Generate invoice lines from immutable order lines.

### Patch Changes

- 59c8921: Send one appointment confirmation instead of an additional generic purchase email, and queue automated invoice delivery for five minutes after checkout.
- 59c8921: Use compact currency symbols in invoice PDFs and give future product invoices a localized purchase-reference subject distinct from their product line descriptions.
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
- Updated dependencies [59c8921]
  - @nuxt-customer-portal/core@0.4.0
  - @nuxt-customer-portal/products@0.4.0
  - @nuxt-customer-portal/invoices@0.4.0

## Unreleased

- Reconcile product payments into portal invoices and refund credit notes with exact checkout totals.
