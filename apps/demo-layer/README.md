# Shared interactive demo

This private Nuxt layer is used only by `demo-apex` and `demo-brutal`. It is disabled by default. Regular portal installations retain normal authentication and email delivery.

## Deployment

Provision a **new, dedicated PostgreSQL database with a name ending in `_demo`**. Apply the selected demo app's usual portal migrations. Do not bootstrap real users or configure production email/OAuth credentials. The first initialization refuses databases containing users. Never point a demo at a regular deployment's database.

For local development or a build, set `PORTAL_DEMO=true`. For an already-built image, set both Nuxt runtime variables:

```dotenv
NUXT_PORTAL_DEMO_ENABLED=true
NUXT_PUBLIC_PORTAL_DEMO_ENABLED=true
DATABASE_URL=postgresql://demo_user:password@database:5432/customer_portal_demo
BETTER_AUTH_URL=https://your-demo.example
BETTER_AUTH_SECRET=your-unique-random-secret-at-least-32-characters
```

The server flag enforces restrictions independently of the public UI flag. Both flags must be enabled for the intended interactive experience. Use `localhost` for local URLs, for example `http://localhost:3052` for Brutal Works. Start with `PORTAL_DEMO=true pnpm dev:brutal` after migrating its database.

The app redirects its entry and login pages to the populated dashboard. The persistent notice includes a selector for all seven fictional identities: system administrator; provider owner, administrator and member; and client owner, administrator and member. Switching creates a visitor-specific Better Auth session and reloads the dashboard, letting the existing permission system determine access. The selected identity survives a dataset reset. Business records are shared between all visitors.

## Restrictions and external effects

Account dialogs retain their normal controls. A centralized server allowlist rejects account/profile changes, invitations, memberships, role changes, password changes, access configuration, authentication callbacks and explicit email delivery. Better Auth's before hook also protects server-side auth API calls. The email delivery boundary rejects all outgoing messages, including indirect timesheet notifications, before creating a provider request. Provider lookups and delivery-status refreshes are blocked too. UI errors are shown in English or Dutch. All sample addresses use the reserved `example.test` domain and there are no usable seeded passwords or OAuth credentials.

Ordinary client, project, activity, time entry, service request and invoice workflows continue to use the existing permission checks. Access configuration is intentionally unavailable, including timesheet client links and reviewer/viewer assignment. The demo does not override business rules such as invoice immutability or deletion checks for records with dependencies.

## Reset operation

The server initializes the sample data on startup, then schedules the next midnight in **Europe/Amsterdam**. The calculation accounts for daylight saving time. After downtime or a failed timer, API requests retry the reset before serving data. Keep at least one long-running Node server active for an exact midnight reset; on suspended hosting, reset occurs on the next startup/request.

A PostgreSQL advisory lock serializes resets across replicas. API requests hold shared locks through their response, so a reset waits for in-flight business operations. All portal business tables, identities, sessions, credentials and settings are truncated and reseeded in one transaction. Migration metadata is preserved. A failed seed rolls back the whole reset, and errors remain visible in server logs. Only this layer's private server code can trigger resets; there is no public reset endpoint.

The dataset includes two clients, three activities, two projects, tariffs and approval assignments, 28 weeks of timesheets for four provider users, draft/submitted/rejected/approved periods, client reviews, 12 invoices with payments, 36 service requests and a pending invitation. Dates are relative to the Amsterdam reset date.

## Verification

From the repository root:

```sh
node --import tsx --test packages/core/test/demo-policy.test.ts apps/demo-layer/test/reset.test.ts
DATABASE_URL=postgresql://localhost:5432/disposable_demo node --import tsx apps/demo-layer/test/database.integration.ts
DEMO_TEST_URL=http://localhost:3052 node --import tsx apps/demo-layer/test/api.integration.ts
```

The database integration test deliberately forces a reset: use only a disposable migrated database. The API test requires a running enabled demo and Playwright Chromium. It exercises anonymous sessions, all identities, role enforcement, shared CRUD, restricted submissions, Dutch messages and the visible dashboard/switcher.
