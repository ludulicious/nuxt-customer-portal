# @nuxt-customer-portal/kit

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
