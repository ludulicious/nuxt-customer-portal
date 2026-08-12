# Nuxt Customer Portal layers

Reusable capabilities live in public packages under `packages/`. Host branding, public pages, and shells live in `apps/`.

## Consumer composition

```ts
// portal.config.ts
import { definePortalConfig, localPortalLayer } from '@nuxt-customer-portal/kit'

export default definePortalConfig({
  layers: [
    '@nuxt-customer-portal/preset',
    '@nuxt-customer-portal/timesheets',
    '@nuxt-customer-portal/invoices',
    '@nuxt-customer-portal/invoice-timesheets',
    localPortalLayer({
      id: 'acme-billing',
      source: './layers/acme-billing',
      schema: './layers/acme-billing/server/db/schema',
      migrations: './layers/acme-billing/migrations',
      dependsOn: ['core']
    })
  ]
})
```

```ts
// nuxt.config.ts
import portal from './portal.config'

export default defineNuxtConfig({
  extends: portal.nuxtLayers
})
```

Every Nuxt layer has `nuxt.config.ts` as its package entry point and a stable `$meta.name`. Package-internal imports may use that named alias; cross-package imports must use public exports.

## Public boundaries

- `@nuxt-customer-portal/core/feature` — feature, policy, badge, component-name, and surface contracts.
- `@nuxt-customer-portal/core/server` — sessions, active organization, authorization, and database adapters.
- `@nuxt-customer-portal/core/schema` — official core schema exports.
- `<feature>/feature`, `<feature>/types`, `<feature>/schema`, and `<feature>/portal-manifest` — feature-owned interfaces.

Do not use host aliases, physical cross-package paths, or imports from platform packages to optional features. Register visual integrations through `PortalSurfaceContribution` instead.

## Package ownership

- `core` is visually headless and owns auth infrastructure, tenancy, authorization, database access, registry, contracts, and generic OpenAPI merging.
- `ui` owns neutral shell primitives, fallback layouts, menus, modals, dashboards, and surface rendering.
- `authentication`, `organizations`, and `clients` form the rest of the preset.
- `service-requests`, `timesheets`, and `invoices` are optional business packages. `invoice-timesheets` is an optional integration depending on the latter two.
- `kit` owns config resolution, diagnostics, provider ordering, migrations, and legacy adoption.

## Feature package checklist

1. Add `package.json`, `nuxt.config.ts`, and a stable `$meta.name`.
2. Export a `PortalLayerManifest` with a unique provider ID, version, dependencies, schema, and immutable migration directory.
3. Own pages, APIs, translations, policies, schemas, and tests inside the package.
4. Declare all runtime dependencies and compatible Nuxt/Vue peers.
5. Put tables and enums in a provider-owned PostgreSQL schema.
6. Add English and Dutch locale keys with matching trees.
7. Put Zod-driven OpenAPI metadata beside the route via `definePortalRouteMeta()`.
8. Pack the package and validate it in a clean consumer without workspace links.

Apply migrations with `nuxt-customer-portal db migrate`. Disabling a package never removes its tables or data; permanent removal requires an explicit host-owned migration. Released migrations are immutable and checksum drift is rejected.

The complete authoring guide is maintained at [nuxt-customer-portal.com/contributing/create-a-layer](https://nuxt-customer-portal.com/contributing/create-a-layer).
