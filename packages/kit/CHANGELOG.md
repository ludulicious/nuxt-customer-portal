# @nuxt-customer-portal/kit

## 0.3.0

### Minor Changes

- 3f2147e: Add an interactive init command that creates a standalone copy of the configurable
  portal, installs dependencies, and sets up a new database and administrator. Ship
  the configurable portal layer and its themes as a public package. Resolve preset
  manifests through their own dependencies so pnpm consumers need only install the
  selected packages.
