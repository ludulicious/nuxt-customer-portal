# Configurable portal

The branding, module selection, homepage, legal pages, and browser onboarding used
by the included SaaS portal and the `nuxt-customer-portal init` starter.

The package includes the configurable host's Apex and Brutal presentation assets.
It runs against the portal's own database and authentication. It does not include
a hosted provisioning service or SaaS control plane.

Install it alongside the portal preset, and include it in `portal.config.ts` so
the kit applies its settings migration. A seeded system administrator completes
branding, module, homepage, and legal setup at `/onboarding` before regular portal
access is enabled. See the [installation guide](https://nuxt-customer-portal.com/getting-started/installation).
