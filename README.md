# Nuxt Customer Portal

**A customer portal you can make your own.**

Start with client access, timesheets, approvals, and invoicing. Extend it with modules built around your business. Nuxt Customer Portal is open source under the MIT License, built with Nuxt, and used by our small software agency for timesheets and invoicing.

[Documentation](https://nuxt-customer-portal.com) · [Try the demo](https://demo.nuxt-customer-portal.com) · [Installation](https://nuxt-customer-portal.com/getting-started/installation) · [Build a module](https://nuxt-customer-portal.com/contributing/create-a-layer)

## Create your portal

```bash
npx @nuxt-customer-portal/kit@0.1.0-alpha.0 init my-portal
```

The wizard creates the configurable application, generates secrets, installs
packages, prepares a new database, and creates your administrator. Then start the
app and finish branding and module setup in your browser. The command requires
matching published packages; see [Installation](https://nuxt-customer-portal.com/getting-started/installation)
for prerequisites and the source-checkout option before publication.

## Start with a working workflow

- **Your team** records time against client projects, submits weeks, and reviews approvals.
- **Your clients** sign in to their own organization to view shared time, approve or dispute it when assigned as reviewers, and access issued invoices when enabled.
- **Your agency** creates free-form invoices or invoices approved billable time, sends PDFs, and records payments.

Client access is configurable: creating a client record does not automatically expose all its time or invoices. See [client access](https://nuxt-customer-portal.com/guides/client-access) and the [first workflow](https://nuxt-customer-portal.com/getting-started/first-workflow).

Timesheets and Invoices work independently. The optional Invoice Timesheets bridge connects approved time to invoice creation.

## Extend it around your business

The portal provides authentication, organizations, client management, permissions, and a shared UI. A module adds its own pages, API, translations, and database schema, and registers its navigation, dashboard widgets, and policies with the portal.

Keep a module in your application or distribute it as a Nuxt layer. Your host owns branding and presentation. You can build on the existing workflows without putting your business logic into portal core.

- [Understand the architecture](https://nuxt-customer-portal.com/architecture/overview)
- [Create a feature layer](https://nuxt-customer-portal.com/contributing/create-a-layer)
- [Distribute a feature layer](https://nuxt-customer-portal.com/contributing/distribute-a-layer)

Service Requests is an optional example extension for developers. It demonstrates a smaller module and is not required for the timesheet and invoicing setup.

## Choose how to start

| Goal                               | Start here                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Explore the interface              | [Public demo](https://demo.nuxt-customer-portal.com)                                                                       |
| Evaluate with help setting up      | [Request a hosted evaluation at PortalNuxt](https://portalnuxt.com)                                                        |
| Build your own portal              | [Install the packages in a Nuxt application](https://nuxt-customer-portal.com/getting-started/installation)                |
| Configure the included application | [`apps/saas-portal`](apps/saas-portal) and [customization](https://nuxt-customer-portal.com/getting-started/customization) |
| Work on the project itself         | [Contributing](CONTRIBUTING.md)                                                                                            |

The packages are in alpha. Read the [compatibility and release guidance](https://nuxt-customer-portal.com/reference/compatibility-and-releases) before adopting or upgrading.

## Packages

| Package                                    | Purpose                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `@nuxt-customer-portal/core`               | Headless auth/session, tenancy, authorization, registry, database, and contracts |
| `@nuxt-customer-portal/ui`                 | Neutral fallback layouts, dashboard, navigation, modals, and notifications       |
| `@nuxt-customer-portal/authentication`     | Authentication routes and forms                                                  |
| `@nuxt-customer-portal/organizations`      | Profile, organizations, membership, and invitations                              |
| `@nuxt-customer-portal/clients`            | Shared client profiles, memberships, and module activation                       |
| `@nuxt-customer-portal/service-requests`   | Optional example extension for module developers                                 |
| `@nuxt-customer-portal/timesheets`         | Optional time, approval, and reporting feature                                   |
| `@nuxt-customer-portal/invoices`           | Standalone invoicing, delivery, payment, and client-access feature               |
| `@nuxt-customer-portal/invoice-timesheets` | Optional bridge for invoicing approved Timesheets entries                        |
| `@nuxt-customer-portal/preset`             | Core, UI, authentication, provider organizations, and clients                    |
| `@nuxt-customer-portal/kit`                | Portal configuration, diagnostics, and migration CLI                             |

Public package versions are managed with Changesets. Publishing a GitHub release triggers package verification and npm publication. Prepare documentation on a branch, verify the released packages in a fresh application, then publish the matching docs; see the [documentation release checklist](apps/docs/README.md#release-checklist).

## Repository development

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm pack:check
```

Run `pnpm dev:apex`, `pnpm dev:brutal`, `pnpm --filter @nuxt-customer-portal/saas-portal dev`, or `pnpm dev:docs`. Apex uses a conventional header/sidebar shell; Brutal uses an independent editorial command-bar/two-pane shell. The SaaS portal adds guided, organization-specific configuration for branding, appearance, modules, public content, support, and legal pages.

The unchanged combined migration history is under `legacy/drizzle`. Use `db adopt-legacy` to verify and map a recognized installation before stamping package baselines.

Copyright © 2026 Nuxt Customer Portal contributors. Distributed under the [MIT License](LICENSE).
