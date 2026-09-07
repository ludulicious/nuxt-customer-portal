# Nuxt Customer Portal

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
