# @nuxt-customer-portal/saas-configuration

## 0.10.1

### Patch Changes

- 7c0f8df: Edit localized terms and privacy policies with the shared Markdown editor, render sanitized Markdown on legal pages, and add subtle localized links to the sidebar footer in expanded and collapsed modes.
- Updated dependencies [7c0f8df]
  - @nuxt-customer-portal/ui@0.10.1
  - @nuxt-customer-portal/core@0.10.1

## 0.10.0

### Minor Changes

- 1235d0f: Let portal administrators upload separate desktop and mobile authentication backgrounds in Appearance settings. Add responsive image selection, single-image fallback, preview and removal controls, validated image uploads, and English/Dutch descriptions. Keep existing settings compatible. Position authentication forms near the top on mobile while preserving desktop positioning, with or without a background image.

### Patch Changes

- 1235d0f: Redirect the portal home route to `/dashboard` instead of showing the public landing page. Preserve dashboard authentication, onboarding, and saved homepage content. Send portal logout directly to `/login` instead of the home route, and remove the home back button from authentication pages.

  Use a neutral welcome heading on the sign-in page in English and Dutch so it also welcomes first-time visitors.

  Show translated email and password prompts instead of technical validation errors when sign-in fields are empty or missing.

- Updated dependencies [f115496]
- Updated dependencies [1235d0f]
- Updated dependencies [1235d0f]
  - @nuxt-customer-portal/core@0.10.0
  - @nuxt-customer-portal/ui@0.10.0

## 0.9.1

### Patch Changes

- @nuxt-customer-portal/core@0.9.1
- @nuxt-customer-portal/ui@0.9.1

## 0.9.0

### Patch Changes

- 936f0a2: Add an authenticated store media library with Studio-style image editing, batch review, independent thumbnails, retained originals, and scoped API-key access using existing storage providers. Product images remain unchanged.

  Support configurable store media variants with automatic generation, independent custom crops, and preset changes applied when each image is next saved. Existing thumbnails migrate as custom sources and product image policies remain unchanged.

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

- 24b23e1: Use the portal's full logo on checkout, order and thank-you pages unless a checkout logo overrides it. Align receipt logos left and add space below store settings tabs.

  Open admin orders in a regular portal page with customer, client, payment and fulfillment details while preserving separate public customer links.
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

- 959056e: Initialize a disabled sandbox Products store when Products is enabled during portal setup so Planning works on fresh deployments without a separate Store settings save.
- Updated dependencies [eb2a85c]
  - @nuxt-customer-portal/core@0.4.3
  - @nuxt-customer-portal/ui@0.4.3

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
