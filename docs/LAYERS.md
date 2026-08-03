# Portal feature layers

Feature layers add an isolated business capability to the portal. A layer can provide pages, components, composables, API routes, translations, permissions, dashboard widgets, and database tables without adding feature-specific code to the host application.

The service-request layer in `layers/service-requests` is the reference implementation.

## Architecture

The portal has two kinds of layers:

- `portal-core` defines the stable contracts shared by the host and feature layers.
- Feature layers, such as `service-requests`, implement one business capability.

The host application is intentionally thin. Its remaining pages and vertical
slices are owned by these layers:

- `public-site`: home, contact, blog content, and public-site assets.
- `authentication`: login, signup, password recovery, and verification flows.
- `account-organizations`: profile, settings, memberships, invitations, and organization configuration.
- `administration`: system-administrator user and organization management.

`portal-core` also owns the application shell, session/authentication plumbing,
shared authorization and database contracts, dashboard aggregation, and the
feature registry. The root `app` directory contains only the application entry,
configuration, error page, and global assets.

Feature code should depend on portal core instead of importing host files directly. Do not use `~/`, `~~/`, `useUserStore`, or `authClient` from a feature layer.

Use these portal-core interfaces instead:

- `usePortalSession()` for the current user, system role, active organization, and organization role.
- `usePortalFeatures()` to register navigation and dashboard contributions.
- `#portal/server/portal` for the database, authenticated session, active organization, and authorization.
- `PortalFeatureDefinition` and `PortalFeaturePolicy` for feature metadata and permissions.

Feature layers register complete modules through `PortalFeatureDefinition.modules`.
A module contribution defines its landing route, matching route prefixes,
audiences, ordering, and sidebar menu. The shell must not import a feature's
menu composable directly.

Drizzle schema files are the only exception to alias-only imports. Drizzle Kit does not resolve Nuxt aliases, so a feature schema may reference the physical portal-core schema path for foreign keys.

## Feature layer structure

Use this structure for a new feature:

```text
layers/<feature>/
├── nuxt.config.ts
├── package.json
├── README.md
├── app/
│   ├── components/
│   ├── composables/
│   ├── pages/
│   └── plugins/<feature>-feature.ts
├── i18n/locales/
│   ├── en.json
│   └── nl.json
├── server/
│   ├── api/
│   ├── db/schema/
│   └── utils/
├── shared/
│   ├── feature.ts
│   └── types/
└── test/
```

Nuxt automatically discovers directories immediately below `layers/` when they contain a `nuxt.config.ts`.

## Adding a feature

### 1. Create its layer configuration

```ts
// layers/timesheets/nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        name: 'English',
        file: 'en.json'
      },
      {
        code: 'nl',
        iso: 'nl-NL',
        name: 'Nederlands',
        file: 'nl.json'
      }
    ]
  }
})
```

Keep the locale object format consistent with the host and other layers. Nuxt i18n merges the files from all enabled layers.

### 2. Define the feature

```ts
// layers/timesheets/shared/feature.ts
import type { PortalFeatureDefinition } from '#portal/shared/types/feature'

export const timesheetActions = ['create', 'read', 'update', 'submit', 'approve'] as const
export type TimesheetAction = typeof timesheetActions[number]

export const timesheetsFeature: PortalFeatureDefinition<TimesheetAction> = {
  id: 'timesheets',
  navigation: [
    {
      id: 'timesheets',
      labelKey: 'features.timesheets.navigation.title',
      icon: 'i-lucide-clock',
      to: '/timesheets',
      audiences: ['authenticated'],
      order: 30
    }
  ],
  dashboardWidgets: [
    {
      id: 'timesheet-summary',
      component: 'TimesheetSummaryWidget',
      order: 30
    }
  ],
  policy: {
    owner: timesheetActions,
    admin: timesheetActions,
    member: ['create', 'read', 'update', 'submit']
  }
}
```

Available navigation audiences are `public`, `authenticated`, `organizationAdmin`, and `admin`. Component names in widget registrations refer to components auto-registered from the layer.

### 3. Register it

```ts
// layers/timesheets/app/plugins/timesheets-feature.ts
import { timesheetsFeature } from '../../shared/feature'

export default defineNuxtPlugin(() => {
  usePortalFeatures().registerFeature(timesheetsFeature)
})
```

The host automatically merges registered navigation and dashboard widgets. Do not edit the host navigation or dashboard for a feature.

### 4. Authorize server routes

```ts
import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '../../../shared/feature'

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'read'
  )

  // All queries must be scoped with organizationId.
})
```

`requireFeatureAccess` requires authentication, resolves the active organization, checks membership and the feature policy, and grants system administrators the standard bypass.

Never accept the tenant organization ID from the request body or query when it can be derived from the authenticated session.

### 5. Add the database schema

Place feature tables in:

```text
layers/<feature>/server/db/schema/*.ts
```

Every feature layer must own a separate PostgreSQL schema. Derive its name from
the layer name by replacing hyphens with underscores. For example, the
`timesheets` layer uses `timesheets`, and the `service-requests` layer uses
`service_requests`.

Declare the namespace with `pgSchema` and create every feature-owned table and
enum through it:

```ts
// layers/timesheets/server/db/schema/timesheets.ts
import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core'
import { organization, user } from '../../../../portal-core/server/db/schema/auth-schema'

export const timesheetsSchema = pgSchema('timesheets')

export const timesheetStatus = timesheetsSchema.enum('timesheet_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED'
])

export const timesheet = timesheetsSchema.table('timesheet', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  status: timesheetStatus('status').default('DRAFT').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})
```

Do not use the global `pgTable` or `pgEnum` helpers for feature-owned database
objects. Authentication and portal-core tables remain in PostgreSQL's `public`
schema. Cross-schema foreign keys from a feature schema to those public tables
are expected.

The root `drizzle.config.ts` discovers portal-core and feature schemas. The host owns one ordered migration history in `drizzle/`.

After changing a schema:

```bash
pnpm exec drizzle-kit generate --name=<descriptive-name>
```

Review generated SQL before applying it. Prefer renames over drop-and-create changes when data already exists. Apply migrations using the deployment environment's normal migration workflow.

Disabling a layer does not remove its tables or data.

### 6. Add translations

Keep every feature-owned message under a collision-safe namespace:

```json
{
  "features": {
    "timesheets": {
      "title": "Timesheets"
    }
  }
}
```

Do not place feature navigation, widget, validation, empty-state, or error messages in the host locale files. English and Dutch must contain the same key structure.

### 7. Use explicit types

Export feature types from `shared/types`. Prefer:

- Drizzle `$inferSelect` and `$inferInsert` for persistence types.
- Zod-inferred types for request input.
- Explicit DTOs for API output.

Do not add feature types to the global TypeScript namespace, and do not return raw database records from APIs.

## Enabling and disabling layers

### Enable a local layer

Place its directory directly under `layers/` and ensure it contains `nuxt.config.ts`:

```text
layers/timesheets/nuxt.config.ts
```

Restart the Nuxt development server after adding or re-enabling a layer. No `extends` entry is required for local layers.

### Temporarily disable a local layer

Move it outside the auto-discovered `layers/` directory:

```bash
mkdir -p disabled-layers
mv layers/timesheets disabled-layers/timesheets
```

Restart Nuxt afterward. Its pages, API routes, auto-imports, navigation, dashboard widgets, and translations will no longer be registered. Its database objects remain untouched.

To re-enable it:

```bash
mv disabled-layers/timesheets layers/timesheets
```

Do not rename a disabled directory while leaving it immediately below `layers/`; Nuxt discovers directories by location, not by their name.

### Disable an installed package layer

For a layer installed from a package, remove its entry from `extends` or `modules` in `nuxt.config.ts`, depending on how the package is distributed, and restart Nuxt.

### Permanently remove a feature

Treat code and data removal as separate operations:

1. Disable the layer and verify the portal builds and runs without it.
2. Remove the layer package or directory.
3. If its stored data is no longer required, create and review a separate migration that drops its tables, enums, indexes, and constraints.

Never make disabling the UI automatically delete feature data.

## Verification checklist

Before considering a feature layer complete:

```bash
pnpm test:features
pnpm eslint layers/portal-core layers/<feature>
pnpm typecheck
pnpm build
```

Also verify:

- The portal builds with the layer enabled.
- A copy of the portal builds with the layer directory excluded.
- English and Dutch locale keys match.
- API calls reject unauthenticated, unauthorized, and cross-organization access.
- Generated migrations run against a disposable PostgreSQL database.
- Every feature-owned table and enum is in the layer's PostgreSQL schema, not
  `public`; portal-core and authentication objects remain in `public`.
- Searching the feature for `~/`, `~~/`, `useUserStore`, and `authClient` returns no runtime host dependencies.

## Service-request example

See:

- `layers/service-requests/shared/feature.ts` for registration and policy.
- `layers/service-requests/server/api` for tenant-scoped handlers.
- `layers/service-requests/server/db/schema` for a feature-owned Drizzle schema.
- `layers/service-requests/i18n/locales` for isolated translations.
- `layers/service-requests/README.md` for feature-specific lifecycle notes.
