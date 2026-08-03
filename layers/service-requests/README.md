# Service Requests feature layer

This Nuxt layer owns the service-request UI, API, policy, translations, types, validation, and Drizzle schema. It depends on the stable `#portal` adapters supplied by the portal-core layer.

## Enable or disable

The local `layers/` directory is auto-registered by Nuxt. To disable this feature without deleting data, move the layer outside `layers/` or add it to `.nuxtignore`. Its routes, navigation, dashboard widget, auto-imports, and translations will then disappear.

Disabling a layer never removes database objects. Removing its data requires a separate, reviewed migration that drops the `service_request` table and its enums.

## Database

The schema is exported from `server/db/schema/service-requests.ts`. Its tables and
enums live in the `service_requests` PostgreSQL schema; portal core and authentication
remain in `public`. The host Drizzle configuration discovers feature schemas and owns
the single ordered migration history.
