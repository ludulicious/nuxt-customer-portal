# @nuxt-customer-portal/authentication

## 0.4.9

### Patch Changes

- @nuxt-customer-portal/core@0.4.9
- @nuxt-customer-portal/ui@0.4.9

## 0.4.8

### Patch Changes

- @nuxt-customer-portal/core@0.4.8
- @nuxt-customer-portal/ui@0.4.8

## 0.4.7

### Patch Changes

- @nuxt-customer-portal/core@0.4.7
- @nuxt-customer-portal/ui@0.4.7

## 0.4.6

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/core@0.4.6
  - @nuxt-customer-portal/ui@0.4.6

## 0.4.5

### Patch Changes

- @nuxt-customer-portal/core@0.4.5
- @nuxt-customer-portal/ui@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [67b5b80]
  - @nuxt-customer-portal/core@0.4.4
  - @nuxt-customer-portal/ui@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [eb2a85c]
  - @nuxt-customer-portal/core@0.4.3
  - @nuxt-customer-portal/ui@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [0f05ccf]
  - @nuxt-customer-portal/ui@0.4.2
  - @nuxt-customer-portal/core@0.4.2

## 0.4.1

### Patch Changes

- Keep fresh SaaS portal registration on the organization bootstrap flow. Disable public personal-client self-registration by default while preserving invitation-only personal-client access.
- Updated dependencies
  - @nuxt-customer-portal/core@0.4.1
  - @nuxt-customer-portal/ui@0.4.1

## 0.4.0

### Minor Changes

- 59c8921: Support organization and personal clients with optional verified self-registration, single-person access safeguards, and shared provider, client, and user timezone preferences. Preserve existing B2B defaults, module references, invoice history, and Timesheets timezone behavior.

  Collect and store first and last names during signup and personal onboarding. Route ordinary personal registration and verified users without memberships or pending invitations through onboarding.

  Allow users to edit first name, last name, and an independent display name in profile settings.

  Synchronize display-name edits with the linked private client name and current billing name in the same transaction, preserving organizations and historical invoices.

  Let private clients edit their own billing address in profile settings, independently of the active organization, with server-side ownership checks.

  Private clients use their own invoice email without contact persons; hide contact management and reject private-client contact creation or selection server-side.

  Add a B2C-only Invite private client action to the Users page, supporting new and existing private clients with atomic record creation, request retry protection, and pending invitation recovery when email delivery fails.

### Patch Changes

- 59c8921: Allow SaaS administrators to configure allowed client types and personal self-registration in Portal Settings. Apply saved preferences to server authorization, onboarding, client forms and navigation, preserving configuration defaults for existing portals. Prevent disabling client types that still have records, including during concurrent creation.
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
  - @nuxt-customer-portal/ui@0.4.0

## 0.3.3

### Patch Changes

- @nuxt-customer-portal/core@0.3.3
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

## 0.3.1

### Patch Changes

- @nuxt-customer-portal/core@0.3.1
- @nuxt-customer-portal/ui@0.3.1

## 0.3.0

Declare the Nuxt UI dependency used by the package's public components and types,
so npm installations do not depend on another package's dependency layout.

### Patch Changes

- @nuxt-customer-portal/core@0.3.0
- @nuxt-customer-portal/ui@0.3.0
