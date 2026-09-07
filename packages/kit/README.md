# Nuxt Customer Portal kit

Configuration and migration tooling shared by official, third-party, and local
portal layers. `portal.config.ts` is the single source for Nuxt `extends` and
database provider ordering. Migration SQL is immutable after release and each
provider receives its own journal table.

## Create a portal

```sh
npx @nuxt-customer-portal/kit@0.3.3 init my-portal
```

The interactive wizard creates a standalone copy of the configurable SaaS portal,
generates secrets, installs dependencies, starts local PostgreSQL with Docker (or
uses an empty database), and creates a verified administrator. Choose the password
in the masked prompt; it is never stored in generated files or passed as a shell
argument. Finish branding, modules, homepage, and legal settings in the browser.

For your own PostgreSQL database, use a connection URL in the form
`postgresql://username:password@host:5432/database`. Replace each part with your
database details, or paste the URL from your database provider, including any
connection options such as `?sslmode=require`. Percent-encode special characters
in credentials (`@` becomes `%40`, for example). Setup saves the URL in `.env`.

Use `--no-install` to generate files only. Run the generated project's `setup`
script to resume after fixing an installation or database problem. Setup refuses
non-empty unrelated databases, preserves existing files, and never resets an
existing account's password. The generated app uses invitation-only registration.

The wizard can optionally copy the homepage, privacy page, and terms page into
the generated host under `app/pages/`. Leave that option off to keep every page
package-provided. To customize one page later, run for example:

```sh
pnpm portal page copy login
```

Available page names are `home`, `privacy`, `terms`, and `login`. The command
copies the selected source and adds any direct dependency it needs. It refuses
the operation before changing files when the destination already exists. Local
Nuxt pages override the package layer route, so there is no duplicate route.
Copied pages are owned by the host: edit them normally, and review upstream
package changes yourself because upgrades do not update local copies.

The npm tarball contains a template prepared from `apps/saas-portal` by `prepack`.
When running init from a source checkout, first run `pnpm --filter
@nuxt-customer-portal/kit build:template`. This keeps generated projects aligned
with the maintained configurable application.

Generated projects include local Prettier and ESLint configuration. Run
`pnpm format` to apply formatting and lint fixes, `pnpm format:check` to verify
without changing files, and `pnpm lint` to check code with zero warnings allowed.
Use the equivalent `run` commands for your chosen package manager. Generated
outputs, local environment files, and package-manager lockfiles are excluded
from formatting.

## Manage an existing portal

Grant the global system-administrator role to an existing user with:

```sh
nuxt-customer-portal admin grant --email admin@example.com
```

This changes only the platform role on the user; it does not modify any
organization membership or organization role.

`db adopt-legacy` is a dry run unless `--apply` is passed. It only recognizes
the complete 22-entry pre-package migration history and refuses unknown or
partially migrated databases.
