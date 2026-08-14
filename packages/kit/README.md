# Nuxt Customer Portal kit

Configuration and migration tooling shared by official, third-party, and local
portal layers. `portal.config.ts` is the single source for Nuxt `extends` and
database provider ordering. Migration SQL is immutable after release and each
provider receives its own journal table.

Grant the global system-administrator role to an existing user with:

```sh
nuxt-customer-portal admin grant --email admin@example.com
```

This changes only the platform role on the user; it does not modify any
organization membership or organization role.

`db adopt-legacy` is a dry run unless `--apply` is passed. It only recognizes
the complete 22-entry pre-package migration history and refuses unknown or
partially migrated databases.
