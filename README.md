# Nuxt Customer Portal

MIT-licensed Nuxt 4 layers for authentication, owner and client organizations, Service Requests, Timesheets, and invoicing. The repository includes public packages, two structurally distinct demos, migration tooling, documentation, and a ready-to-run SaaS portal configurable for your own organization.

- [Documentation](https://nuxt-customer-portal.com)
- [Request a hosted evaluation at PortalNuxt](https://portalnuxt.com)
- [Installation](https://nuxt-customer-portal.com/getting-started/installation)
- [Architecture](https://nuxt-customer-portal.com/architecture/overview)
- [Package compatibility](https://nuxt-customer-portal.com/reference/compatibility-and-releases)

## Packages

| Package                                    | Purpose                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `@nuxt-customer-portal/core`               | Headless auth/session, tenancy, authorization, registry, database, and contracts |
| `@nuxt-customer-portal/ui`                 | Neutral fallback layouts, dashboard, navigation, modals, and notifications       |
| `@nuxt-customer-portal/authentication`     | Authentication routes and forms                                                  |
| `@nuxt-customer-portal/organizations`      | Profile, organizations, membership, and invitations                              |
| `@nuxt-customer-portal/clients`            | Shared client profiles, memberships, and module activation                       |
| `@nuxt-customer-portal/service-requests`   | Optional Service Requests feature                                                |
| `@nuxt-customer-portal/timesheets`         | Optional time, approval, and reporting feature                                   |
| `@nuxt-customer-portal/invoices`           | Standalone invoicing, delivery, payment, and client-access feature               |
| `@nuxt-customer-portal/invoice-timesheets` | Optional bridge for invoicing approved Timesheets entries                        |
| `@nuxt-customer-portal/preset`             | Core, UI, authentication, provider organizations, and clients                    |
| `@nuxt-customer-portal/kit`                | Portal configuration, diagnostics, and migration CLI                             |

Public package versions are managed with Changesets. Publishing a GitHub release verifies the package tarballs and publishes every unpublished version to npm through trusted publishing.

## Consumer setup

```bash
pnpm add @nuxt-customer-portal/preset @nuxt-customer-portal/kit
pnpm add @nuxt-customer-portal/service-requests @nuxt-customer-portal/timesheets @nuxt-customer-portal/invoices @nuxt-customer-portal/invoice-timesheets
```

```ts
// portal.config.ts
import { definePortalConfig } from '@nuxt-customer-portal/kit'

export default definePortalConfig({
  layers: [
    '@nuxt-customer-portal/preset',
    '@nuxt-customer-portal/service-requests',
    '@nuxt-customer-portal/timesheets',
    '@nuxt-customer-portal/invoices',
    '@nuxt-customer-portal/invoice-timesheets'
  ]
})
```

```ts
// nuxt.config.ts
import portal from './portal.config'

export default defineNuxtConfig({ extends: portal.nuxtLayers })
```

Validate and migrate the configured providers:

```bash
npx nuxt-customer-portal doctor
npx nuxt-customer-portal db status
npx nuxt-customer-portal db migrate
```

## Repository development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm pack:check
```

Run `pnpm dev:apex`, `pnpm dev:brutal`, `pnpm --filter @nuxt-customer-portal/saas-portal dev`, or `pnpm dev:docs`. Apex uses a conventional header/sidebar shell; Brutal uses an independent editorial command-bar/two-pane shell. The SaaS portal adds guided, organization-specific configuration for branding, appearance, modules, public content, support, and legal pages.

The unchanged combined migration history is under `legacy/drizzle`. Use `db adopt-legacy` to verify and map a recognized installation before stamping package baselines.

Copyright © 2026 Nuxt Customer Portal contributors. Distributed under the [MIT License](LICENSE).
