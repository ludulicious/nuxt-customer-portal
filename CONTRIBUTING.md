# Contributing to Nuxt Customer Portal

Nuxt Customer Portal is an MIT-licensed monorepo of reusable Nuxt layers, demo hosts, a migration kit, and its documentation site. Start with the [contribution guide](https://nuxt-customer-portal.com/contributing).

## Before contributing

1. Search existing [issues](https://github.com/ludulicious/nuxt-customer-portal/issues) and pull requests.
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

## Native image dependencies

The workspace pins Sharp to `0.35.3` with a root pnpm override. Keep application hosts such as marpos.nl aligned to that version: mixing Sharp versions can make Nitro's versioned native-package layout break libvips lookup in Alpine containers. Root overrides are not inherited by consumers of published packages; those hosts must configure their own override. When updating this pin, verify Nuxt image resizing, social images, and product image processing in the generated Linux container without a custom library search path.

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

Pull requests run a lightweight `CI / validate` job: package tests, formatting and lint checks, the SaaS boundary check, and the SaaS portal type check. Documentation content tests run when docs, shared dependency configuration, package manifests, or workflow files change. A separate `consumers (pnpm)` job checks a clean pnpm consumer; npm, Yarn, and Bun consumers run only in full release verification. Superseded PR runs are cancelled. Merges to `master` do not repeat CI.

Run the same core checks locally:

```bash
pnpm verify:saas-boundary
pnpm test:packages
pnpm format:check
pnpm --filter @nuxt-customer-portal/saas-portal typecheck
pnpm test:docs
```

For larger changes, run **Full release verification** in Actions and supply a branch, tag, or commit. This runs the full suite without publishing: all type checks and application builds, docs content and browser tests, demo browser tests with a migrated PostgreSQL database, tarball checks, the standalone docs Docker build, four package-manager consumer checks, and starter checks on Node 22 and 24. Every job uses the same resolved commit. There is no separate lint pass because `format:check` already includes ESLint.

A published GitHub release starts **Release packages and portal image** (`release-npm-packages.yml`). It resolves the existing stable release tag, checks package versions, and runs full verification once. npm publication and the portal Docker publisher both depend on that complete verification and check out its exact commit. A failed, cancelled, or skipped verification blocks both publishers. Rerun the release workflow with `release_tag` to retry an existing tag; the Docker workflow is reusable only and has no independent publication trigger. The npm entry-point filename is unchanged so existing trusted-publisher configuration remains valid.

Keep `CI / validate` and `consumers (pnpm)` as the required PR checks. If repository rules previously required the consumer, starter, or docs-image jobs, remove the npm/Yarn/Bun consumer, starter, and docs-image requirements when adopting this split; these checks now belong to release verification. This change does not alter repository rules automatically.

Add focused tests for changed policies, routes, schemas, migration ordering, and failure behavior. Optional packages must still build when other optional features are absent. Full verification does not replace the manual release checks in the documentation release checklist.

## Documentation and pull requests

Documentation lives in `apps/docs` in this repository. Update it in the same pull request when setup, configuration, architecture, migrations, permissions, routes, or workflows change.

Describe the user problem, affected packages, authorization and tenant impact, schema and migration impact, English and Dutch UI impact, documentation changes, and verification performed. Include screenshots for visible changes. Report vulnerabilities through [SECURITY.md](SECURITY.md), never through a public issue.
