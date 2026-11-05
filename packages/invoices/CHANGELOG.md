# @nuxt-customer-portal/invoices

## 0.12.0

### Patch Changes

- cdda978: Skip invoice source discovery when the Timesheets invoicing integration or its required modules are disabled, preventing misleading loading warnings for intentionally unavailable sources. Preserve standalone source discovery and warnings for genuine request failures.

  Skip the invoice source-selection step when only free-form invoicing is available. Keep back navigation within the applicable steps and display the correct step count for the chosen flow.

- cdda978: Allow adding, editing, and removing draft invoice lines with validated quantities, prices, VAT, and live totals. Preserve existing line identities and exact tax amounts when unchanged, protect agreed purchase totals, and keep failed saves open. Restore direct New invoice navigation and allow manual creation even when optional invoice sources fail, with visible initialization errors and retry actions.

  Share a sortable line list between invoice creation and editing, with only the selected line's edit fields open. Reuse the media library's drag sorting, live order preview, and automatic edge scrolling through a shared Core composable. Keep keyboard reordering without separate move buttons, focus the description after adding a line, reopen invalid lines on submission, and explicitly display VAT rates as percentages.

  Open newly duplicated invoices and credit notes directly in draft edit mode.

- cdda978: Clarify the workspace default VAT percentage with percent-formatted input, validated settings, and save feedback. Use the current workspace default for new lines added to draft invoices without overwriting existing line tax rates.
- Updated dependencies [89bc454]
- Updated dependencies [24ed7df]
- Updated dependencies [cdda978]
- Updated dependencies [c64ed18]
  - @nuxt-customer-portal/clients@0.12.0
  - @nuxt-customer-portal/core@0.12.0
  - @nuxt-customer-portal/ui@0.12.0
  - @nuxt-customer-portal/organizations@0.12.0

## 0.11.0

### Minor Changes

- bd28af9: Allow administrators to permanently delete unissued draft invoices after confirmation. Enforce organization and lifecycle safeguards, cascade draft lines and attachments, and release linked timesheets for invoicing again.
- 38f28c7: Add Duplicate invoice and Credit invoice menu actions that create new drafts without sending emails. Full credit notes reference the original invoice and reverse its rounded amounts and exact tax, with protection against multiple active credit notes.
- d3d20bc: Allow administrators to preview and refresh draft invoice recipient details from current client data, including selecting the billing contact. Keep issued invoice recipient snapshots unchanged and validate organization, draft status and contact ownership on save.

### Patch Changes

- 222652d: Use the portal's light-mode full logo on invoice details and PDFs, falling back to the current provider organization logo. Support uploaded PNG, JPEG and WebP branding in PDF output.
- Updated dependencies [b604141]
  - @nuxt-customer-portal/core@0.11.0
  - @nuxt-customer-portal/clients@0.11.0
  - @nuxt-customer-portal/organizations@0.11.0
  - @nuxt-customer-portal/ui@0.11.0

## 0.10.3

### Patch Changes

- Updated dependencies [0e54ff2]
  - @nuxt-customer-portal/ui@0.10.3
  - @nuxt-customer-portal/clients@0.10.3
  - @nuxt-customer-portal/core@0.10.3
  - @nuxt-customer-portal/organizations@0.10.3

## 0.10.2

### Patch Changes

- Updated dependencies [c2985a7]
- Updated dependencies [c2985a7]
- Updated dependencies [c2985a7]
- Updated dependencies [c2985a7]
  - @nuxt-customer-portal/ui@0.10.2
  - @nuxt-customer-portal/core@0.10.2
  - @nuxt-customer-portal/clients@0.10.2
  - @nuxt-customer-portal/organizations@0.10.2

## 0.10.1

### Patch Changes

- 91bd778: Preserve sales invoice search, filters, sort direction, pagination window, and scroll position when returning from invoice details. Restore collection controls on browser Back/Forward and retain the existing order-list return flow.
- Updated dependencies [7c0f8df]
  - @nuxt-customer-portal/ui@0.10.1
  - @nuxt-customer-portal/clients@0.10.1
  - @nuxt-customer-portal/core@0.10.1
  - @nuxt-customer-portal/organizations@0.10.1

## 0.10.0

### Patch Changes

- Updated dependencies [2e267be]
- Updated dependencies [f115496]
- Updated dependencies [1235d0f]
- Updated dependencies [d25ff2e]
- Updated dependencies [1235d0f]
  - @nuxt-customer-portal/organizations@0.10.0
  - @nuxt-customer-portal/core@0.10.0
  - @nuxt-customer-portal/ui@0.10.0
  - @nuxt-customer-portal/clients@0.10.0

## 0.9.1

### Patch Changes

- Keep the invoice sender form compatible with current Vue template type checking and disable browser-native validation.

- @nuxt-customer-portal/clients@0.9.1
- @nuxt-customer-portal/core@0.9.1
- @nuxt-customer-portal/organizations@0.9.1
- @nuxt-customer-portal/ui@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [936f0a2]
- Updated dependencies [6696fd0]
  - @nuxt-customer-portal/core@0.9.0
  - @nuxt-customer-portal/ui@0.9.0
  - @nuxt-customer-portal/clients@0.9.0
  - @nuxt-customer-portal/organizations@0.9.0

## 0.8.9

### Patch Changes

- Updated dependencies [6cfe8bc]
  - @nuxt-customer-portal/core@0.8.9
  - @nuxt-customer-portal/clients@0.8.9
  - @nuxt-customer-portal/organizations@0.8.9
  - @nuxt-customer-portal/ui@0.8.9

## 0.8.8

### Patch Changes

- @nuxt-customer-portal/clients@0.8.8
- @nuxt-customer-portal/core@0.8.8
- @nuxt-customer-portal/organizations@0.8.8
- @nuxt-customer-portal/ui@0.8.8

## 0.8.7

### Patch Changes

- @nuxt-customer-portal/clients@0.8.7
- @nuxt-customer-portal/core@0.8.7
- @nuxt-customer-portal/organizations@0.8.7
- @nuxt-customer-portal/ui@0.8.7

## 0.8.6

### Patch Changes

- @nuxt-customer-portal/clients@0.8.6
- @nuxt-customer-portal/core@0.8.6
- @nuxt-customer-portal/organizations@0.8.6
- @nuxt-customer-portal/ui@0.8.6

## 0.8.5

### Patch Changes

- ddc08fb: Open customer-facing order details from order cards and link directly to each order's invoice. Preserve order list search, filters, sorting, pagination and scroll position through both back links, and disable the Invoice action when no invoice exists.
- ddc08fb: Avoid automatic provider lookups for resolved invoice email deliveries. Cache failed attempts, back off checks for older unresolved emails, and prevent duplicate concurrent lookups. Keep manual refresh available for later engagement and complaint events with a short cooldown.
  - @nuxt-customer-portal/clients@0.8.5
  - @nuxt-customer-portal/core@0.8.5
  - @nuxt-customer-portal/organizations@0.8.5
  - @nuxt-customer-portal/ui@0.8.5

## 0.8.4

### Patch Changes

- Bind capability fetch types to their concrete route to avoid excessive type inference in host applications.

- Updated dependencies [170c58f]
  - @nuxt-customer-portal/core@0.8.4
  - @nuxt-customer-portal/clients@0.8.4
  - @nuxt-customer-portal/organizations@0.8.4
  - @nuxt-customer-portal/ui@0.8.4

## 0.8.3

### Patch Changes

- Updated dependencies [351d35a]
  - @nuxt-customer-portal/ui@0.8.3
  - @nuxt-customer-portal/clients@0.8.3
  - @nuxt-customer-portal/core@0.8.3
  - @nuxt-customer-portal/organizations@0.8.3

## 0.8.2

### Patch Changes

- @nuxt-customer-portal/clients@0.8.2
- @nuxt-customer-portal/core@0.8.2
- @nuxt-customer-portal/organizations@0.8.2
- @nuxt-customer-portal/ui@0.8.2

## 0.8.1

### Patch Changes

- @nuxt-customer-portal/clients@0.8.1
- @nuxt-customer-portal/core@0.8.1
- @nuxt-customer-portal/organizations@0.8.1
- @nuxt-customer-portal/ui@0.8.1

## 0.8.0

### Minor Changes

- e558791: Support store-wide online and deferred invoice payment choices with immediate purchase fulfillment, linked unsent invoice drafts, inclusive tax review, and manual payment progress. Add unlisted products with server-generated unguessable slugs, excluded from catalog discovery while remaining available through individual product pages.

### Patch Changes

- Updated dependencies [175854d]
- Updated dependencies [28bb7af]
  - @nuxt-customer-portal/core@0.8.0
  - @nuxt-customer-portal/ui@0.8.0
  - @nuxt-customer-portal/clients@0.8.0
  - @nuxt-customer-portal/organizations@0.8.0

## 0.7.0

### Patch Changes

- @nuxt-customer-portal/clients@0.7.0
- @nuxt-customer-portal/core@0.7.0
- @nuxt-customer-portal/organizations@0.7.0
- @nuxt-customer-portal/ui@0.7.0

## 0.6.1

### Patch Changes

- 41e297d: Add reusable Harvest export and one-time migration commands with read-only previews, explicit member/client mappings, invoice and payment reconciliation, atomic imports, and duplicate protection.

  Preserve distinct disabled historical users, credit and written-off invoices, original invoice lifecycle events and source metadata. Track externally billed time independently of invoice links to prevent edits and rebilling. Disambiguate duplicate project names and consolidate duplicate contact email records with explicit provenance. Apply the Timesheets and Invoices history migrations before importing.
  - @nuxt-customer-portal/clients@0.6.1
  - @nuxt-customer-portal/core@0.6.1
  - @nuxt-customer-portal/organizations@0.6.1
  - @nuxt-customer-portal/ui@0.6.1

## 0.6.0

### Patch Changes

- @nuxt-customer-portal/clients@0.6.0
- @nuxt-customer-portal/core@0.6.0
- @nuxt-customer-portal/organizations@0.6.0
- @nuxt-customer-portal/ui@0.6.0

## 0.5.1

### Patch Changes

- @nuxt-customer-portal/clients@0.5.1
- @nuxt-customer-portal/core@0.5.1
- @nuxt-customer-portal/organizations@0.5.1
- @nuxt-customer-portal/ui@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [5beff82]
  - @nuxt-customer-portal/ui@0.5.0
  - @nuxt-customer-portal/clients@0.5.0
  - @nuxt-customer-portal/organizations@0.5.0
  - @nuxt-customer-portal/core@0.5.0

## 0.4.9

### Patch Changes

- @nuxt-customer-portal/clients@0.4.9
- @nuxt-customer-portal/core@0.4.9
- @nuxt-customer-portal/organizations@0.4.9
- @nuxt-customer-portal/ui@0.4.9

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

### Minor Changes

- 59c8921: Add the Products store module and product invoice integration: translated digital products and services, secret catalog API keys, Stripe one-time checkout, guest invitations, purchaser-only delivery, exact multi-currency invoices, and refund credit notes. Add narrowly scoped external authentication routes, API documentation contracts, and configurable module activation. Existing stores remain closed until explicitly configured and enabled.
- 59c8921: Replace the unused single-product purchase record with multi-item-ready orders, order lines, carts, and cart lines while preserving the current one-product checkout experience. Generate invoice lines from immutable order lines.

### Patch Changes

- 59c8921: Use compact currency symbols in invoice PDFs and give future product invoices a localized purchase-reference subject distinct from their product line descriptions.
- 59c8921: Support organization and personal clients with optional verified self-registration, single-person access safeguards, and shared provider, client, and user timezone preferences. Preserve existing B2B defaults, module references, invoice history, and Timesheets timezone behavior.

  Collect and store first and last names during signup and personal onboarding. Route ordinary personal registration and verified users without memberships or pending invitations through onboarding.

  Allow users to edit first name, last name, and an independent display name in profile settings.

  Synchronize display-name edits with the linked private client name and current billing name in the same transaction, preserving organizations and historical invoices.

  Let private clients edit their own billing address in profile settings, independently of the active organization, with server-side ownership checks.

  Private clients use their own invoice email without contact persons; hide contact management and reject private-client contact creation or selection server-side.

  Add a B2C-only Invite private client action to the Users page, supporting new and existing private clients with atomic record creation, request retry protection, and pending invitation recovery when email delivery fails.

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

### Minor Changes

- ca166fd: Extract invoices into an independent Nuxt layer and add an optional Timesheets source bridge.

  This removes the legacy `/timesheets/invoices`, `/admin/timesheets/invoices`, and Timesheets invoice API routes without redirects or delegates. Use `/invoices`, `/admin/invoices`, `/api/invoices`, and `/api/invoice-timesheets` instead.

### Patch Changes

- @nuxt-customer-portal/clients@0.3.0
- @nuxt-customer-portal/core@0.3.0
- @nuxt-customer-portal/organizations@0.3.0
- @nuxt-customer-portal/ui@0.3.0
