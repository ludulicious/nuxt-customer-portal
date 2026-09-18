# @nuxt-customer-portal/saas-configuration

## 0.4.2

### Patch Changes

- 0f05ccf: Split portal general settings from appearance, add explicit Business and Soft Editorial starting styles, preserve legacy onboarding progress, and keep oversized centered forms vertically reachable.
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

- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.
- 59c8921: Allow SaaS administrators to configure allowed client types and personal self-registration in Portal Settings. Apply saved preferences to server authorization, onboarding, client forms and navigation, preserving configuration defaults for existing portals. Prevent disabling client types that still have records, including during concurrent creation.
- 59c8921: Add reusable appearance presets, validated typography and surface overrides, a light/dark live preview and optional full header logos. Apply saved branding reactively and preserve existing portals through backward-compatible defaults.
- 59c8921: Configure supported store content and SaaS interface languages using the shared bundled language list. Preserve disabled translations and switch unavailable UI locales to an enabled language.

### Patch Changes

- 59c8921: Add optional plannable service products with provider availability, Google Calendar and Zoom connections, 60-minute checkout reservations, appointment invitations, paid rescheduling, and policy-based cancellation refunds. Extend the product catalog and checkout integration while preserving ordinary purchases.
- 59c8921: Align Sharp with the Products layer so macOS development servers load one libvips runtime.
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

- 8496fe7: Add optional host-owned website pages during interactive setup and a safe `page copy` command for copying individual package-provided pages later.
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

### Minor Changes

- 3f2147e: Add an interactive init command that creates a standalone copy of the configurable
  portal, installs dependencies, and sets up a new database and administrator. Ship
  the configurable portal layer and its themes as a public package. Resolve preset
  manifests through their own dependencies so pnpm consumers need only install the
  selected packages.

### Patch Changes

- @nuxt-customer-portal/core@0.3.0
- @nuxt-customer-portal/ui@0.3.0
