# Changelog

## Unreleased

## 0.13.0 ? 2026-11-13

### SaaS portal as the main application

- Keep apps/saas-portal as the sole portal application and apps/docs as the documentation website. Retain business and platform modules as separate private pnpm workspaces under packages/ with their existing internal imports.
- Support installation by source checkout or the Docker image. pnpm 10.30.2 is the only supported package manager; other managers require a fork. Node.js 22.19 or newer on a supported Nuxt-compatible LTS release is required for source development.
- Remove the kit, generated-project installer, preset composition package, alternate Apex/Brutal apps, npm publishing/consumer checks and package Changesets. Use one root product version and changelog for source and Docker releases.
- Preserve migrations, diagnostics, provider/admin setup and Harvest import as repository operations. Core exports the configuration helpers; the main app composes its modules explicitly.
- Rewrite setup, customization, architecture, module development and release documentation around the repository code. Add source/Docker Compose examples and keep the documentation catalog and source references aligned.
- Normalize CRLF line endings when checking documentation metadata, so the content tests work in Windows checkouts as well as Linux CI.

### Integrated demo

- Run the same app and Docker image in a separate demo deployment with seven fictional identities, business fixtures and daily resets.
- Seed completed onboarding and enabled modules. Branding, appearance, content and module settings are read-only; visitor-specific settings remain deferred.
- Gate requests until initialization completes. Refuse mismatched demo flags, non-demo databases and populated databases without reset metadata. Preserve role/tenant checks and restrictions on account/access changes and external effects.

### Upgrade from 0.12.5

- Back up PostgreSQL and file storage. There are no new SQL migrations in this release relative to 0.12.5, and existing migration filenames, checksums and journal columns are preserved.
- Source users should use the repository checkout instead of a generated host or installed official packages. Port host customizations into apps/saas-portal and retain the existing database and secrets. Internal workspace imports keep their names.
- Replace old kit commands with repository-root commands: pnpm db:doctor, pnpm db:status, pnpm db:migrate and pnpm portal for provider/admin and Harvest operations. Docker startup calls the same scripts automatically.
- Docker users should pin ghcr.io/ludulicious/nuxt-customer-portal:0.13.0 or its immutable digest. Startup applies any outstanding migrations before serving traffic; keep existing persistent data and storage configuration.
- Demo deployments must use their own database ending in _demo and set both NUXT_PORTAL_DEMO_ENABLED=true and NUXT_PUBLIC_PORTAL_DEMO_ENABLED=true. Both flags remain disabled for normal installations. Retire old Apex/Brutal app deployments after moving to the main image.
- Private modules no longer have independent versions or releases. The historical package_version migration-journal column remains compatible and records the product version for new entries.

## 0.12.2?0.12.5 ? Historical Docker releases

These releases previously advanced the Docker image while the root/package version stayed at 0.12.1. The pending notes below describe changes already delivered in that series; they are retained here as product history rather than presented as new 0.13.0 features.

- 0.12.2: Invoice attachment selection, handle-only line sorting and connected website support.
- 0.12.3: Source-code verification and verification-gated Docker release automation.
- 0.12.4: Portal favicons, client approval clarity and consolidated workspace settings.
- 0.12.5: Recurring invoice schedules, submitted-only monthly client approval preparation and disabled-module navigation filtering.

Clarify client approvals with one month filter for both hours to send and approval requests, compact review periods, hidden empty periods, explicit sending blockers, and no historical archive on the monthly screen.

Use the client’s Track hours module switch for new time entry, project choices, and review preparation, while preserving historical time and sent requests.

Allow an arbitrary starting month for review intervals when no recorded time or approval requests exist in that month or later, with transactional conflict protection and preservation of earlier schedules.

Show active hour-tracking clients as tags on the approvals page, with administrator controls to enable or disable tracking in place.

Include earlier submission-based approval decisions and unsubmitted hours in the selected monthly view, without duplicating already approved hours as unsent.

Show company avatars on monthly hours and approval request cards, falling back to logos or initials.

Send client approval requests only after an explicit manual action; internal approvals and submissions never create or email client requests automatically.

Show internally approved hours as Auto approved when the client does not require review, without duplicating them under hours to send.

Scope empty periods to active tracked clients and add a shared monthly client filter, with icons for both approval sections.

Reduce repetitive page explanations and shorten labels and empty states in English and Dutch.

Prepare each selected month in async setup and retain the previous view with Suspense to avoid intermediate loading layout shifts.

Hide Planning and Store navigation, dashboard widgets, and other feature contributions when their modules are disabled in portal settings. Apply the same module filtering to product invoicing integrations.

Make the invoice Attach file action open the file chooser directly and upload the selected file, with busy-state protection and same-file retry support.

Restrict invoice line dragging to the left handle and disable drag and keyboard reordering while a line editor is open.

Add recurring invoice schedules with daily, weekly, monthly, quarterly and yearly periods, inclusive start/end dates, timezone-aware draft generation with same-run catch-up, localized current- and previous-period placeholders for billing in advance or arrears, and pause/resume administration.

Only include submitted or internally approved timesheets in client approval preparation and sending. Draft, reopened, and rejected timesheets no longer appear as awaiting internal approval or block sending other submitted work.

Default client approval periods to monthly when no interval is configured, grouping submitted weeks and partial weeks by work date. Preserve explicitly configured weekly, fortnightly, and monthly intervals.

Align Workspace settings labels and icons across Timesheets, Planning, and Store. Place Timesheets settings after Reports and move internal approval configuration into a Workspace settings tab, retaining redirects for existing links.

Keep time entry available independently of internal approvals, and correctly restrict the internal approval queue to assigned approvers while approvals are enabled.

Move client tracking into the Clients tab of Timesheets Workspace settings. Show all active clients with search, tracking filters and labelled switches, plus inline editing of client access, approval interval and its protected starting month.

Move Team rates into the Team members tab after Clients, and add icons to each settings tab.

## 0.12.1

Fix invoice line editor type checking in clean generated portal installations
without changing draft editing or sorting behavior. Keep Yarn consumer verification
compatible with the supported Node 22.19 baseline by selecting the workspace-tested
Nuxt development dependency rather than a newer incompatible transitive release.

Run full verification before merging release-infrastructure and package-version
changes, and retain browser failure reports, screenshots, and traces for diagnosis.

All 16 public packages and the three portal apps use `0.12.1`. This patch carries
the `0.12.0` features forward without moving its published tag. No new database
migrations are required. npm and Docker publication still require every release
verification job to succeed.

## 0.12.0

Configure trusted connected websites in General settings for credentialed account
session checks and sign-out. Access stays opt-in and limited to explicitly allowed
origins; custom hosts can use `PORTAL_AUTH_WEBSITE_ORIGINS`.

Restore draft invoice line editing and direct New invoice navigation. Add and
remove lines, edit one line at a time, drag to reorder with keyboard support, and
focus the new description automatically. Display VAT as a percentage and use the
workspace default for new draft lines without changing existing rates. Skip
disabled invoice sources and the source-selection step when only free-form
invoicing is available. Open duplicated invoices and credits in draft edit mode.

Restore native Nuxt UI defaults instead of the legacy blue/slate skin, retaining
neutral surfaces, primary-colored interaction states, explicit appearance
overrides, and the separate Brutal theme. Keep light/dark live previews isolated
from saved custom surfaces. Align the primary color controls and remove the logo
fallback sublabel.

Suggest editable client slugs from display names and use `/clients/<slug>` for
details. Preserve saved slugs when names change, show duplicate-slug errors
inline, redirect legacy ID links, and retain list return state after slug edits.
Previously used slugs are not retained as aliases.

All 16 public packages and the three portal apps use `0.12.0`. No new database
migrations are required when upgrading from `0.11.0`. Review connected website
origins, custom appearance overrides, client detail links, and invoice editing
before deployment. npm and Docker publication remain blocked until full release
verification succeeds; a GitHub release alone does not establish availability.

## 0.11.0

Add Duplicate invoice and Credit invoice actions that create drafts without
sending emails. Full credit notes reference the original invoice and reverse its
rounded amounts and exact tax, with protection against multiple active credits.
Allow administrators to permanently delete unissued drafts after confirmation,
releasing linked timesheets for invoicing again. Preview and refresh draft
recipient details from current client data, including the billing contact, while
preserving issued invoice snapshots and organization boundaries.

Use the portal's light-mode full logo on invoice details and PDFs, falling back
to the provider organization logo. Support uploaded PNG, JPEG, and WebP branding
in PDF output. Explain email-provider encryption configuration failures in email
settings and log server failures with secret-safe structured diagnostics.

All 16 public packages and the three portal apps use `0.11.0`. No new database
migrations are required when upgrading from `0.10.3`. Review draft invoice
actions, credit notes, recipient refresh, invoice branding, and email-provider
configuration before deployment. Keep the existing encryption key when one is
already configured; do not replace it as a troubleshooting step.

## 0.10.0

Add separate desktop and mobile authentication backgrounds with upload, preview,
removal, and single-image fallback controls. Keep existing branding compatible
and position sign-in forms near the top on mobile.

Send the portal home route to `/dashboard` and logout directly to `/login`.
Improve sign-in welcome and required-field messages in English and Dutch. Remove
redundant main-navigation links, clarify Account Settings labels, and use the
standard portal background for account settings. Personal client avatars use the
account owner's profile image when available.

Notify store owners of paid or accepted orders and appointment hosts of bookings,
updates, and cancellations with customizable English/Dutch emails and retry-safe
delivery. Silence calendar synchronization notices while preserving conflict
alerts and customer appointment notifications.

All 16 public packages and the three portal apps use `0.10.0`. No new database
migrations are required when upgrading from `0.9.1`. Review the home-route and
logout changes in custom integrations and the new internal notification templates
before deployment.

## 0.9.1

Include the media library, product image selection, and unified sidebar from
`0.9.0`, whose full verification failed before npm or Docker publication.

Avoid generated API route type-inference limits when loading timesheet navigation
capabilities and switching demo users. Keep the invoice sender form compatible
with current Vue template type checking. Let consumer modules resolve their required Nuxt Kit versions during
release verification instead of forcing an incompatible older version.

All 16 public packages and the three portal apps use `0.9.1`. Apply the same
Products migrations `0024_media_library.sql`, `0025_media_variants.sql`, and
`0026_product_media.sql` when upgrading from `0.8.9`.

## 0.9.0

Add a store media library with Studio-style image editing, batch review, retained
originals, configurable variants and independent crops. Select shared media for
product images, reorder cards with drag or keyboard controls, and protect images
used by products from deletion. Existing product images and purchased files are
preserved.

Add opt-in unified sidebar navigation with nested module pages, collapsed flyouts,
global search entries and footer collapse controls. SaaS Portal enables this layout.

All 16 public packages and the three portal apps use `0.9.0`. Apply Products
migrations `0024_media_library.sql`, `0025_media_variants.sql`, and
`0026_product_media.sql` before deploying. Keep all official packages aligned.

## 0.8.9

Show scheduled appointment dates, time ranges, and customer timezones on thank-you
and order details pages. Rescheduled times and cancellation status stay current.
Store texts previews can include a sample appointment with an adjustable UTC date,
time, and display timezone.

Resolve Google and GitHub sign-in button visibility from the running server’s
opt-in settings and credentials, including in prebuilt portal images.

All 16 public packages and the three portal apps use `0.8.9`. No new database
migrations are required when upgrading from `0.8.8`.

## 0.8.8

Avoid generated API route type-inference limits by retrieving admin order details
through the existing authenticated orders endpoint. Includes the portal branding
and admin order detail improvements from `0.8.7`.

All 16 public packages and the three portal apps use `0.8.8`. Release `0.8.7`
failed full verification before npm packages or a portal image were published.
No new database migrations are required when upgrading from `0.8.6`.

## 0.8.7

Purchase pages inherit the portal logo unless a checkout-specific logo is defined.
Order and thank-you logos and their return links align left, and store settings
have more space below their tabs.

Admin order cards open a regular portal page with a customer and client overview,
payment and invoice information, and a **Client order details** card showing the
customer-facing content without its logo header. Public client links remain available.

All 16 public packages and the three portal apps use `0.8.7`. No new database
migrations are required when upgrading from `0.8.6`.

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
