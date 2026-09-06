# Nuxt Customer Portal

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
