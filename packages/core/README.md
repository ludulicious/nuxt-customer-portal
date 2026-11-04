# Portal core layer

Portal core is the stable boundary between the host application and reusable feature layers.

Feature layers register a `PortalFeatureDefinition` containing navigation, dashboard widgets, surfaces, and an organization-role policy. Client code consumes authentication and active-organization state through `usePortalSession`; server handlers import database, session, tenant, and authorization adapters from `@nuxt-customer-portal/core/server`.

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
  getKey: (product) => product.id,
  fetchPage: ({ filters, page, pageSize, signal }) =>
    $fetch('/api/products', {
      query: { ...filters, page, pageSize },
      signal
    })
})
```

A failed page load never rejects: it resolves with no result and exposes the
cause on `error`, so a list awaited at the top level of `setup()` still renders.
Callers check the returned result before using it and render `error` themselves.

Use `useAutoPagination` with a list container and trailing sentinel when the next
page should load automatically. Conventional pagination controls can use the
same `pagination` state alongside it.

### Connected website accounts

Set the runtime environment variable `PORTAL_AUTH_WEBSITE_ORIGINS` to a
comma-separated list of exact trusted website origins to enable credentialed
CORS for `GET /api/auth/get-session` and `POST /api/auth/sign-out`. For example,
`PORTAL_AUTH_WEBSITE_ORIGINS=https://www.example.com`. Empty by default. Only
HTTPS origins (or HTTP localhost for development) without paths, wildcards,
credentials, queries or fragments are accepted, with a maximum of 20 origins.
The same origins are added to Better Auth's trusted origins. Other APIs do not
receive CORS access. Browsers must send `credentials: 'include'` and still apply
cookie restrictions. Only configure websites you control and trust with session
data. SaaS portals can manage these origins in Portal settings → General settings
instead; saved and environment origins are combined.
