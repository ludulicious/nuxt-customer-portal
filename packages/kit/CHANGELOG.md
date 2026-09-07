# @nuxt-customer-portal/kit

## 0.3.3

### Patch Changes

- 17432a1: Include standalone ESLint and Prettier configuration, dependencies, and working format commands in generated portals. Verify starter lint, formatting checks, and repeatable fixes when testing packed packages.
- 8496fe7: Add optional host-owned website pages during interactive setup and a safe `page copy` command for copying individual package-provided pages later.

## 0.3.2

### Patch Changes

- 5f60571: Make the PostgreSQL connection URL visible and editable during interactive setup, and show its format, an example, and guidance for database credentials and connection options.

## 0.3.1

### Patch Changes

- Fix starter generation on Node 24 by copying template entries into the empty destination without trying to copy over the destination directory itself. Existing files remain protected from overwriting.

## 0.3.0

### Minor Changes

- 3f2147e: Add an interactive init command that creates a standalone copy of the configurable
  portal, installs dependencies, and sets up a new database and administrator. Ship
  the configurable portal layer and its themes as a public package. Resolve preset
  manifests through their own dependencies so pnpm consumers need only install the
  selected packages.
