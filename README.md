# Nuxt Customer Portal

**A customer portal you can make your own.**

Nuxt Customer Portal is the application for client access, timesheets, approvals, invoicing, products and appointments. It is open source under the MIT License and built with Nuxt. The main application is in [apps/saas-portal](apps/saas-portal); separate modules live in [packages](packages).

[Documentation](https://nuxt-customer-portal.com) ? [Try the demo](https://demo.nuxt-customer-portal.com) ? [Build a module](https://nuxt-customer-portal.com/contributing/create-a-layer)

## Install from source

Use Node.js 22.19 or newer on a supported LTS release, pnpm 10.30.2, and PostgreSQL 16. pnpm is the only supported package manager. Fork the project to use another package manager.

```sh
git clone https://github.com/ludulicious/nuxt-customer-portal.git
cd nuxt-customer-portal
corepack enable
pnpm install --frozen-lockfile
cp apps/saas-portal/.env.example apps/saas-portal/.env
```

Configure the database URL, unique secrets, provider name/slug, and reserved administrator email in that file. [Installation](https://nuxt-customer-portal.com/getting-started/installation) covers PostgreSQL and secret generation.

```sh
pnpm db:doctor
pnpm db:migrate
pnpm portal provider bootstrap --organization-name "My Portal" --organization-slug my-portal
pnpm dev
```

Open http://localhost:3052/signup, register the reserved administrator email, verify it using your configured email provider, and complete onboarding. For a verified initial administrator before email delivery is available, use the documented provider seed/admin commands in [manual setup](https://nuxt-customer-portal.com/getting-started/manual-installation).

## Install with Docker

Use the published image with PostgreSQL. Set a verified release tag or immutable digest in PORTAL_IMAGE; copy [.env.example](.env.example) to .env and replace the placeholders.

```sh
docker compose up -d
```

The image checks configuration and applies pending migrations before starting. Database and file volumes persist across container restarts. See [deployment](https://nuxt-customer-portal.com/getting-started/deployment) for HTTPS, backups, upgrades, and email configuration.

## Work with the code

- [apps/saas-portal](apps/saas-portal): host configuration, branding and integrated demo layer.
- [packages](packages): core, shared UI, authentication, organizations, administration, clients and business modules.
- [scripts/portal.mjs](scripts/portal.mjs): migrations, diagnostics, provider/admin operations and Harvest import.
- [apps/docs](apps/docs): documentation website.

Modules are private pnpm workspace dependencies. They are developed and released with this application. See [architecture](https://nuxt-customer-portal.com/architecture/overview), [customization](https://nuxt-customer-portal.com/getting-started/customization), and [contributing](CONTRIBUTING.md).

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm dev:docs
```

## Demo

The public demo runs this same app/image on a separate deployment and database. Identity switching, fictional business data and daily resets are built in. Portal settings are read-only; personal settings previews are deferred. Demo mode is disabled by default. See [demo operations](apps/saas-portal/layers/demo/README.md).

## Releases

One product version in package.json identifies the source release and Docker image. Release notes live in [CHANGELOG.md](CHANGELOG.md). Full source verification must pass before Docker publication. There is no npm distribution or installer.

Copyright ? 2026 Nuxt Customer Portal contributors. Distributed under the [MIT License](LICENSE).
