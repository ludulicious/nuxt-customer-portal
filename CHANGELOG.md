# Nuxt Customer Portal

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
