# Contributing to Nuxt Customer Portal

The SaaS portal in apps/saas-portal is the main application. Its private modules live under packages/, its operational scripts under scripts/, and its documentation website under apps/docs. Contributions use the repository MIT license.

## Local development

Use Node.js 22.19 or newer on a supported LTS release and pnpm 10.30.2. pnpm is the only supported package manager; use a fork for another manager. Follow [installation](https://nuxt-customer-portal.com/getting-started/installation) to configure PostgreSQL, secrets, migrations and your administrator. Run pnpm dev from the repository root and open http://localhost:3052.

Keep customer data and secrets out of fixtures, logs and reports. Use synthetic data and disposable databases for tests. The application .env stays in apps/saas-portal; root .env is used by the Docker Compose example.

## Module boundaries

- Keep capabilities in packages/<id> as private pnpm workspaces and application branding/composition in apps/saas-portal.
- Import shared contracts through declared workspace exports. Keep core visually headless, UI neutral, and optional business modules independent.
- Register navigation, widgets and permissions through PortalFeatureDefinition. Authorize every server operation and derive tenant scope from the authenticated organization.
- Keep released SQL migrations immutable and give each module its own manifest and migration stream.
- Keep English and Dutch translations aligned. Use Nuxt UI forms with Zod, novalidate and displayed errors.
- Conditionally mount modals with v-if and bind their boolean open state using v-model:open.

The workspace pins Sharp to 0.35.3. When changing it, verify image processing in the Linux image as well as local development.

## Verification

```sh
pnpm verify:saas-boundary
pnpm test
pnpm typecheck
pnpm build
pnpm format
pnpm format:check
```

For browser tests, use a dedicated PostgreSQL service with permission to create test databases. Set E2E_DATABASE_URL to a disposable database ending in _e2e, for example postgresql://portal:portal-test-only@localhost:55435/portal_browser_e2e. The setup creates/migrates that database and its _demo companion, seeds a synthetic administrator, and preserves existing test data on repeat runs. Never use a customer database.

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The same production build is tested in normal and demo modes on desktop and mobile. Demo reset integration is in apps/saas-portal/layers/demo/test/database.integration.ts and requires a disposable migrated _demo database. Documentation has separate content tests (pnpm test:docs), browser tests (pnpm test:e2e:docs), and a standalone Docker build.

PR CI runs module/tooling/demo tests, formatting, the boundary check and portal typecheck. Documentation tests run for relevant changes. Full release verification adds all source tests, typechecks, the portal build, normal/demo browser tests and daily reset integration before Docker publication.

## Releases and pull requests

Track work with GitHub issues and use task branches and PRs targeting master. Include behavior, migration impact, documentation changes and checks actually run. Run pnpm format and pnpm format:check before pushing.

Record changes in the root CHANGELOG.md under Unreleased. One version in the root package.json identifies source releases and Docker images; private modules have no independent versions or changelogs. Package Changesets, npm distribution and generated installers have been removed.

A published GitHub release resolves its exact tag commit and runs full source verification. Docker publication depends on that verified commit. Do not bypass the gate or announce an image before its digest is available. Production deployment and release publication require an explicit request.

Use the GitHub plugin for GitHub operations. Report vulnerabilities through [SECURITY.md](SECURITY.md).
