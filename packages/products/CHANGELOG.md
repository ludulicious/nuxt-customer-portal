# Products

## 0.4.3

### Patch Changes

- eb2a85c: Add a single base64-encoded `PORTAL_ENCRYPTION_KEY` that derives isolated keys for credentials saved by Portal Core, Products, and Planning. Existing module-specific keys remain supported as overrides and can decrypt their legacy ciphertext formats.
- Keep product request and route validation compatible with the Zod runtime resolved by Nuxt production bundles.
- Updated dependencies [eb2a85c]
  - @nuxt-customer-portal/core@0.4.3
  - @nuxt-customer-portal/clients@0.4.3
  - @nuxt-customer-portal/ui@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/clients@0.4.2
  - @nuxt-customer-portal/core@0.4.2
  - @nuxt-customer-portal/ui@0.4.2

## 0.4.1

### Patch Changes

- Keep fresh SaaS portal registration on the organization bootstrap flow. Disable public personal-client self-registration by default while preserving invitation-only personal-client access.
- Updated dependencies
  - @nuxt-customer-portal/clients@0.4.1
  - @nuxt-customer-portal/core@0.4.1
  - @nuxt-customer-portal/ui@0.4.1

## 0.4.0

### Minor Changes

- 59c8921: Move categories to their own admin page with unique codes, localized names and descriptions, search, sorting, pagination, and inline editing. Migrate existing product links and preserve category creation from product forms.
- 59c8921: Add optional plannable service products with provider availability, Google Calendar and Zoom connections, 60-minute checkout reservations, appointment invitations, paid rescheduling, and policy-based cancellation refunds. Extend the product catalog and checkout integration while preserving ordinary purchases.
- 59c8921: Move product category assignments from JSON to a store-scoped category_id foreign key. Use categoryId in product APIs and forms, preserving existing assignments and historical order snapshots.
- 59c8921: Add encrypted S3-compatible and proprietary Bunny Storage API settings, tested storage connections, a product media library with crop, preview, ordering, removal and placement controls, normalized image uploads, and responsive ImageKit delivery through Nuxt Image.
- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.
- 59c8921: Configure store currencies, require complete paid-product pricing, and support free products without payment or invoices.
- 59c8921: Replace the Products-specific API key implementation with organization-owned Better Auth API keys. Restrict key ownership and use to the provider organization, restrict administration to system administrators, and let modules declare the API scopes administrators can assign.

  Move API-key management from Products store settings to a dedicated system Administration page.

- 59c8921: Configure supported store content and SaaS interface languages using the shared bundled language list. Preserve disabled translations and switch unavailable UI locales to an enabled language.
- 59c8921: Allow administrators to configure encrypted Stripe credentials in Store settings when Stripe is not managed by the deployment environment.
- 59c8921: Replace the unused single-product purchase record with multi-item-ready orders, order lines, carts, and cart lines while preserving the current one-product checkout experience. Generate invoice lines from immutable order lines.

### Patch Changes

- 59c8921: Share appointment time formatting across Planning and checkout, respecting browser locale preferences and displaying midnight concisely.

  Present checkout booking details with distinct date, time, and provider rows and a stable live reservation countdown.

- 59c8921: Allow admins to configure maximum displayed appointment start-time spacing alongside minimum notice and start interval. Apply clock-aligned spacing server-side and default existing policies to 30 minutes.
- 59c8921: Send one appointment confirmation instead of an additional generic purchase email, and queue automated invoice delivery for five minutes after checkout.
- 59c8921: Allow incomplete draft pricing until publication, keep prices out of Basic details, and prevent published products from switching between free and paid.
- 59c8921: Present expired checkout reservations as a calm, clearly grouped message with a time-selection action that preserves the offering return link.
- 59c8921: Add optional H1–H6 color overrides with Nuxt UI color pickers and a preview of all heading levels. Empty overrides inherit the shared heading color.
- 59c8921: Require a publish checklist and confirmation with complete store-language content, a product image, and all paid currency prices. Enforce required checks on the server and show closed-store warnings before confirmation.
- 59c8921: Add optional subtitles per product language, editable with product information and displayed below the name in the admin preview and storefront. Include subtitles in the catalog response and accept existing content without them.
- 59c8921: Replace generic product form validation errors with specific English and Dutch guidance for required fields, formats, limits, pricing, and store selections.
- 59c8921: Add a sandbox store environment with simulated paid, failed, and expired checkout outcomes before Stripe is configured.
- 59c8921: Present purchased files as reusable document cards, add them to appointment and purchase detail drawers, and use compact purchase cards in a fixed-toolbar collection layout.
- 59c8921: Release unpaid booking holds before returning to time selection. Atomically replace the previous hold when choosing another time in the same tab, preserving it if the new slot cannot be reserved. Session-bound credentials cannot release confirmed bookings or holds attached to an order.
- 59c8921: Simplify product creation to name, generated editable slug, type, category, and free/paid selection. Open the details page after saving and initialize paid drafts with zero prices per store currency.
- 59c8921: Configure tax treatment per currency in Store settings. Product saves use the store setting, and setting changes create new active price versions while preserving historical prices. Remove tax selection from product price editors.
- 59c8921: Add independent store Markdown typography and color settings with a live preview. Apply the shared theme to product previews and built-in storefront content, and expose the theme and rendered summary in the catalog API.

  Allow store owners to choose unordered-list bullet styles and colors, including a colorable sparkle.

- 59c8921: Split store settings into General settings, Styles, and API keys tabs with separate components. General and Styles save independently and preserve drafts when switching tabs.
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
  - @nuxt-customer-portal/ui@0.4.0

## Unreleased

- Add a sandbox store environment with simulated checkout outcomes and prominent test-mode warnings.
- Add translated digital/service products, versioned currency prices, catalog API keys, Stripe checkout, paid-order recovery, guest invitations, and protected purchase delivery.
