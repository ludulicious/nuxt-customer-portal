# @nuxt-customer-portal/administration

## 0.12.0

### Patch Changes

- Updated dependencies [24ed7df]
- Updated dependencies [cdda978]
- Updated dependencies [c64ed18]
  - @nuxt-customer-portal/core@0.12.0
  - @nuxt-customer-portal/ui@0.12.0

## 0.11.0

### Patch Changes

- b604141: Return actionable encryption configuration errors when saving a portal email API key, display the explanation in email settings, and log server failures through Nitro with secret-safe structured diagnostics, including database migration and connectivity hints.
- Updated dependencies [b604141]
  - @nuxt-customer-portal/core@0.11.0
  - @nuxt-customer-portal/ui@0.11.0

## 0.10.3

### Patch Changes

- Updated dependencies [0e54ff2]
  - @nuxt-customer-portal/ui@0.10.3
  - @nuxt-customer-portal/core@0.10.3

## 0.10.2

### Patch Changes

- c2985a7: Limit Email Texts to enabled portal languages and hide the selector for single-language portals. Use the configured control surface for subject and test-recipient fields, neutral actions, Markdown placeholder selectors and their menus, and link fields. Remove the duplicate Email Texts card heading.
- c2985a7: Move email provider and template configuration into Portal Settings tabs and give Email Texts a standalone administration page. Redirect existing email administration URLs to their new locations.
- c2985a7: Centralize portal surface styling so cards, inputs, rich-text editors, dialogs, and menus use the configured surface in both light and dark mode. Use Nuxt UI theme overrides and Tailwind rounding utilities while preserving native size variants and input padding. Keep neutral outline actions transparent and preserve branded selection states and the Brutal theme. Remove page-specific input background overrides and simplify nested Products form sections.
- Updated dependencies [c2985a7]
- Updated dependencies [c2985a7]
- Updated dependencies [c2985a7]
- Updated dependencies [c2985a7]
  - @nuxt-customer-portal/ui@0.10.2
  - @nuxt-customer-portal/core@0.10.2

## 0.10.1

### Patch Changes

- Updated dependencies [7c0f8df]
  - @nuxt-customer-portal/ui@0.10.1
  - @nuxt-customer-portal/core@0.10.1

## 0.10.0

### Patch Changes

- Updated dependencies [f115496]
- Updated dependencies [1235d0f]
- Updated dependencies [1235d0f]
  - @nuxt-customer-portal/core@0.10.0
  - @nuxt-customer-portal/ui@0.10.0

## 0.9.1

### Patch Changes

- Avoid generated API route type-inference limits in administration requests.

- @nuxt-customer-portal/core@0.9.1
- @nuxt-customer-portal/ui@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [936f0a2]
- Updated dependencies [6696fd0]
  - @nuxt-customer-portal/core@0.9.0
  - @nuxt-customer-portal/ui@0.9.0

## 0.8.9

### Patch Changes

- Updated dependencies [6cfe8bc]
  - @nuxt-customer-portal/core@0.8.9
  - @nuxt-customer-portal/ui@0.8.9

## 0.8.8

### Patch Changes

- @nuxt-customer-portal/core@0.8.8
- @nuxt-customer-portal/ui@0.8.8

## 0.8.7

### Patch Changes

- @nuxt-customer-portal/core@0.8.7
- @nuxt-customer-portal/ui@0.8.7

## 0.8.6

### Patch Changes

- @nuxt-customer-portal/core@0.8.6
- @nuxt-customer-portal/ui@0.8.6

## 0.8.5

### Patch Changes

- @nuxt-customer-portal/core@0.8.5
- @nuxt-customer-portal/ui@0.8.5

## 0.8.4

### Patch Changes

- Updated dependencies [170c58f]
  - @nuxt-customer-portal/core@0.8.4
  - @nuxt-customer-portal/ui@0.8.4

## 0.8.3

### Patch Changes

- Updated dependencies [351d35a]
  - @nuxt-customer-portal/ui@0.8.3
  - @nuxt-customer-portal/core@0.8.3

## 0.8.2

### Patch Changes

- @nuxt-customer-portal/core@0.8.2
- @nuxt-customer-portal/ui@0.8.2

## 0.8.1

### Patch Changes

- @nuxt-customer-portal/core@0.8.1
- @nuxt-customer-portal/ui@0.8.1

## 0.8.0

### Minor Changes

- 175854d: Support validated conditional sections in email texts and HTML templates, preserve conditional tags in the visual editor, and let administrators preview purchase emails with or without downloads.

### Patch Changes

- Updated dependencies [175854d]
- Updated dependencies [28bb7af]
  - @nuxt-customer-portal/core@0.8.0
  - @nuxt-customer-portal/ui@0.8.0

## 0.7.0

### Patch Changes

- @nuxt-customer-portal/core@0.7.0
- @nuxt-customer-portal/ui@0.7.0

## 0.6.1

### Patch Changes

- @nuxt-customer-portal/core@0.6.1
- @nuxt-customer-portal/ui@0.6.1

## 0.6.0

### Patch Changes

- @nuxt-customer-portal/core@0.6.0
- @nuxt-customer-portal/ui@0.6.0

## 0.5.1

### Patch Changes

- @nuxt-customer-portal/core@0.5.1
- @nuxt-customer-portal/ui@0.5.1

## 0.5.0

### Patch Changes

- 5beff82: Add a shared visual Markdown editor with a raw Markdown mode, protected special content, and English/Dutch formatting controls. Use it for product summaries/descriptions and email bodies/footers, including a picker for the selected email's available placeholders.
- Updated dependencies [5beff82]
  - @nuxt-customer-portal/ui@0.5.0
  - @nuxt-customer-portal/core@0.5.0

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

- Keep API-key expiry validation compatible with the Zod runtime resolved by Nuxt production bundles.
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

- 59c8921: Replace the Products-specific API key implementation with organization-owned Better Auth API keys. Restrict key ownership and use to the provider organization, restrict administration to system administrators, and let modules declare the API scopes administrators can assign.

  Move API-key management from Products store settings to a dedicated system Administration page.

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
