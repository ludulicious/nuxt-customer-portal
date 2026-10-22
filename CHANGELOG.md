# Nuxt Customer Portal

## 0.8.6

Fix the starter wizard rejecting valid module selections that include invoice
integrations. Saved setup metadata can be normalized again when resuming setup.

All 16 public packages and the three portal apps use `0.8.6`. No new database
migrations are required when upgrading from `0.8.5`. Use `0.8.6` for new portals.

## 0.8.5

Make manual fulfillment an explicit product setting, off by default for digital
products and services. New orders retain the setting from the time of purchase.

Open customer-facing details and individual invoices from order cards, and return
to the same search, filters, sorting, page and scroll position. Disable Invoice
when no invoice exists. Reduce email status lookups by caching attempts, skipping
resolved deliveries and backing off checks for older unresolved messages.

Share the branded product receipt layout across thank-you and order pages, and
clearly identify test orders using the saved purchase mode.

All 16 public packages and the three portal apps use `0.8.5`. No new database
migrations are required when upgrading from `0.8.4`.

## 0.8.2

Use neutral order confirmation wording for free, paid, and invoiced orders.
Align checkout result sections and improve download actions on mobile. Preserve
localized download filenames and extensions across storage delivery paths.

All public packages and portal apps use `0.8.2`. No new database migrations are
required beyond those included in `0.8.0`.

## 0.8.1

Show every required store currency when editing product prices. Validate positive
amounts before saving, including on draft products, and display actionable
validation messages instead of incorrectly reporting that a price is already in use.

All public packages and portal apps use `0.8.1`. No new database migrations are
required beyond those included in `0.8.0`.

## 0.8.0

Accept purchases with online payment, later invoicing, or both. Deferred orders
release files and confirm appointments immediately while creating one unsent
invoice draft. Review the tax breakdown without changing the agreed total, then
use the existing invoice sending, payment recording, and reminder tools.

Add unlisted products with server-generated unguessable slugs. They remain
available through individual product pages and checkout while being excluded
from catalogs and appointment discovery. Existing prices and scheduled offers
also apply to unlisted products.

Provide permanent purchase-file links in emails and checkout results, with
tracked delivery requests and refund/dispute checks. Add validated conditional
email sections and previews with or without downloads.

Keep PR checks lightweight and move compatibility, packaging, browser, and
Docker verification to the shared release gate. npm and Docker publication both
wait for the full suite and use the same verified commit.

Apply Products migrations `0019_purchase_downloads.sql` and
`0020_deferred_payments.sql`, plus Invoices migration
`0004_deferred_invoice_review.sql`, before deploying. Apply all earlier pending
migrations as usual. Existing stores retain online payment and listed products.
Deferred checkout requires inclusive prices and the invoice integration. Deploy
the portal before the companion Shannon storefront update.

All public packages and portal apps use `0.8.0`.

## 0.6.1

Add reusable Harvest export and one-time import commands with read-only previews,
explicit member/client mappings, atomic imports, duplicate protection, and a
retained source journal.

Preserve historical people, credit notes, signed payments, written-off invoices,
invoice lifecycle events, and original source attribution. Protect externally
billed time against edits and rebilling, even without an invoice link.

Apply `timesheets/0008_imported_history.sql` and
`invoices/0003_imported_history.sql` before importing, and deploy the matching
Invoice Timesheets bridge. Includes English and Dutch import history labels and
migration documentation. Preview reports rounding and approximate invoice-line
associations; PDFs, attachments, and original emails are outside migration scope.

Pin Sharp to `0.35.3` across the workspace.

All public packages and portal apps use `0.6.1`.

## 0.6.0

Add weekly, two-weekly, and monthly client timesheet review periods while keeping
internal submissions and approvals weekly. Providers send combined requests once
all recorded time is ready; clients approve or dispute the whole period.

Preserve request snapshots and history through withdrawal, corrections, replacement
requests, and supplementary requests for late time. Require client approval before
invoicing review-enabled client time from the rollout date.

Apply `timesheets/0007_client_review_requests.sql` before deploying the new code.
The migration stores the first day of the following calendar month as the work-date
cutover. Earlier time retains its existing reviews and invoice eligibility.
Interval changes also take effect next month.

Include English and Dutch settings, request screens, dashboard counts, notifications,
and approval documentation.

All public packages and portal apps use `0.6.0`.

## 0.5.1

Track timesheet approval email recipients, send times, messages and delivery status.
Resend pending client and internal approval requests to current approvers with an
editable message generated from the configured email template.

Apply the new timesheet approval email migration before deployment. Earlier emails
are not reconstructed in the history.

All public packages and portal apps use `0.5.1`.

## 0.5.0

Add visual Markdown editing with a raw Markdown mode for product summaries and
descriptions and email bodies and footers. Preserve existing HTML and special
Markdown as protected source blocks.

Let email authors insert available placeholders at the cursor in either mode.
Keep placeholder names intact through visual edits, including underscores.

All public packages and portal apps use `0.5.0`.

## 0.4.9

Let developers select business modules during `init`, automatically include
required modules and integration layers, and generate only the selected portal
dependencies and configuration.

Hide email text settings for inactive modules.

All public packages and portal apps use `0.4.9`.

## 0.4.8

Control Google Calendar availability synchronization with a provider preference,
independently of the store environment, and synchronize current and future
availability when providers enable it.

All public packages and portal apps use `0.4.8`.

## 0.4.7

Keep Google Calendar settings recoverable when stored authorization expires and
offer reconnection after Google rejects a refresh token.

All public packages and portal apps use `0.4.7`.

## 0.4.6

Restore Google Calendar push notifications, retain provider-returned availability
event IDs, and expose those identifiers in planning synchronization diagnostics.

All public packages and portal apps use `0.4.6`.

## 0.4.5

Allow providers to save a primary calendar without selecting any additional
conflict calendars.

All public packages and portal apps use `0.4.5`.

## 0.4.4

Improve product administration with a dedicated detail route, safer lifecycle
and deletion actions, unsaved-change protection, and streamlined image
management.

Show every configured store currency in the product price editor, including
currencies without an active product price.

Keep authenticated OpenAPI schema loading reliable when the portal frontend is
served over HTTPS.

All 16 public packages use `0.4.4`.

## 0.4.3

Add a single portal-wide encryption key that derives isolated credentials for
Portal Core, Products, and Planning, while preserving module-specific key
overrides and legacy ciphertext compatibility.

Initialize a disabled sandbox Products store during fresh portal setup so
Planning works immediately when Products is enabled.

Keep shared validation schemas compatible with the Zod runtime resolved by
Nuxt production bundles.

All 16 public packages use `0.4.3`.

## 0.4.2

Split portal configuration into focused General settings and Appearance
workflows. Add explicit Business and Soft Editorial starting styles, preserve
legacy onboarding progress and stored themes, and keep long setup forms fully
scrollable.

All 16 public packages use `0.4.2`.

## 0.4.1

Keep fresh SaaS portal registration on the organization bootstrap flow instead
of treating the first administrator as a self-registering private client.
Personal clients remain available through invitations, while public personal
self-registration is disabled by default in the deployable SaaS portal.

All 16 public packages use `0.4.1`.

## 0.4.0

Add the Products and Planning modules, including a localized storefront,
multi-currency pricing, Stripe checkout, digital delivery, appointment booking,
provider availability, calendar synchronization, Zoom meetings, cancellations,
refunds, and customer purchase history.

Extend the shared portal with personal clients, invitation-based onboarding,
user timezones, configurable interface and store languages, appearance presets,
organization API keys, product media storage, and planning dashboard and repair
workflows. Invoice integration now creates immutable order-based invoice lines,
credit notes, localized purchase references, and delayed automated delivery.

The demo layer includes sample products, purchases, appointments, providers, and
planning policies. Documentation covers the new modules, storefront setup,
payments, storage, booking, and deployment configuration.

All 16 public packages use `0.4.0`. Keep the official packages on the same
version when upgrading and apply the package migrations before starting the
portal.

## 0.3.3

Generate lint-clean standalone portals with ESLint and Prettier configuration,
dependencies, and working format commands. Packed starter verification now
checks linting, formatting, and repeatable formatting fixes.

Allow interactive setup to copy optional website pages into the host project,
where they can be customized independently of package updates. A safe
`page copy` command can copy individual package-provided pages later without
overwriting existing files.

All 13 official packages use `0.3.3`.

## 0.3.2

Add the shared interactive demo with seven sample identities, avatars, seeded
timesheets and invoices, and daily resets. Demo deployments restrict account
changes and outgoing email. The Apex Docker image enables demo mode by default
and applies migrations before startup.

Polish Service Requests with a unified permission-aware workspace, consistent
filters and pagination, repaired editing and deletion, and working management
controls. Prioritize time and invoices on the dashboard and in navigation.

Make header branding link to the public home page, reserve space for the demo
bar, and improve PostgreSQL URL guidance in interactive setup.

All 13 official packages use `0.3.2`. Demo mode remains opt-in for regular
installations. See the [screenshot guide](docs/issue-4-demo-screenshots.md).

## 0.3.1

Fix starter generation on Node 24. Template files now copy into new or existing
empty project directories without triggering `ERR_FS_CP_EEXIST`; existing user
files remain protected. CI checks the starter on Node 22 and Node 24.

All official packages use `0.3.1` to preserve matching versions.

## 0.3.0

The first npm release of the configurable customer portal and its 13 public
packages. Official packages now share version `0.3.0`, without an alpha suffix.

### Create a portal from one command

```sh
npx @nuxt-customer-portal/kit@0.3.0 init my-portal
```

The interactive setup creates a standalone Nuxt application, generates secrets,
installs dependencies, prepares an empty PostgreSQL database, and creates a
verified administrator. Choose Docker or an existing empty database, then finish
branding, modules, homepage content, and legal pages in the browser.

Timesheets, Invoices, and their integration start enabled. Client access is part
of the shared platform. Service Requests remains an optional example module.

### Packages and documentation

- Publish the configurable portal layer and its themes as
  `@nuxt-customer-portal/saas-configuration`.
- Resolve preset dependencies correctly in pnpm's isolated installations.
- Document installation, the first agency workflow, client access, and module
  development, with manual installation available for existing Nuxt hosts.
- Include package changelogs and keep portal manifests aligned with package versions.

### Upgrade notes

Invoices are an independent module. Integrating approved time into invoices
requires `@nuxt-customer-portal/invoice-timesheets` alongside Timesheets and Invoices.
Legacy `/timesheets/invoices`, `/admin/timesheets/invoices`, and Timesheets invoice
API routes have been removed. Use `/invoices`, `/admin/invoices`, `/api/invoices`,
and `/api/invoice-timesheets` instead.

Keep every official package on the same version. Before `1.0`, minor releases may
contain documented breaking changes; patch releases preserve compatibility.
