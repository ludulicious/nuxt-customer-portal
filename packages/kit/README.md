# Nuxt Customer Portal kit

Configuration and migration tooling shared by official, third-party, and local
portal layers. `portal.config.ts` is the single source for Nuxt `extends` and
database provider ordering. Migration SQL is immutable after release and each
provider receives its own journal table.

## Create a portal

```sh
npx @nuxt-customer-portal/kit@0.3.0 init my-portal
```

The interactive wizard creates a standalone copy of the configurable SaaS portal,
generates secrets, installs dependencies, starts local PostgreSQL with Docker (or
uses an empty database), and creates a verified administrator. Choose the password
in the masked prompt; it is never stored in generated files or passed as a shell
argument. Finish branding, modules, homepage, and legal settings in the browser.

Use `--no-install` to generate files only. Run the generated project's `setup`
script to resume after fixing an installation or database problem. Setup refuses
non-empty unrelated databases, preserves existing files, and never resets an
existing account's password. The generated app uses invitation-only registration.

The npm tarball contains a template prepared from `apps/saas-portal` by `prepack`.
When running init from a source checkout, first run `pnpm --filter
@nuxt-customer-portal/kit build:template`. This keeps generated projects aligned
with the maintained configurable application.

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
