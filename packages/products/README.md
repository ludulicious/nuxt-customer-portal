# Products

Publishing opens a confirmation checklist. Each supported store language requires a name, summary, and description. Images require one thumbnail plus at least one gallery and product-details assignment. Paid products need a positive price in every supported store currency. Digital products also require a purchased file. Required failures block publishing and are enforced by the API. A closed store appears as a nonblocking warning: publishing does not open the store for purchases.

A single provider-owned store for digital files and services. Includes English/Dutch product content, versioned one-time currency prices, published catalog access, Stripe Checkout, purchaser-only downloads/playback, and a purchase library. Install `@nuxt-customer-portal/invoice-products` and `@nuxt-customer-portal/invoices` for checkout and invoice delivery.

## Installation

Add `@nuxt-customer-portal/products`, `@nuxt-customer-portal/invoices`, and `@nuxt-customer-portal/invoice-products` to `portal.config.ts` layers and run the portal migration command. Enable personal and organization clients. In the configurable SaaS portal, enable all three modules in portal settings. Existing installations remain closed for new sales until an owner saves Store settings and explicitly opens the store.

The provider organization's owners and administrators manage Products, Orders, and Store settings. Customer access is always checked against the purchaser's verified account, independently of company membership and invoice-viewing permissions.

Categories are maintained on the Categories page and can be created from the product form. Renaming updates the catalog; purchased snapshots remain unchanged. Categories used by any product cannot be deleted. Existing free-text categories are imported by the category migration.

## Deployment configuration

Configure these server-only environment variables; never put them in public runtime config:

| Variable                                     | Purpose                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`                            | Canonical portal origin, including port locally; always use `localhost` locally |
| `PRODUCTS_STRIPE_SECRET_KEY`                 | Stripe account secret; use a test-mode key during testing                       |
| `PRODUCTS_STRIPE_WEBHOOK_SECRET`             | Signing secret for this endpoint and Stripe mode                                |
| `PRODUCTS_S3_BUCKET`                         | Private S3-compatible bucket                                                    |
| `PRODUCTS_S3_REGION`                         | Bucket region, default `us-east-1`                                              |
| `PRODUCTS_S3_ENDPOINT`                       | Optional endpoint for compatible storage                                        |
| `PRODUCTS_S3_PATH_STYLE`                     | Use path-style addressing for environment-managed compatible storage            |
| `PRODUCTS_STORAGE_PROVIDER`                  | Set to `bunny` to use Bunny's proprietary Storage API                            |
| `PRODUCTS_BUNNY_STORAGE_ZONE`                | Bunny Storage Zone name                                                          |
| `PRODUCTS_BUNNY_STORAGE_PASSWORD`            | Bunny Storage Zone password                                                      |
| `PRODUCTS_BUNNY_STORAGE_ENDPOINT`            | Regional Storage API endpoint, default `https://storage.bunnycdn.com`             |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Standard AWS credentials, or use the SDK's role-based credential chain          |
| `PRODUCTS_STORAGE_ENCRYPTION_KEY`            | Encrypts S3 credentials saved through Store settings                            |
| `PRODUCTS_IMAGEKIT_URL_ENDPOINT`             | ImageKit URL endpoint for optimized public product-image delivery               |

Configure Stripe Tax and the seller's registrations in Stripe. Assign the appropriate Stripe tax code to each product. The initial catalog supports EUR, USD, GBP, CAD, AUD, NZD, CHF, DKK, NOK, SEK, PLN, CZK, HUF, RON, JPY, HKD, SGD, and AED. Availability still depends on the Stripe account and payment method. Other currencies require an adapter/validation extension; currencies with special Stripe amount representations are deliberately excluded. See [Stripe currency rules](https://docs.stripe.com/currencies). Prices are explicitly entered per currency; no exchange-rate conversion occurs. Store settings defines whether tax is included or added for each supported currency. Product saves use that setting. Changing it creates new active price versions and preserves historical prices and orders. The migration seeds settings from the most recently updated product with an active price in each currency, defaulting to tax included when none exists. Checkout confirms the final tax and total. Portal invoices preserve that exact tax amount rather than reconstructing it from a rounded percentage.

Register `POST /api/store/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. Use the Stripe CLI to forward test events to the same route on `localhost`. Keep test and live keys, webhook secrets, and data in separate installations.

Complete the invoice sender profile and the portal email provider configuration before opening the store. No Stripe invoice is created; the portal issues the sales invoice and records the payment. Stripe may send its payment receipt according to the account's settings.

### Storage

Storage can be supplied by deployment environment variables or configured in **Store settings → Storage**. Environment configuration takes precedence and locks the form. Saved access credentials are encrypted with `PRODUCTS_STORAGE_ENCRYPTION_KEY`, are never returned to the browser, and must pass a write/head/delete connection probe before they replace a working configuration.

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

Create a key in Store settings. Keep it exclusively on the external website's server. Keys are shown once, stored as SHA-256 hashes, revocable, and optionally expiring. Rotate by creating a replacement, switching the website, then revoking the old key. Keys are scoped to published catalog reads and limited to 120 requests/minute; requests from one source IP also share a 120/minute authentication limit. Portal purchase entry points are limited to 30/minute per source IP.

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
- Products include `id`, `slug`, `type`, `categoryId`, `category` (code), `categoryDetails`, `title`, `summary`, `descriptionHtml`, gallery `images`, `thumbnailImage`, `detailImages`, `videoUrl`, `prices`, `purchaseUrl`, and `locale`. Prices include a stable version `id`, `currency`, integer minor-unit `amount`, and `taxBehavior`.
- Errors: 400 invalid query; 401 missing, revoked, or expired key; 404 unavailable product; 429 rate limit; 503 store closed/unconfigured.
- No private assets, order details, customer information, or unpublished products are included. Catalog responses are not shared-cacheable.

Product pages are intentionally public so a buyer can follow a purchase URL. Catalog enumeration requires an API key. Translated copy falls back to the store's default language. Returned `locale` is the requested display language; individual content may be fallback text.

## Extension contracts

`registerPurchaseIntegration` connects invoice generation, refunds, and notification delivery without a Products dependency on Invoices. `registerPurchaseFulfillmentHook` registers an idempotent, transactional hook keyed by order ID. A later appointments bridge can attach bookings to purchased service orders; current service orders require manual scheduling and completion. Payment behavior lives behind `PaymentProvider`; Stripe is the only implemented adapter. Polar requires separate merchant-of-record invoicing behavior.

Not included: physical products, shipping, inventory, booking capacity, carts, subscriptions, coupons, course lessons/progress, or media transcoding.

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
