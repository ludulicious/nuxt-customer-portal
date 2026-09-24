# Changelog

## 0.4.6

### Patch Changes

- Allow authenticated Google Calendar channel notifications through the public webhook boundary, retain provider-returned availability event IDs, expose those IDs in synchronization diagnostics, and remove the planning policy lint warning.
- Updated dependencies
  - @nuxt-customer-portal/core@0.4.6
  - @nuxt-customer-portal/products@0.4.6
  - @nuxt-customer-portal/ui@0.4.6

## 0.4.5

### Patch Changes

- Allow providers to save a primary calendar without selecting any additional conflict calendars.
  - @nuxt-customer-portal/core@0.4.5
  - @nuxt-customer-portal/products@0.4.5
  - @nuxt-customer-portal/ui@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [a85ce7a]
- Updated dependencies [67b5b80]
- Updated dependencies [2a4b4d3]
  - @nuxt-customer-portal/products@0.4.4
  - @nuxt-customer-portal/core@0.4.4
  - @nuxt-customer-portal/ui@0.4.4

## 0.4.3

### Patch Changes

- eb2a85c: Add a single base64-encoded `PORTAL_ENCRYPTION_KEY` that derives isolated keys for credentials saved by Portal Core, Products, and Planning. Existing module-specific keys remain supported as overrides and can decrypt their legacy ciphertext formats.
- Keep planning date and identifier validation compatible with the Zod runtime resolved by Nuxt production bundles.
- Updated dependencies [eb2a85c]
  - @nuxt-customer-portal/core@0.4.3
  - @nuxt-customer-portal/products@0.4.3
  - @nuxt-customer-portal/ui@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/core@0.4.2
  - @nuxt-customer-portal/products@0.4.2
  - @nuxt-customer-portal/ui@0.4.2

## 0.4.1

### Patch Changes

- Keep fresh SaaS portal registration on the organization bootstrap flow. Disable public personal-client self-registration by default while preserving invitation-only personal-client access.
- Updated dependencies
  - @nuxt-customer-portal/core@0.4.1
  - @nuxt-customer-portal/products@0.4.1
  - @nuxt-customer-portal/ui@0.4.1

## 0.4.0

### Minor Changes

- 59c8921: Add an organization-scoped, searchable and paginated synchronization task dashboard with activity sorting and individual retry actions.
- 59c8921: Guide providers through connecting and fixing a writable main calendar before choosing optional conflict calendars, and show those calendars' busy periods in the availability view, including external events from the main calendar. Availability events now use a configurable calendar title and list the applicable products in their description. Sandbox bookings skip meeting-provider creation while still syncing appointments to the main calendar when development effects are enabled.
- 59c8921: Add optional plannable service products with provider availability, Google Calendar and Zoom connections, 60-minute checkout reservations, appointment invitations, paid rescheduling, and policy-based cancellation refunds. Extend the product catalog and checkout integration while preserving ordinary purchases.

### Patch Changes

- 59c8921: Share appointment time formatting across Planning and checkout, respecting browser locale preferences and displaying midnight concisely.

  Present checkout booking details with distinct date, time, and provider rows and a stable live reservation countdown.

- 59c8921: Reduce scheduled calendar repair frequency, avoid rewriting existing Zoom meetings during repair, and defer Zoom rate-limit retries until the next UTC day.
- 59c8921: Allow admins to configure maximum displayed appointment start-time spacing alongside minimum notice and start interval. Apply clock-aligned spacing server-side and default existing policies to 30 minutes.
- 59c8921: Let customers select and review a booking time before explicitly continuing to checkout. Reserve only on confirmation and clear the selection when the date, timezone, provider, month, or currency changes.
- 59c8921: Keep the selected appointment and checkout action together beneath a stable calendar workspace on desktop and in a safe-area-aware pinned bar on mobile. Compact the mobile offering summary and let customers move between the full calendar and an animated time-selection panel at every screen size, with reduced-motion support.
- 59c8921: Add role-aware planning dashboard cards for upcoming appointments, schedule totals, conflicts, and common actions.
- 59c8921: Present purchased files as reusable document cards, add them to appointment and purchase detail drawers, and use compact purchase cards in a fixed-toolbar collection layout.
- 59c8921: Release unpaid booking holds before returning to time selection. Atomically replace the previous hold when choosing another time in the same tab, preserving it if the new slot cannot be reserved. Session-bound credentials cannot release confirmed bookings or holds attached to an order.
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
  - @nuxt-customer-portal/ui@0.4.0

## Unreleased

- Add plannable services, availability, calendar connections, reservations and appointment management.
