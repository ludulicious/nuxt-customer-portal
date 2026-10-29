# Products

Publishing opens a confirmation checklist. Each supported store language requires a name, summary, and description. Images require one thumbnail plus at least one gallery and product-details assignment. Paid products need a positive price in every supported store currency. Digital products also require a purchased file. Required failures block publishing and are enforced by the API. A closed store appears as a nonblocking warning: publishing does not open the store for purchases.

A single provider-owned store for digital files and services. Includes English/Dutch product content, versioned one-time currency prices, published catalog access, Stripe Checkout, purchaser-only downloads/playback, and a purchase library. Install `@nuxt-customer-portal/invoice-products` and `@nuxt-customer-portal/invoices` for checkout and invoice delivery.

New stores start in **sandbox mode**. Administrators can open the storefront and run paid, failed, and expired checkout scenarios without Stripe. By default these simulations have no client, invoice, fulfillment, or email side effects. In a non-production process, set `IS_DEVELOPMENT=true` to exercise those post-payment effects. Sandbox email subjects are always prefixed with `[TEST]`. The flag is ignored when `NODE_ENV=production`; Stripe reconciliation, refunds, and disputes are never simulated. The storefront clearly warns when development effects are active, and sandbox orders remain visible in order administration. Orders created in test mode display a **Test order** badge in admin and buyer purchase lists, plus a prominent notice on thank-you pages, public order pages and purchase details. Labels follow the saved order mode, so switching the store to live mode does not relabel earlier test orders. Orders created before mode tracking remain unlabelled when their mode is unknown. Switch the store environment to **live** only when Stripe, webhook signing, invoices, email, client types, and storage are configured. Existing stores retain live mode when this migration is installed.

## Installation

Add `@nuxt-customer-portal/products`, `@nuxt-customer-portal/invoices`, and `@nuxt-customer-portal/invoice-products` to `portal.config.ts` layers and run the portal migration command. Enable personal and organization clients. In the configurable SaaS portal, enable all three modules in portal settings. Existing installations remain closed for new sales until an owner saves Store settings and explicitly opens the store.

The provider organization's owners and administrators manage Products, Orders, and Store settings. Customer access is always checked against the purchaser's verified account, independently of company membership and invoice-viewing permissions.

Categories are maintained on the Categories page and can be created from the product form. Renaming updates the catalog; purchased snapshots remain unchanged. Categories used by any product cannot be deleted. Existing free-text categories are imported by the category migration.

## Deployment configuration

Configure these server-only environment variables; never put them in public runtime config:

| Variable                                     | Purpose                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`                            | Canonical portal origin, including port locally; always use `localhost` locally |
| `IS_DEVELOPMENT`                             | Explicitly enable non-Stripe sandbox side effects outside production            |
| `PRODUCTS_STRIPE_SECRET_KEY`                 | Stripe account secret; use a test-mode key during testing                       |
| `PRODUCTS_STRIPE_WEBHOOK_SECRET`             | Signing secret for this endpoint and Stripe mode                                |
| `PRODUCTS_STRIPE_ENCRYPTION_KEY`             | Optional legacy/advanced override for saved Stripe credentials                  |
| `PRODUCTS_S3_BUCKET`                         | Private S3-compatible bucket                                                    |
| `PRODUCTS_S3_REGION`                         | Bucket region, default `us-east-1`                                              |
| `PRODUCTS_S3_ENDPOINT`                       | Optional endpoint for compatible storage                                        |
| `PRODUCTS_S3_PATH_STYLE`                     | Use path-style addressing for environment-managed compatible storage            |
| `PRODUCTS_STORAGE_PROVIDER`                  | Set to `bunny` to use Bunny's proprietary Storage API                           |
| `PRODUCTS_BUNNY_STORAGE_ZONE`                | Bunny Storage Zone name                                                         |
| `PRODUCTS_BUNNY_STORAGE_PASSWORD`            | Bunny Storage Zone password                                                     |
| `PRODUCTS_BUNNY_STORAGE_ENDPOINT`            | Regional Storage API endpoint, default `https://storage.bunnycdn.com`           |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Standard AWS credentials, or use the SDK's role-based credential chain          |
| `PRODUCTS_STORAGE_ENCRYPTION_KEY`            | Optional legacy/advanced override for saved storage credentials                 |
| `PRODUCTS_IMAGEKIT_URL_ENDPOINT`             | ImageKit URL endpoint for optimized public product-image delivery               |

Configure Stripe Tax and the seller's registrations in Stripe. Assign the appropriate Stripe tax code to each product. The initial catalog supports EUR, USD, GBP, CAD, AUD, NZD, CHF, DKK, NOK, SEK, PLN, CZK, HUF, RON, JPY, HKD, SGD, and AED. Availability still depends on the Stripe account and payment method. Other currencies require an adapter/validation extension; currencies with special Stripe amount representations are deliberately excluded. See [Stripe currency rules](https://docs.stripe.com/currencies). Prices are explicitly entered per currency; no exchange-rate conversion occurs. Store settings defines whether tax is included or added for each supported currency. Product saves use that setting. Changing it creates new active price versions and preserves historical prices and orders. The migration seeds settings from the most recently updated product with an active price in each currency, defaulting to tax included when none exists. Checkout confirms the final tax and total. Portal invoices preserve that exact tax amount rather than reconstructing it from a rounded percentage.

Register `POST /api/store/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`. Run `pnpm stripe:listen` to forward these test-mode events to the same route on `localhost:3052`; copy the signing secret printed by the listener into **Store settings → Stripe**. Keep test and live keys, webhook secrets, and data in separate installations.

Complete the invoice sender profile and the portal email provider configuration before opening the store. No Stripe invoice is created; the portal issues the sales invoice and records the payment. Stripe may send its payment receipt according to the account's settings.

### Storage

Storage can be supplied by deployment environment variables or configured in **Store settings → Storage**. Environment configuration takes precedence and locks the form. Saved access credentials are encrypted with the portal-wide `PORTAL_ENCRYPTION_KEY`, are never returned to the browser, and must pass a write/head/delete connection probe before they replace a working configuration.

Stripe can likewise be configured under **Store settings → Stripe** when neither Stripe environment variable is present. Environment configuration takes precedence and hides this tab. Store-managed credentials are encrypted with a separate key derived from `PORTAL_ENCRYPTION_KEY`; the secret key is verified with Stripe before it replaces a working configuration.

Existing deployments may retain `PRODUCTS_STORAGE_ENCRYPTION_KEY` and `PRODUCTS_STRIPE_ENCRYPTION_KEY` as module-specific overrides. Keep the old variables configured while legacy credentials encrypted with them remain in the database. Saving those credentials again writes the versioned format; removing an override still requires re-saving under the portal-wide key first.

The Storage tab supports Amazon S3, generic S3-compatible services, and Bunny's proprietary HTTP Storage API. Bunny configuration needs the regional API endpoint, Storage Zone name, and Storage Zone password. Browser uploads stream through an authenticated portal endpoint, keeping that password server-side; downloads of purchased files are streamed through the existing purchaser-authorized route. Set `PRODUCTS_STORAGE_PROVIDER=bunny` together with the `PRODUCTS_BUNNY_STORAGE_*` variables when Bunny is deployment-managed.

Keep the entire bucket private. Permit presigned POST uploads from the exact portal origin in bucket CORS. Allow the `Content-Type` and `Range` request headers and expose `Content-Length`, `Content-Range`, `Accept-Ranges`, and `ETag`. Give the portal server create/read/head/delete access under `products/staging/`, `products/private/`, `products/public/`, and `products/health/`. Health probes are removed immediately.

Connect ImageKit to the S3-compatible bucket or a Bunny Pull Zone that exposes only `products/public/`. Set `PRODUCTS_IMAGEKIT_URL_ENDPOINT` to its URL endpoint. ImageKit must not receive access to `products/private/`, which remains available only through purchaser-authorized downloads.

Images support JPEG, PNG, WebP, and AVIF up to 10 MB. Store settings defines exact output dimensions for square thumbnails, portrait product cards/gallery images, and landscape product-detail images. The editor chooses a purpose before selecting and cropping a file. Completion verifies the decoded format, limits source pixels, applies orientation and the purpose-specific crop, removes metadata, and stores an exact-size sRGB WebP source. At most one image can be the thumbnail; published products also require at least one gallery and product-detail image. Purchased files support PDF, ZIP, DOCX, text, MP3, M4A, WAV, OGG, MP4, and WebM up to 2 GB. Private object URLs expire after five minutes. Browser-compatible audio/video uses native playback; there is no transcoding, adaptive streaming, DRM, or malware scanner. Save a draft first, upload its files, then save their ordering and publish.

Files removed from a product remain available to previous purchasers through their order snapshot. Bucket retention must preserve purchased files. Orphaned uploads are retained for administrator-managed cleanup; do not apply a blanket expiry policy to completed product objects.

### Durable processing

The Nitro task `products:reconcile` is scheduled every minute on supported Nitro deployments. On deployments without scheduled-task support, invoke that task from the deployment scheduler every minute. It retries unfinished purchases and stored failed webhook events in bounded batches. The order page exposes processing errors and a manual **Retry and reconcile** action.

Payment, client, invoice, and notification state are stored separately. Duplicate Stripe events cannot create duplicate order invoices. Email sends use provider idempotency keys. Monitor failed processing, unsent notifications, and failed webhooks; do not disable scheduled processing when stopping new sales. Existing purchases remain accessible while the store is closed.

Guest checkout creates or reuses a billing client and sends an invitation. A new authentication account is created through the existing signup flow when the invitation is accepted, not with a generated password. A verified email can claim matching purchases, but checkout input never creates membership in an existing business. Business matching requires authenticated membership; otherwise a separate client is created for administrator reconciliation. Digital access belongs only to the purchaser.

Refunds are initiated in Stripe in v1. Refund webhooks create incremental credit notes; partial credits allocate the original tax proportionally, with cumulative rounding so a full refund exactly reverses the original amounts. Full refunds revoke that order's access; partial refunds retain it. Disputes suspend access until a favorable resolution. Another valid purchase continues to confer access.

## External website API

System administrators create keys in **Admin → API keys** for the provider organization. Client organizations cannot own or administer API keys. Keep a key exclusively on the external website's server. Better Auth shows it once, stores only its SHA-256 hash, and handles expiry, revocation, usage timestamps, and per-key rate limiting. Rotate by creating a replacement, switching the website, then revoking the old key.

Each portal module explicitly declares the API capabilities it exposes. Administrators select from those scopes when creating a key; a key cannot access unselected or internal module functionality. Products exposes `products.catalog:read` for published products and the separate `products.drafts:read` preview capability for drafts. Existing keys remain published-only until an administrator creates a replacement with draft access. API keys are limited to 120 requests/minute. Requests from one source IP also share a 120/minute authentication limit. Portal purchase entry points are limited to 30/minute per source IP.

```ts
// Runs on your external website's server, never in a browser bundle.
const response = await fetch(`${process.env.PORTAL_URL}/api/store/v1/products?locale=nl&currency=EUR`, {
  headers: { Authorization: `Bearer ${process.env.PORTAL_CATALOG_KEY}` }
})
if (!response.ok) throw new Error(`Catalog request failed (${response.status})`)
const { items, pagination } = await response.json()
// Render each item's title, summary, sanitized descriptionHtml, images,
// prices and purchaseUrl. Link your Buy button to purchaseUrl.
```

- `GET /api/store/v1/products`: query `locale`, `currency`, `search`, `category` (code), `categoryId`, `type`, `page`, `sortBy`, `sortDir`. Pages contain 20 products and `pagination` with `page`, `pageSize`, `totalItems`, `totalPages`.
- `GET /api/store/v1/products/{slug}`: one published product, optionally filtered by `locale` and `currency`.
- Add `status=draft` to either endpoint to request drafts. The key must have `products.drafts:read`; published requests require `products.catalog:read`. Archived products are never exposed.
- Products include `id`, `slug`, `type`, `categoryId`, `category` (code), `categoryDetails`, `title`, `summary`, `descriptionHtml`, gallery `images`, `thumbnailImage`, `detailImages`, `videoUrl`, `prices`, `purchaseUrl`, and `locale`. Prices include a stable version `id`, `currency`, integer minor-unit `amount`, and `taxBehavior`.
- Errors: 400 invalid query; 401 missing, revoked, or expired key; 403 missing required scope; 404 unavailable product; 429 rate limit; 503 published store closed/unconfigured.
- No private assets, order details, customer information, or unpublished products are included. Catalog responses are not shared-cacheable.

Product pages are intentionally public so a buyer can follow a purchase URL. Catalog enumeration requires an API key. Translated copy falls back to the store's default language. Returned `locale` is the requested display language; individual content may be fallback text.

## Extension contracts

`registerOrderIntegration` connects invoice generation, refunds, and notification delivery without a Products dependency on Invoices. `registerOrderFulfillmentHook` registers an idempotent, transactional hook keyed by order ID. Manual fulfillment tracking is separate from these integration hooks and appointment scheduling. Enable **Requires fulfillment** in a product’s basic details only when a purchase needs manual delivery or completion. It defaults to off for all product types, including existing products and historical order snapshots without the property. The setting is stored in product JSON and copied into each new order line; editing it later does not change existing orders. Only opted-in lines show fulfillment status or can be marked fulfilled. Paid, accepted and free orders are eligible while fully refunded, disputed and already fulfilled lines remain protected. No database migration is required. This setting does not add physical product types, shipping, inventory or carrier integration. Payment behavior lives behind `PaymentProvider`; Stripe is the only implemented adapter. Polar requires separate merchant-of-record invoicing behavior.

Not included: physical products, shipping, inventory, booking capacity, cart UI or cart APIs, subscriptions, coupons, course lessons/progress, or media transcoding. The database includes cart and order-line structures for a future multi-item checkout while the current storefront creates a one-line order directly.

## Tests

Run `pnpm test:packages` and the host's Nuxt typecheck. To include the Products integration test, set `PRODUCTS_TEST_DATABASE_URL` to an **empty disposable PostgreSQL database** whose name starts with `codex_products_test_`. That test applies migrations and creates fixtures; never point it at portal data.

### Store currencies and free products

Store Settings defines supported currencies (at least one). Drafts may have incomplete pricing; publishing requires positive prices in every supported currency. Prices are edited separately from Basic details. Published products cannot switch between free and paid. Adding a currency preserves existing prices; existing products must be updated before checkout is available again. Removed currencies are excluded from public pricing; historical orders retain their original prices. The migration initializes the store currencies from existing active prices, or EUR for an empty store.

Mark a product as free to skip price entry. Internally a zero-value price preserves order references. Free acquisition uses the normal client, delivery, and purchase email flow without Stripe or an invoice. Store activation prerequisites still apply.

Store Settings selects supported product languages from the same bundled language list as the portal UI. The default store language must be selected. Editors and previews show enabled languages with the default first; disabled translations remain stored. Public catalog requests for a disabled language fall back to the store default. SaaS UI language availability is configured separately in Portal Settings → Languages.

Categories have a dedicated admin page with searchable, sorted, paginated cards and inline create/edit forms. Each category has a unique store-scoped code and localized names/descriptions for store languages. The category migrations generate editable codes, preserve existing names in both language slots, migrate assignments to `category_id`, and remove the category from product JSON. Product assignments use the dedicated `product.category_id` foreign key, scoped to the store. Changing a category code or translation leaves product assignments unchanged. Purchase snapshots remain unchanged. Linked categories cannot be deleted. The catalog API includes localized `categoryDetails` alongside the category code.

### Store content styling

Store settings includes a live Markdown theme editor for fonts, body size, line height, paragraph spacing, heading scale, and text, heading, link, and background colors. Blank colors inherit the surrounding store palette. These styles are scoped to product summaries and descriptions and do not affect portal controls. The product preview and built-in storefront use the same `ProductsMarkdown` component.

Catalog responses include `summaryHtml` (sanitized Markdown) and `markdownStyle` alongside `descriptionHtml`. External storefronts must apply these theme values in their own renderer to match the preview; the API does not inject styles into an external site. Existing integrations can continue using the plain `summary`. Style settings accept bounded typography values and six-digit hex colors only. Migration `0007_markdown_style.sql` adds the saved store theme without changing existing product text.

Markdown themes also support unordered-list bullet styles (dot, circle, square, dash, checkmark, sparkle) and a separate bullet color. These apply to real Markdown lists; literal emoji in paragraphs are unchanged. Existing themes default to dots in the text color.

## Scheduled offers

Store administrators can add, edit, and cancel multiple offers in a product's pricing section. Each offer has an exact start and end time, shown in the administrator's browser timezone and stored in UTC. The start is included; the end is excluded. Overlapping offers and ambiguous daylight-saving times are rejected. Set a reduced amount in every configured currency, or choose a free offer. Regular prices resume automatically after the end.

The store catalog list, detail, and storefront APIs resolve prices at request time without caching. Each `prices[]` item retains its effective `id`, `currency`, `amount`, and `taxBehavior`, and adds `originalAmount` (the regular price) and `offer` (`{ id, startsAt, endsAt }` while active, otherwise `null`). Without an offer, `originalAmount` equals `amount`. Amounts use currency minor units; a free offer returns zero. `isFree` reflects effective pricing. Currency filters apply to active offers.

Offer management uses the existing store-admin authorization: `POST /api/products/admin/products/:id/offers`, `PUT /api/products/admin/products/:id/offers/:offerId`, and `DELETE /api/products/admin/products/:id/offers/:offerId`. Create/update bodies contain `startsAt` and `endsAt` as ISO timestamps with offsets, `isFree`, and `prices` (currency, amount, taxBehavior; empty for free offers). Store tax settings determine the applied tax behavior. Admin product reads include `offers` separately from regular `prices`. Cancellation retains historical offers and order references. Ended offers are read-only.

Checkout rechecks the price and rejects stale price IDs with a refresh-required conflict. Service reservations do not lock offer prices; a changed quote requires a new reservation. Created orders and checkout retries retain their agreed price. Regular-price or store-currency changes that invalidate active or future offers are rejected until those offers are updated or cancelled. Existing appointment-change fees are unaffected.

### Store texts

Provider owners and administrators can manage checkout confirmation text at **Store → Store texts**, using grouped navigation and English/Dutch language buttons like Email texts. Choose **Free order** or **Paid order** under Checkout confirmations, edit the store default, or choose a product from the searchable list to maintain an override. The full-width Markdown editor combines the heading, message and next steps; its formatting is shared with the live checkout preview. Existing text is preserved when opened in the combined editor. Blank fields inherit the matching store default; restoring a product text removes its saved override, while restoring a store default returns to built-in wording. Other products, variants and languages are unaffected. Draft edits remain available when switching selectors until the editor is left; saving applies only to the selected text.

Enter a product slug in the preview controls to render the actual checkout receipt with unsaved edits and current store branding. Draft and unlisted products can also be previewed by authorized administrators. Example file links and purchase actions are disabled, and a preview notice is always visible. No order, payment or customer data is created. Invoice-later orders retain a separate system-generated invoice explanation.

Texts are stored in `products.thank_you_text`, scoped to the owning organization, locale, variant and exact slug (empty for store defaults). Product administration policy guards all read, save, reset and preview endpoints. Catalog responses include only the two resolved copies for that product and language; no external endpoint or caller-website integration is needed. Checkout selects the free/paid copy using the original order amount, so an expired temporary offer does not change its confirmation text.

### Purchased links

Under **Purchased files and links**, add ordered external links with a shared HTTP/HTTPS destination and labels in each enabled store language. Links work for digital and service products; a digital product may contain files, links, or both. Each checkout snapshots the links, so later edits and removals apply only to future purchases. No database migration is needed for this feature.

Eligible buyers receive links in the confirmation email (`{{downloads}}`), order confirmation, and portal purchase drawer. The purchase-delivery API adds `links: [{ id, name, url }]` alongside the existing `files` array. Files also include `content_type`, `size` and `previewUrl` for inline media playback on the thank-you page. Destinations are excluded from public catalog responses. Existing payment, invoice acceptance, refund and dispute access rules apply before revealing a destination. Once revealed, its external service controls access: removing portal access cannot revoke a shared Google Doc or YouTube URL.

### Account-free order details

Clicking an order card opens its authenticated portal admin detail page at `/admin/products/orders/:id`, without public checkout branding. A compact overview shows the buyer name and email, linked client, purchase date, amount, payment information and invoice action. The **Client order details** card reuses the customer-facing order renderer without its logo header, including purchased items, instructions and available delivery content. Admin fulfillment and retry actions remain in the overview. The detail API requires product administration access and scopes the order to the provider organization; buyer and client information is never added to the public order endpoint. **Go back to orders** returns to the same search, filters, sorting, page and scroll position. The loaded page range and scroll offset are saved for each list URL in the current browser tab; the page range is reloaded before restoring the offset. The **Invoice** action opens that order’s invoice with a **Back to orders** link preserving the same list state; the action is disabled until an invoice exists. Card actions work independently from card navigation.

Admins can choose **Copy client link** on an order to share `/store/orders/:purchaseToken`. The recipient can view that order without registering or signing in. New purchase confirmations link to this page through `{{orderUrl}}`; `{{url}}` remains the existing portal/invitation destination for custom templates. Appointment confirmation instructions also include the order link. Existing emails are not resent.

Thank-you and order pages share a responsive receipt layout with provider branding aligned left, product thumbnails, and the same file and link cards. The logo uses the **Products → Settings → Styles → Host checkout appearance → Logo URL** override when defined. Otherwise checkout, thank-you and order pages inherit the portal settings full light-mode logo (or the dark-mode full logo if no light logo is configured), falling back to the provider organization logo when portal branding is unavailable. The checkout host name falls back to the provider organization name. The thank-you page omits the order-details link; the confirmation email provides it. Order reference, purchase date and payment status appear as quiet metadata below the content; free orders hide payment status.

The page uses purchase snapshots and existing payment, invoice-acceptance, refund and dispute checks. It shows the order reference, date, status, total, purchased items and available instructions, without exposing billing addresses, buyer email, payment identifiers or internal storage keys. An archived product or closed store does not remove an existing purchase's delivery access. Missing or invalid tokens return an unavailable-link response. Treat the permanent link as private: anyone holding it can access that order's available content.

Uploaded audio and video use native browser players with a download fallback. Public file URLs retain their existing download behavior; `?preview=1` requests inline playback without counting as a download. Bunny delivery forwards byte-range requests and partial-response headers for seeking; S3 delivery continues using short-lived signed URLs. Playback depends on the browser's supported codecs; there is no transcoding.

Existing purchased links require no schema change. YouTube watch/share/shorts/live links and Vimeo public/unlisted video links have click-to-load embedded previews; unlisted Vimeo hashes are retained. Frames send only the portal origin as referrer so the private purchase path is not shared. Direct MP3/M4A/WAV/OGG and MP4/WebM URLs use native players. Other services, or providers that disallow embedding, remain accessible through **Open link**. Destination permissions remain controlled by the external service.

### Editable order-page wording

Under **Store → Store texts → Order details**, provider owners and administrators can customize the shared page wording in English and Dutch: headings, a Markdown introduction, order labels, download/player actions, payment and access states, error messages, and the private-link footer. The preview uses the actual page renderer with synthetic content and selectable order/error states; links and media are disabled. Drafts survive language and section switches until leaving Store texts. Save or restore defaults for the selected language only; blank fields inherit the built-in wording.

Overrides are stored in `products.page_text`; apply `0022_page_texts.sql` through the normal migration command when upgrading. Shared wording is resolved on each request and updates existing order pages immediately, including the generic error screen for invalid links. Purchased titles, instructions, file names and link labels still come from their immutable purchase snapshots. Existing thank-you overrides remain in their original table and retain store/product and free/paid inheritance. The old `/admin/products/thank-you` URL redirects into Store texts; its existing API endpoints remain supported.

Store texts also support product-specific purchase introductions. All page headings, labels, actions, statuses and errors remain shared per language. Empty product introductions inherit the store introduction; reset removes only the selected product/language introduction. Orders containing a single distinct product use that product’s introduction, while mixed-product orders use the store introduction. Selecting a product automatically loads its introduction and previews its current title, price, instructions, files and links. Product-specific editing always previews that same product. Store-default editing has a separate preview product selector. Preview state sits with the preview controls; previews use no customer orders and disable media/download actions. Apply products migration `0023_product_page_texts.sql` before deploying this update.

## Store media library

**Store → Media library** manages images independently of products. Existing product image uploads, purpose-specific crops, catalog output and purchased files are unchanged. The library matches Marpos Studio's image workflow: a searchable grid with category/visibility filters, adjustable card sizes, manual ordering, single-image upload and batch review. Search, filters, sorting and pagination are reflected in the URL. Drag ordering and accessible move buttons are available in the unfiltered, ascending manual-order view.

The editor has **Details** and **Adjust image** tabs. Title and alternative text are required; categories are free-form media tags, separate from product categories. Photo credit and visibility are optional. Metadata values are not translated; the interface supports English and Dutch. Batch uploads accept shared categories, credit and visibility, then review and save each image individually. Switching between queued images retains edits. A failed completion can be retried without uploading already-transferred bytes again.

JPEG, PNG, WebP and GIF images up to 10 MB are accepted. Decoding is limited to 40 million input pixels, including animated frames. GIF animation is preserved and its adjustment controls are disabled. Other images support crop/shape/zoom, quarter-turn rotation, straighten, brightness, undo/redo, and reset to the retained original. The full image has no fixed aspect ratio; an optional independent thumbnail defaults to 4:3. Resetting the full image preserves the thumbnail. Replacing the source image clears its previous thumbnail unless a new thumbnail is supplied.

Media uses the existing environment-managed or store-managed S3/Bunny configuration, with keys under `products/media/`. No additional provider configuration is required. New uploads and edited versions are stored separately; saving atomically switches the media record only after every file passes validation. Metadata-only saves leave image bytes unchanged. Revisions reject stale updates with HTTP 409; reload before applying changes again. Removed/superseded files and abandoned uploads are cleaned by the existing reconciliation task after 24 hours. Committed originals and current/thumbnail versions are retained.

### Authenticated media API

All endpoints are under `/api/products/media`. They accept a provider administrator's session or an organization API key using `Authorization: Bearer <key>`. Add permissions in **API keys**:

- `products.media:read`: list visible images, read their metadata, and retrieve their current image/thumbnail.
- `products.media:manage`: includes read access, hidden entries, original images, uploads, editing, ordering, and deletion.

Keys belonging to other organizations or with catalog-only permissions cannot access the library. Visibility takes effect when saved; there is no publishing step. There are no anonymous image URLs. Content endpoints check permissions on every request and return private, non-cacheable bytes rather than public CDN redirects. Browser consumers must fetch images with authentication and use a blob URL for `<img>` previews. Keep API keys on a trusted server when building a public website.

| Method and path                                       | Input / result                                                                                                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                               | `search`, `category`, `visibility=all\|visible\|hidden`, `sortBy=order\|title\|created`, `sortDir=asc\|desc`, `page`; returns `items`, permitted `categories`, and `pagination` (`total`, `page`, `pageSize=20`, `pageCount`).    |
| `GET /:id`                                            | Metadata, revision, current image and optional thumbnail; manage access also includes the original. File descriptors contain authenticated `url`, `name`, `contentType`, `size`, `width`, `height`.                               |
| `POST /uploads`                                       | `{ files: [{ role: "original"\|"image"\|"thumbnail", name, contentType, size }] }`; returns upload `id` and per-file `id`, `role`, and upload `url`. Maximum one file of each role.                                               |
| `PUT /uploads/:uploadId/:fileId`                      | Raw image bytes with `Content-Length`; verifies size, decoded MIME type and dimensions, then stores the object. A successful transfer is immutable and safe to retry.                                                             |
| `POST /uploads/:uploadId/complete`                    | Metadata `{ title, alt, categories, credit, visible }`, plus `id` and `revision` when editing. Requires every file to be ready; creation requires an `original`. Returns the saved media item. Completion retries are idempotent. |
| `PUT /`                                               | Same metadata, optional `uploadId`, and `id`/`revision` for updates. Without an upload, updates metadata only.                                                                                                                    |
| `PUT /reorder`                                        | `{ id, beforeId: string\|null, revision }`; moves an entry before another entry or to the end.                                                                                                                                    |
| `DELETE /:id`                                         | `{ revision }`; permanently removes the library entry.                                                                                                                                                                            |
| `GET /:id/content?variant=image\|thumbnail\|original` | Authenticated image bytes; thumbnail falls back to the current image when absent. Original requires manage access.                                                                                                                |

Image IDs are independent of product asset IDs. Library entries are not yet selectable from products, and the catalog API does not include them.

### Media verification

Run `pnpm test:packages` for unit/regression coverage. To include storage and API integration coverage, set `PRODUCTS_MEDIA_TEST_DATABASE_URL` to an **empty disposable PostgreSQL database** named `codex_products_test_*`, then run:

```sh
node --import tsx --test packages/products/test/media.test.ts packages/products/test/media-database.test.ts
```

The integration test applies core/products migrations and starts local in-memory S3/Bunny HTTP servers; it never uses production storage credentials. It covers image validation, transfer retries, completion idempotence, metadata-only writes, retained originals, independent thumbnails, stale revisions, hidden images, organization isolation, real API-key permissions, ordering, and cleanup.

Browser coverage is available with `PORTAL_MEDIA_E2E=1 pnpm exec playwright test --config test/e2e/media.config.ts`. Use an isolated SaaS portal with all enabled module migrations applied, existing storage pointed at a disposable S3/Bunny endpoint, and a verified system administrator `media-owner@example.test` (password `Media-test-password-2026!`) who owns provider organization `media-store`. Configure its store row and complete portal onboarding with Products, Invoices and the product invoice integration enabled. Set `PORTAL_MEDIA_E2E_URL` to its `http://localhost:<port>` origin (default `http://localhost:55440`) and set `BETTER_AUTH_URL` to that same origin. Tests cover uploads, adjustments, thumbnail editing, metadata preservation, navigation guards, desktop/mobile layouts, batch review, and retry without duplicates. Never configure these fixtures in a real portal.
