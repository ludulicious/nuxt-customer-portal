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

## Appearance presets

Branding and appearance includes a **Soft editorial** preset: Playfair Display
headings, Lato body text, purple/lavender primary colors, sea-blue accents, pale
light-mode backgrounds and plum dark-mode surfaces. It selects Apex, rounded
primary buttons, soft card shadows and full header logos. Applying it changes the
editor draft; **Save changes** publishes it. The live preview can display either
mode without changing the visitor's preference.

Administrators can override heading/body fonts, secondary colors, page and card
backgrounds, component shape and header branding. Color overrides accept only
six-digit hex values; clear an optional color to inherit the theme. **Use theme
defaults** clears these overrides while retaining the current theme, primary
colors and color-mode policy. Full logos fall back across modes; if neither is
available, the header retains the icon and portal name.

Existing saved settings gain neutral defaults on read and do not need a database
migration. Preset fonts are loaded by the included SaaS host. Custom hosts should
configure Nuxt Fonts to load Playfair Display, Lato, Geist and Bricolage Grotesque
when exposing these options. The shared schema rejects arbitrary font/CSS values.
