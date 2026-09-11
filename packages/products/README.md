# Products

A single provider-owned store for digital files and services. Includes English/Dutch product content, versioned one-time currency prices, published catalog access, Stripe Checkout, purchaser-only downloads/playback, and a purchase library. Install `@nuxt-customer-portal/invoice-products` and `@nuxt-customer-portal/invoices` for checkout and invoice delivery.

## Installation

Add `@nuxt-customer-portal/products`, `@nuxt-customer-portal/invoices`, and `@nuxt-customer-portal/invoice-products` to `portal.config.ts` layers and run the portal migration command. Enable personal and organization clients. In the configurable SaaS portal, enable all three modules in portal settings. Existing installations remain closed for new sales until an owner saves Store settings and explicitly opens the store.

The provider organization's owners and administrators manage Products, Orders, and Store settings. Customer access is always checked against the purchaser's verified account, independently of company membership and invoice-viewing permissions.

Categories are maintained in Store settings or from the product form. Renaming updates the catalog; purchased snapshots remain unchanged. Categories used by any product cannot be deleted. Existing free-text categories are imported by the category migration.

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
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Standard AWS credentials, or use the SDK's role-based credential chain          |

Configure Stripe Tax and the seller's registrations in Stripe. Assign the appropriate Stripe tax code to each product. The initial catalog supports EUR, USD, GBP, CAD, AUD, NZD, CHF, DKK, NOK, SEK, PLN, CZK, HUF, RON, JPY, HKD, SGD, and AED. Availability still depends on the Stripe account and payment method. Other currencies require an adapter/validation extension; currencies with special Stripe amount representations are deliberately excluded. See [Stripe currency rules](https://docs.stripe.com/currencies). Prices are explicitly entered per currency, including whether tax is included or added; no exchange-rate conversion occurs. Checkout confirms the final tax and total. Portal invoices preserve that exact tax amount rather than reconstructing it from a rounded percentage.

Register `POST /api/store/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. Use the Stripe CLI to forward test events to the same route on `localhost`. Keep test and live keys, webhook secrets, and data in separate installations.

Complete the invoice sender profile and the portal email provider configuration before opening the store. No Stripe invoice is created; the portal issues the sales invoice and records the payment. Stripe may send its payment receipt according to the account's settings.

### Storage

Keep the entire bucket private; public promotional images are exposed through checked portal redirects, not public bucket ACLs. Permit presigned POST uploads and GET/HEAD downloads from the exact portal origin in bucket CORS. Allow the `Content-Type` and `Range` request headers and expose `Content-Length`, `Content-Range`, `Accept-Ranges`, and `ETag`. Give the server permission to create uploads, inspect objects, and read objects in the `products/` prefix.

Images support JPEG, PNG, WebP, and AVIF up to 10 MB. Purchased files support PDF, ZIP, DOCX, text, MP3, M4A, WAV, OGG, MP4, and WebM up to 2 GB. Upload requests constrain size and declared content type, and completion verifies the stored metadata. Object URLs expire after five minutes. Browser-compatible audio/video uses native playback; there is no transcoding, adaptive streaming, DRM, or malware scanner. Save a draft first, upload its files, then save their ordering and publish.

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

- `GET /api/store/v1/products`: query `locale`, `currency`, `search`, `category`, `type`, `page`, `sortBy`, `sortDir`. Pages contain 20 products and `pagination` with `page`, `pageSize`, `totalItems`, `totalPages`.
- `GET /api/store/v1/products/{slug}`: one published product, optionally filtered by `locale` and `currency`.
- Products include `id`, `slug`, `type`, `category`, `title`, `summary`, `descriptionHtml`, `images`, `videoUrl`, `prices`, `purchaseUrl`, `locale`. Prices include a stable version `id`, `currency`, integer minor-unit `amount`, and `taxBehavior`.
- Errors: 400 invalid query; 401 missing, revoked, or expired key; 404 unavailable product; 429 rate limit; 503 store closed/unconfigured.
- No private assets, order details, customer information, or unpublished products are included. Catalog responses are not shared-cacheable.

Product pages are intentionally public so a buyer can follow a purchase URL. Catalog enumeration requires an API key. Translated copy falls back to the store's default language. Returned `locale` is the requested display language; individual content may be fallback text.

## Extension contracts

`registerPurchaseIntegration` connects invoice generation, refunds, and notification delivery without a Products dependency on Invoices. `registerPurchaseFulfillmentHook` registers an idempotent, transactional hook keyed by order ID. A later appointments bridge can attach bookings to purchased service orders; current service orders require manual scheduling and completion. Payment behavior lives behind `PaymentProvider`; Stripe is the only implemented adapter. Polar requires separate merchant-of-record invoicing behavior.

Not included: physical products, shipping, inventory, booking capacity, carts, subscriptions, coupons, course lessons/progress, or media transcoding.

## Tests

Run `pnpm test:packages` and the host's Nuxt typecheck. To include the Products integration test, set `PRODUCTS_TEST_DATABASE_URL` to an **empty disposable PostgreSQL database** whose name starts with `codex_products_test_`. That test applies migrations and creates fixtures; never point it at portal data.

### Store currencies and free products

Store Settings defines supported currencies (at least one). Paid product saves require positive prices in every supported currency. Adding a currency preserves existing prices; existing products must be updated before checkout is available again. Removed currencies are excluded from public pricing; historical orders retain their original prices. The migration initializes the store currencies from existing active prices, or EUR for an empty store.

Mark a product as free to skip price entry. Internally a zero-value price preserves order references. Free acquisition uses the normal client, delivery, and purchase email flow without Stripe or an invoice. Store activation prerequisites still apply.
