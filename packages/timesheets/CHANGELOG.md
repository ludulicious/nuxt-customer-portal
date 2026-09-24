# @nuxt-customer-portal/timesheets

## 0.4.8

### Patch Changes

- @nuxt-customer-portal/clients@0.4.8
- @nuxt-customer-portal/core@0.4.8
- @nuxt-customer-portal/organizations@0.4.8
- @nuxt-customer-portal/ui@0.4.8

## 0.4.7

### Patch Changes

- @nuxt-customer-portal/clients@0.4.7
- @nuxt-customer-portal/core@0.4.7
- @nuxt-customer-portal/organizations@0.4.7
- @nuxt-customer-portal/ui@0.4.7

## 0.4.6

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/core@0.4.6
  - @nuxt-customer-portal/clients@0.4.6
  - @nuxt-customer-portal/organizations@0.4.6
  - @nuxt-customer-portal/ui@0.4.6

## 0.4.5

### Patch Changes

- @nuxt-customer-portal/clients@0.4.5
- @nuxt-customer-portal/core@0.4.5
- @nuxt-customer-portal/organizations@0.4.5
- @nuxt-customer-portal/ui@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [67b5b80]
  - @nuxt-customer-portal/core@0.4.4
  - @nuxt-customer-portal/clients@0.4.4
  - @nuxt-customer-portal/organizations@0.4.4
  - @nuxt-customer-portal/ui@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [eb2a85c]
  - @nuxt-customer-portal/core@0.4.3
  - @nuxt-customer-portal/clients@0.4.3
  - @nuxt-customer-portal/organizations@0.4.3
  - @nuxt-customer-portal/ui@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [0f05ccf]
  - @nuxt-customer-portal/ui@0.4.2
  - @nuxt-customer-portal/clients@0.4.2
  - @nuxt-customer-portal/core@0.4.2
  - @nuxt-customer-portal/organizations@0.4.2

## 0.4.1

### Patch Changes

- Keep fresh SaaS portal registration on the organization bootstrap flow. Disable public personal-client self-registration by default while preserving invitation-only personal-client access.
- Updated dependencies
  - @nuxt-customer-portal/clients@0.4.1
  - @nuxt-customer-portal/core@0.4.1
  - @nuxt-customer-portal/organizations@0.4.1
  - @nuxt-customer-portal/ui@0.4.1

## 0.4.0

### Patch Changes

- 59c8921: Support organization and personal clients with optional verified self-registration, single-person access safeguards, and shared provider, client, and user timezone preferences. Preserve existing B2B defaults, module references, invoice history, and Timesheets timezone behavior.

  Collect and store first and last names during signup and personal onboarding. Route ordinary personal registration and verified users without memberships or pending invitations through onboarding.

  Allow users to edit first name, last name, and an independent display name in profile settings.

  Synchronize display-name edits with the linked private client name and current billing name in the same transaction, preserving organizations and historical invoices.

  Let private clients edit their own billing address in profile settings, independently of the active organization, with server-side ownership checks.

  Private clients use their own invoice email without contact persons; hide contact management and reject private-client contact creation or selection server-side.

  Add a B2C-only Invite private client action to the Users page, supporting new and existing private clients with atomic record creation, request retry protection, and pending invitation recovery when email delivery fails.

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

### Major Changes

- ca166fd: Extract invoices into an independent Nuxt layer and add an optional Timesheets source bridge.

  This removes the legacy `/timesheets/invoices`, `/admin/timesheets/invoices`, and Timesheets invoice API routes without redirects or delegates. Use `/invoices`, `/admin/invoices`, `/api/invoices`, and `/api/invoice-timesheets` instead.

### Patch Changes

- @nuxt-customer-portal/clients@0.3.0
- @nuxt-customer-portal/core@0.3.0
- @nuxt-customer-portal/organizations@0.3.0
- @nuxt-customer-portal/ui@0.3.0
