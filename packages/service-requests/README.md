# Service Requests feature layer

This Nuxt layer owns the service-request UI, API, policy, translations, types, validation, Drizzle schema, and immutable baseline migration. It depends on the public adapters exported by `@nuxt-customer-portal/core`.

## Enable or disable

The local `layers/` directory is auto-registered by Nuxt. To disable this feature without deleting data, move the layer outside `layers/` or add it to `.nuxtignore`. Its routes, navigation, dashboard widget, auto-imports, and translations will then disappear.

Disabling a layer never removes database objects. Removing its data requires a separate, reviewed migration that drops the `service_request` table and its enums.

## Database

The schema is exported from `server/db/schema/service-requests.ts`. Its tables and
enums live in the `service_requests` PostgreSQL schema; portal core and authentication
remain in `public`. The host Drizzle configuration discovers feature schemas and owns
the single ordered migration history.

## Request workspace

Everyone uses the same `/requests` workspace, with a responsive card list and the portal search/filter/sort toolbar. Lists use 20-item server pages, numbered navigation, adjacent-page loading, and URL-persisted collection state. Detail-page back links retain that state. Category choices come from the authorized collection, rather than only the currently loaded page. Old `/admin/requests` links redirect to the equivalent workspace route, preserving query parameters.

Administrators see management controls on the request detail page and can save status, priority, assignment, and internal notes together. New assignees must belong to the provider organization. Customer edits use the shared request form; deletion requires confirmation.

Run `node --import tsx --test packages/service-requests/test/service-request.test.ts` for validation and locale checks. Against a freshly seeded local demo, run `DEMO_TEST_URL=http://localhost:3051 node --import tsx packages/service-requests/test/demo-browser.integration.ts` for browser checks. The browser check creates and cleans up one temporary request and expects the standard 36-request demo dataset.
