# Portal core layer

Portal core is the stable boundary between the host application and reusable feature layers.

Feature layers register a `PortalFeatureDefinition` containing navigation, dashboard widgets, surfaces, and an organization-role policy. Client code consumes authentication and active-organization state through `usePortalSession`; server handlers import database, session, workspace, and authorization adapters from `@nuxt-customer-portal/core/server`.

Feature layers must not import host paths through `~/` or `~~/`. Drizzle schema files are the exception to alias-based imports because Drizzle Kit does not resolve Nuxt aliases; local schemas reference portal core’s physical schema while the host composes all schemas into one migration stream.

Portal-core and authentication database objects remain in PostgreSQL's `public`
schema. Each feature layer owns a separate PostgreSQL schema named after the
layer, with hyphens converted to underscores (for example,
`service-requests` uses `service_requests`). Feature tables may reference
portal-core tables across schemas.

## Reusable pagination

`usePaginatedResource<Item, Filters>` owns request cancellation, stale-response
protection, pagination state, append/replace behavior, deduplication, and errors.
A feature supplies only its fetch adapter and stable item key:

```ts
const products = usePaginatedResource<Product, ProductFilters>({
  pageSize: 20,
  getKey: product => product.id,
  fetchPage: ({ filters, page, pageSize, signal }) =>
    $fetch('/api/products', {
      query: { ...filters, page, pageSize },
      signal
    })
})
```

Use `useAutoPagination` with a list container and trailing sentinel when the next
page should load automatically. Conventional pagination controls can use the
same `pagination` state alongside it.
