# Integrated interactive demo

The SaaS portal and its Docker image include this private Nuxt layer. Demo mode is disabled by default. Deploy a separate instance with a dedicated PostgreSQL database whose name ends in _demo; never enable it on a real portal database. First initialization refuses a database containing users.

## Deployment

Use the same source checkout/build or Docker image as the normal portal. Configure unique authentication secrets and matching origins. With an already-built image, set both runtime variables:

```dotenv
NUXT_PORTAL_DEMO_ENABLED=true
NUXT_PUBLIC_PORTAL_DEMO_ENABLED=true
DATABASE_URL=postgresql://demo_user:password@database:5432/customer_portal_demo
BETTER_AUTH_URL=https://demo.example.com
PUBLIC_URL=https://demo.example.com
BETTER_AUTH_SECRET=your-unique-random-secret-at-least-32-characters
```

The server and public flags must match; mismatches fail startup. PORTAL_DEMO=true supplies both defaults for local development/builds, but changing it alone does not override an already-built image. Prefer the two explicit runtime flags. Use localhost for local URLs.

From the repository root, migrate the dedicated database using pnpm db:doctor, pnpm db:status and pnpm db:migrate, then start pnpm dev. For Docker, the entrypoint applies migrations automatically and skips regular provider bootstrap in demo mode. With compose.yaml, use a separate Compose project and volume, set POSTGRES_DB to a name ending in _demo, and enable both flags. Do not configure live email, OAuth, payment or calendar credentials.

## Visitor behavior

Anonymous visitors receive a visitor-specific Better Auth session for a fictional identity. Login/signup redirect to the seeded dashboard. The persistent banner switches among seven identities: system administrator; provider owner, administrator and member; client owner, administrator and member. Existing permission checks determine access.

Business records are shared by visitors and reset daily. The dataset covers six months of timesheets, approvals, invoices, service requests, clients, sandbox products and appointments. Completed onboarding and enabled-module settings are seeded, so visitors explore the actual SaaS application. Branding, appearance, content and module settings are read-only. Visitor-specific settings previews are deferred to a later version.

## Restrictions

The server blocks account/profile/access mutations and explicit/indirect email delivery, including Better Auth callbacks and provider lookups. New mutation families stay closed by default. Store, payment and calendar writes requiring external effects remain unavailable. Sample identities have no usable passwords or OAuth credentials; sample email addresses use example.test. Ordinary allowed business workflows retain their normal permissions, immutability and dependency checks. Settings mutations return DEMO_RESTRICTED and the UI displays a read-only notice.

## Reset behavior

The server seeds on startup and schedules the next midnight in Europe/Amsterdam, accounting for daylight saving time. Requests catch up after downtime. PostgreSQL advisory locks coordinate replicas and in-flight operations. Reset truncates business/identity/settings data and reseeds atomically; migration metadata remains intact. Failed seeds roll back. There is no public reset endpoint. A selected fictional identity survives resets through a visitor cookie.

## Verification

```sh
pnpm test:demo
node --import tsx apps/saas-portal/layers/demo/test/database.integration.ts
node --import tsx apps/saas-portal/layers/demo/test/api.integration.ts
```

The database test needs DATABASE_URL for a disposable migrated _demo database and deliberately forces resets. The API test needs DEMO_TEST_URL pointing to a running disposable localhost demo and Playwright Chromium. Full portal browser tests use E2E_DATABASE_URL ending in _e2e and run normal/demo modes of one build on desktop/mobile. See CONTRIBUTING.md for the procedure.
