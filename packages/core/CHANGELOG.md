# @nuxt-customer-portal/core

## 0.4.6

### Patch Changes

- Allow authenticated Google Calendar channel notifications through the public webhook boundary, retain provider-returned availability event IDs, and expose those IDs in synchronization diagnostics.

## 0.4.5

## 0.4.4

### Patch Changes

- 67b5b80: Assemble authenticated OpenAPI documents through Nitro's local request context so HTTPS frontends do not break the raw schema request.

## 0.4.3

### Patch Changes

- eb2a85c: Add a single base64-encoded `PORTAL_ENCRYPTION_KEY` that derives isolated keys for credentials saved by Portal Core, Products, and Planning. Existing module-specific keys remain supported as overrides and can decrypt their legacy ciphertext formats.

## 0.4.2

## 0.4.1

### Patch Changes

- Keep fresh SaaS portal registration on the organization bootstrap flow. Disable public personal-client self-registration by default while preserving invitation-only personal-client access.

## 0.4.0

### Minor Changes

- 59c8921: Support organization and personal clients with optional verified self-registration, single-person access safeguards, and shared provider, client, and user timezone preferences. Preserve existing B2B defaults, module references, invoice history, and Timesheets timezone behavior.

  Collect and store first and last names during signup and personal onboarding. Route ordinary personal registration and verified users without memberships or pending invitations through onboarding.

  Allow users to edit first name, last name, and an independent display name in profile settings.

  Synchronize display-name edits with the linked private client name and current billing name in the same transaction, preserving organizations and historical invoices.

  Let private clients edit their own billing address in profile settings, independently of the active organization, with server-side ownership checks.

  Private clients use their own invoice email without contact persons; hide contact management and reject private-client contact creation or selection server-side.

  Add a B2C-only Invite private client action to the Users page, supporting new and existing private clients with atomic record creation, request retry protection, and pending invitation recovery when email delivery fails.

- 59c8921: Replace the Products-specific API key implementation with organization-owned Better Auth API keys. Restrict key ownership and use to the provider organization, restrict administration to system administrators, and let modules declare the API scopes administrators can assign.

  Move API-key management from Products store settings to a dedicated system Administration page.

- 59c8921: Allow SaaS administrators to configure allowed client types and personal self-registration in Portal Settings. Apply saved preferences to server authorization, onboarding, client forms and navigation, preserving configuration defaults for existing portals. Prevent disabling client types that still have records, including during concurrent creation.
- 59c8921: Configure supported store content and SaaS interface languages using the shared bundled language list. Preserve disabled translations and switch unavailable UI locales to an enabled language.

### Patch Changes

- 59c8921: Share appointment time formatting across Planning and checkout, respecting browser locale preferences and displaying midnight concisely.

  Present checkout booking details with distinct date, time, and provider rows and a stable live reservation countdown.

- 59c8921: Restore anonymous booking availability and session-bound hold operations through the authentication gate. Preserve endpoint rate limits, origin checks, and reservation credentials.
- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.
- 59c8921: Store the sender country as structured invoice data, show it in invoice settings, and preserve it on generated invoices.

## 0.3.3

## 0.3.2

### Patch Changes

- f23f664: Add opt-in server restrictions for shared demo deployments, protecting accounts and access settings and preventing all outgoing email. The private example apps now support anonymous sample identities, shared historical business data, user switching, and transactional daily resets at midnight Europe/Amsterdam.

## 0.3.1

## 0.3.0

Declare the Nuxt UI dependency used by the package's public components and types,
so npm installations do not depend on another package's dependency layout.
