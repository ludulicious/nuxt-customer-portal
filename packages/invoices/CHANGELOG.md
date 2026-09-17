# @nuxt-customer-portal/invoices

## 0.4.0

### Minor Changes

- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.
- 59c8921: Replace the unused single-product purchase record with multi-item-ready orders, order lines, carts, and cart lines while preserving the current one-product checkout experience. Generate invoice lines from immutable order lines.

### Patch Changes

- 59c8921: Use compact currency symbols in invoice PDFs and give future product invoices a localized purchase-reference subject distinct from their product line descriptions.
- 59c8921: Support organization and personal clients with optional verified self-registration, single-person access safeguards, and shared provider, client, and user timezone preferences. Preserve existing B2B defaults, module references, invoice history, and Timesheets timezone behavior.

  Collect and store first and last names during signup and personal onboarding. Route ordinary personal registration and verified users without memberships or pending invitations through onboarding.

  Allow users to edit first name, last name, and an independent display name in profile settings.

  Synchronize display-name edits with the linked private client name and current billing name in the same transaction, preserving organizations and historical invoices.

  Let private clients edit their own billing address in profile settings, independently of the active organization, with server-side ownership checks.

  Private clients use their own invoice email without contact persons; hide contact management and reject private-client contact creation or selection server-side.

  Add a B2C-only Invite private client action to the Users page, supporting new and existing private clients with atomic record creation, request retry protection, and pending invitation recovery when email delivery fails.

- 59c8921: Store the sender country as structured invoice data, show it in invoice settings, and preserve it on generated invoices.
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
  - @nuxt-customer-portal/clients@0.4.0
  - @nuxt-customer-portal/organizations@0.4.0
  - @nuxt-customer-portal/ui@0.4.0

## 0.3.3

### Patch Changes

- @nuxt-customer-portal/clients@0.3.3
- @nuxt-customer-portal/core@0.3.3
- @nuxt-customer-portal/organizations@0.3.3
- @nuxt-customer-portal/ui@0.3.3

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
