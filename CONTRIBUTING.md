# Contributing to Nuxt Customer Portal

Nuxt Customer Portal is an MIT-licensed monorepo of reusable Nuxt layers, demo hosts, a migration kit, and its documentation site. Start with the [contribution guide](https://nuxt-customer-portal.com/contributing).

## Before contributing

1. Search existing [issues](https://github.com/ludulicious/customer-portal/issues) and pull requests.
2. Discuss a new package, migration provider, or substantial contract change before implementing it.
3. Keep one issue and pull request focused on one problem.
4. Never include customer data, credentials, cookies, database exports, invoices, or timesheets in fixtures or reports.

Contributions are accepted under the repository [MIT license](LICENSE).

## Local setup

```bash
pnpm install --frozen-lockfile
cp apps/demo-apex/.env.example apps/demo-apex/.env
pnpm dev:apex
```

Use a local PostgreSQL database and synthetic records. Run `pnpm --filter @nuxt-customer-portal/demo-apex portal doctor` to inspect the selected providers before applying migrations.

## Architecture rules

- Put reusable platform and business capabilities in `packages/<id>` and keep host branding in `apps/*`.
- Keep `@nuxt-customer-portal/core` visually headless. Shared shell primitives and fallback layouts belong to `ui`.
- Import cross-package contracts only through documented package exports such as `@nuxt-customer-portal/core/feature` and `@nuxt-customer-portal/core/server`.
- Do not add host aliases, physical cross-package imports, or dependencies from platform packages to optional features.
- Register navigation, dashboard widgets, policies, and surfaces through `PortalFeatureDefinition`.
- Authorize every server operation and derive tenant scope from the authenticated active organization.
- Give each provider an immutable migration stream and a `portal-manifest` export. Never edit a released migration.
- Keep English and Dutch locale trees aligned and localize production-facing text.
- Declare every runtime import in the owning package; keep Nuxt and framework packages as compatible peers and development dependencies.

Read [Layers](docs/LAYERS.md), [Create a feature layer](https://nuxt-customer-portal.com/contributing/create-a-layer), and [Database migrations](https://nuxt-customer-portal.com/architecture/database-migrations) before changing a package boundary.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm pack:check
pnpm test:e2e:demos
```

The clean-consumer checks install only generated tarballs, with no workspace links:

```bash
pnpm pack:consumer:pnpm
pnpm pack:consumer:npm
pnpm pack:consumer:yarn
pnpm pack:consumer:bun
```

Add focused tests for changed policies, routes, schemas, migration ordering, and failure behavior. Optional packages must still build when other optional features are absent.

## Documentation and pull requests

Documentation lives in `apps/docs` in this repository. Update it in the same pull request when setup, configuration, architecture, migrations, permissions, routes, or workflows change.

Describe the user problem, affected packages, authorization and tenant impact, schema and migration impact, English and Dutch UI impact, documentation changes, and verification performed. Include screenshots for visible changes. Report vulnerabilities through [SECURITY.md](SECURITY.md), never through a public issue.
