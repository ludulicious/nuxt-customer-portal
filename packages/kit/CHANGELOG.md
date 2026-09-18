# @nuxt-customer-portal/kit

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

### Patch Changes

- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.

## 0.3.3

### Patch Changes

- 17432a1: Include standalone ESLint and Prettier configuration, dependencies, and working format commands in generated portals. Verify starter lint, formatting checks, and repeatable fixes when testing packed packages.
- 8496fe7: Add optional host-owned website pages during interactive setup and a safe `page copy` command for copying individual package-provided pages later.

## 0.3.2

### Patch Changes

- 5f60571: Make the PostgreSQL connection URL visible and editable during interactive setup, and show its format, an example, and guidance for database credentials and connection options.

## 0.3.1

### Patch Changes

- Fix starter generation on Node 24 by copying template entries into the empty destination without trying to copy over the destination directory itself. Existing files remain protected from overwriting.

## 0.3.0

### Minor Changes

- 3f2147e: Add an interactive init command that creates a standalone copy of the configurable
  portal, installs dependencies, and sets up a new database and administrator. Ship
  the configurable portal layer and its themes as a public package. Resolve preset
  manifests through their own dependencies so pnpm consumers need only install the
  selected packages.
