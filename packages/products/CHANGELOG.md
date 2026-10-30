# Products

## 0.10.0

### Patch Changes

- 271377c: Notify store owners of new paid or accepted orders and appointment hosts of bookings, updates and cancellations, with customizable English/Dutch emails and retry-safe delivery receipts.
- Updated dependencies [f115496]
- Updated dependencies [1235d0f]
- Updated dependencies [d25ff2e]
- Updated dependencies [1235d0f]
  - @nuxt-customer-portal/core@0.10.0
  - @nuxt-customer-portal/ui@0.10.0
  - @nuxt-customer-portal/clients@0.10.0

## 0.9.1

### Patch Changes

- @nuxt-customer-portal/clients@0.9.1
- @nuxt-customer-portal/core@0.9.1
- @nuxt-customer-portal/ui@0.9.1

## 0.9.0

### Minor Changes

- 936f0a2: Add an authenticated store media library with Studio-style image editing, batch review, independent thumbnails, retained originals, and scoped API-key access using existing storage providers. Product images remain unchanged.

  Support configurable store media variants with automatic generation, independent custom crops, and preset changes applied when each image is next saved. Existing thumbnails migrate as custom sources and product image policies remain unchanged.

- af68856: Use the store media library for new product images, with searchable image selection and one reorderable card list with the first image as thumbnail, live shared image updates, protected storefront delivery, and in-use deletion checks. Resolve display variants automatically through the media library. Preserve existing product images and purchased-file uploads.

  Share Studio-style drag sorting between product image cards and the media grid, with vacant drop slots, animated positioning, continuous edge scrolling and keyboard ordering.

  Load the small thumbnail in product image cards, add versioned authenticated preview URLs and permission-checked ETag revalidation, and show a media-grid drag handle only in manual order.

  Keep media-card actions on one line and enforce responsive minimum card widths, with a slightly inset drag handle.

  Anchor media-card dimensions and action icons to the bottom so rows align despite different metadata lengths.

### Patch Changes

- Updated dependencies [936f0a2]
- Updated dependencies [6696fd0]
  - @nuxt-customer-portal/core@0.9.0
  - @nuxt-customer-portal/ui@0.9.0
  - @nuxt-customer-portal/clients@0.9.0

## 0.8.9

### Patch Changes

- 17e3384: Show booked appointment dates, time ranges, and timezones on thank-you and order details pages, including cancellation status and current rescheduled times.

  Store text previews can optionally show a sample appointment with adjustable UTC date, time, and display timezone.

- Updated dependencies [6cfe8bc]
  - @nuxt-customer-portal/core@0.8.9
  - @nuxt-customer-portal/clients@0.8.9
  - @nuxt-customer-portal/ui@0.8.9

## 0.8.8

### Patch Changes

- Retrieve admin order details through the existing authenticated orders endpoint to avoid generated route type-inference limits in consumer applications.
  - @nuxt-customer-portal/clients@0.8.8
  - @nuxt-customer-portal/core@0.8.8
  - @nuxt-customer-portal/ui@0.8.8

## 0.8.7

### Patch Changes

- 24b23e1: Use the portal's full logo on checkout, order and thank-you pages unless a checkout logo overrides it. Align receipt logos left and add space below store settings tabs.

  Open admin orders in a regular portal page with customer, client, payment and fulfillment details while preserving separate public customer links.
  - @nuxt-customer-portal/clients@0.8.7
  - @nuxt-customer-portal/core@0.8.7
  - @nuxt-customer-portal/ui@0.8.7

## 0.8.6

### Patch Changes

- @nuxt-customer-portal/clients@0.8.6
- @nuxt-customer-portal/core@0.8.6
- @nuxt-customer-portal/ui@0.8.6

## 0.8.5

### Patch Changes

- 0cc098d: Clearly identify test orders with badges in admin and purchase lists and notices on thank-you, order and purchase-detail pages. Use the saved order mode so labels remain accurate after the store switches between test and live mode.
- 31df5dd: Make manual fulfillment an explicit product setting, disabled by default. Snapshot the setting on purchase, show fulfillment status/actions only for opted-in items, and enforce eligibility on the server for paid, accepted and free orders while protecting refunded/disputed items.
- ddc08fb: Open customer-facing order details from order cards and link directly to each order's invoice. Preserve order list search, filters, sorting, pagination and scroll position through both back links, and disable the Invoice action when no invoice exists.
- 878a0a9: Share a welcoming product receipt layout between thank-you and order pages, with provider branding and product images. Use the same download and media preview cards on both pages, remove the thank-you order link, and keep order metadata subtle while hiding payment status for free products.
  - @nuxt-customer-portal/clients@0.8.5
  - @nuxt-customer-portal/core@0.8.5
  - @nuxt-customer-portal/ui@0.8.5

## 0.8.4

### Patch Changes

- 170c58f: Add private account-free order pages with purchased downloads, native media playback, and supported external video previews. Include shareable order links in administration and confirmations, preserve purchase access checks, support inline media delivery with byte ranges, and provide a Store texts editor for English/Dutch checkout and order-page wording.

  Support product-specific purchase introductions with store-default inheritance and selected-product previews; other order-page wording remains shared per language.

- 0a5fb16: Add purchased external links with localized labels, snapshot delivery in confirmation emails and purchase views, and support for link-only digital products.
- Updated dependencies [170c58f]
  - @nuxt-customer-portal/core@0.8.4
  - @nuxt-customer-portal/clients@0.8.4
  - @nuxt-customer-portal/ui@0.8.4

## 0.8.3

### Patch Changes

- 9bf47dc: Manage checkout thank-you texts in the portal, with English/Dutch free and paid defaults, exact-product-slug overrides, save/reset actions and a live preview of unsaved edits. Persist texts in the products schema and serve resolved copies directly with products. Use the original order total to select the free/paid text variant.

  Use a full-width visual Markdown editor for the combined thank-you content, searchable product lists for overrides and preview, and preserve source edits during saves.

- Updated dependencies [351d35a]
  - @nuxt-customer-portal/ui@0.8.3
  - @nuxt-customer-portal/clients@0.8.3
  - @nuxt-customer-portal/core@0.8.3

## 0.8.2

### Patch Changes

- ab7f1f0: Use neutral order confirmation wording for free, paid, and invoiced orders. Align the checkout result sections, improve download actions on mobile, and preserve localized download filenames and extensions across storage delivery paths.
  - @nuxt-customer-portal/clients@0.8.2
  - @nuxt-customer-portal/core@0.8.2
  - @nuxt-customer-portal/ui@0.8.2

## 0.8.1

### Patch Changes

- Show all required store currencies when editing product prices and validate positive prices with actionable messages instead of reporting a duplicate value.
  - @nuxt-customer-portal/clients@0.8.1
  - @nuxt-customer-portal/core@0.8.1
  - @nuxt-customer-portal/ui@0.8.1

## 0.8.0

### Minor Changes

- e558791: Support store-wide online and deferred invoice payment choices with immediate purchase fulfillment, linked unsent invoice drafts, inclusive tax review, and manual payment progress. Add unlisted products with server-generated unguessable slugs, excluded from catalog discovery while remaining available through individual product pages.
- 28bb7af: Add public purchase file permalinks, confirmation email download links, external thank-you page delivery integration, and database records for public and portal download requests.

### Patch Changes

- Updated dependencies [175854d]
- Updated dependencies [28bb7af]
  - @nuxt-customer-portal/core@0.8.0
  - @nuxt-customer-portal/ui@0.8.0
  - @nuxt-customer-portal/clients@0.8.0

## 0.7.0

### Minor Changes

- 1d0419c: Add scheduled product discounts and free offers, original catalog prices, and checkout price revalidation.

### Patch Changes

- @nuxt-customer-portal/clients@0.7.0
- @nuxt-customer-portal/core@0.7.0
- @nuxt-customer-portal/ui@0.7.0

## 0.6.1

### Patch Changes

- @nuxt-customer-portal/clients@0.6.1
- @nuxt-customer-portal/core@0.6.1
- @nuxt-customer-portal/ui@0.6.1

## 0.6.0

### Patch Changes

- @nuxt-customer-portal/clients@0.6.0
- @nuxt-customer-portal/core@0.6.0
- @nuxt-customer-portal/ui@0.6.0

## 0.5.1

### Patch Changes

- @nuxt-customer-portal/clients@0.5.1
- @nuxt-customer-portal/core@0.5.1
- @nuxt-customer-portal/ui@0.5.1

## 0.5.0

### Patch Changes

- 5beff82: Add a shared visual Markdown editor with a raw Markdown mode, protected special content, and English/Dutch formatting controls. Use it for product summaries/descriptions and email bodies/footers, including a picker for the selected email's available placeholders.
- Updated dependencies [5beff82]
  - @nuxt-customer-portal/ui@0.5.0
  - @nuxt-customer-portal/clients@0.5.0
  - @nuxt-customer-portal/core@0.5.0

## 0.4.9

### Patch Changes

- @nuxt-customer-portal/clients@0.4.9
- @nuxt-customer-portal/core@0.4.9
- @nuxt-customer-portal/ui@0.4.9

## 0.4.8

### Patch Changes

- @nuxt-customer-portal/clients@0.4.8
- @nuxt-customer-portal/core@0.4.8
- @nuxt-customer-portal/ui@0.4.8

## 0.4.7

### Patch Changes

- @nuxt-customer-portal/clients@0.4.7
- @nuxt-customer-portal/core@0.4.7
- @nuxt-customer-portal/ui@0.4.7

## 0.4.6

### Patch Changes

- Updated dependencies
  - @nuxt-customer-portal/core@0.4.6
  - @nuxt-customer-portal/clients@0.4.6
  - @nuxt-customer-portal/ui@0.4.6

## 0.4.5

### Patch Changes

- @nuxt-customer-portal/clients@0.4.5
- @nuxt-customer-portal/core@0.4.5
- @nuxt-customer-portal/ui@0.4.5

## 0.4.4

### Patch Changes

- a85ce7a: Improve product detail actions, lifecycle safeguards, destructive deletion confirmation, and image management with a dedicated route and unsaved-change protection.
- 2a4b4d3: Show every configured store currency in the product price editor, including currencies that do not have an active product price yet.
- Updated dependencies [67b5b80]
  - @nuxt-customer-portal/core@0.4.4
  - @nuxt-customer-portal/clients@0.4.4
  - @nuxt-customer-portal/ui@0.4.4

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
