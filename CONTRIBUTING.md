# Contributing to Customer Portal

Customer Portal is designed to grow through focused fixes, documentation improvements, tests, and reusable Nuxt feature layers. Start with the rendered [contribution guide](https://portalnuxt.com/contributing), which documents the current architecture and links its claims to a verified product revision.

## Before contributing

1. Search existing [issues](https://github.com/ludulicious/customer-portal/issues) and pull requests.
2. Open the issue form that matches the work. Discuss substantial behavior or a new layer before implementing it.
3. Keep one issue and pull request focused on one problem.
4. Never include customer data, credentials, session cookies, database exports, invoices, or timesheet records in a report or test fixture.

The product source does not yet have an explicit software license. Review the [current licensing status](https://portalnuxt.com/reference/compatibility-and-releases); maintainers should clarify contribution licensing before merging substantive third-party code.

## Local setup

Create a project from the public template or clone the repository, then install the pinned package manager dependencies:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Configure PostgreSQL and the required authentication values by following the [installation guide](https://portalnuxt.com/getting-started/installation). Apply migrations before starting Nuxt:

```bash
pnpm exec drizzle-kit migrate
pnpm dev
```

Use synthetic local organizations and records. Do not develop against a production database.

## Architecture rules

- Put reusable business capabilities in a self-contained directory immediately below `layers/`.
- Keep portal-wide authentication, organization, feature-registry, navigation, and shell contracts in `portal-core`.
- Register navigation, modules, dashboard widgets, policies, and capabilities through the feature contract instead of editing the host shell.
- Authorize every server operation independently. UI visibility is not authorization.
- Derive tenant scope from the authenticated active organization; never trust a browser-supplied organization identifier when the session provides it.
- Keep feature-owned tables and enums in the feature's PostgreSQL schema and include a reviewed root migration.
- Keep English and Dutch locale key trees identical and localize every production-facing string.
- Avoid host aliases and host-specific imports in layer runtime code. A reusable layer must survive a clean-checkout portability test.

Read [Layers](docs/LAYERS.md), [Create a feature layer](https://portalnuxt.com/contributing/create-a-layer), and [Tenancy and security](https://portalnuxt.com/architecture/tenancy-and-security) before changing a feature boundary.

## Verification

Run the complete project gates before requesting review:

```bash
pnpm test:features
pnpm validate:feature-locales
pnpm lint
pnpm typecheck
pnpm build
```

Add focused tests for changed policy, locale, route, and schema behavior. Protected endpoints should cover unauthenticated, unauthorized, allowed, and cross-organization cases. Apply schema changes to both an empty database and representative pre-change data.

For a reusable layer, also build the application without that layer and in a clean Customer Portal checkout. Removing a feature must not leave imports, navigation, translations, migrations, or server dependencies behind.

## Documentation changes

Product documentation lives in the separate [portalnuxt repository](https://github.com/ludulicious/portalnuxt). If a product change affects setup, configuration, architecture, permissions, routes, operations, or user workflows, update the documentation in the same release cycle and link the documentation pull request from the product pull request.

Small code comments and layer-local README files remain useful when they explain constraints close to the implementation; they do not replace the public guide.

## Pull requests

Open a draft pull request early when the boundary needs review. Describe:

- the user problem and affected layer;
- authorization and tenant-isolation impact;
- schema and migration impact;
- English and Dutch UI impact;
- documentation impact;
- verification performed;
- screenshots for visible changes.

Respond to review with code, tests, documentation, or reproducible evidence. Maintainers may ask to split a change when infrastructure, product behavior, and unrelated cleanup are combined.

Security reports follow [SECURITY.md](SECURITY.md), not the public issue or pull-request workflow.
