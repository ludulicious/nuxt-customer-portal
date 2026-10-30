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

The portal home route (`/`) redirects to `/dashboard` instead of displaying the
public landing page. Signed-out visitors must sign in before viewing the dashboard.
Saved homepage content remains available in portal settings for future use; other
public pages and booking/checkout routes are unchanged.

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

## Sign-in backgrounds

In **Portal settings → Appearance → Sign-in backgrounds**, administrators can upload
separate desktop and mobile images. Choose a landscape composition with its main
details on the right for desktop, and a portrait composition for mobile. The form
has an opaque, theme-aware surface so it stays readable over any image.

Authentication pages use the mobile image below 1024 px and the desktop image from
1024 px. If only one image is provided, it is used at both sizes. Forms sit near
the top on mobile and remain vertically centered on desktop, with or without a
background image. Backgrounds cover the available space and
may be cropped; they do not affect embedded checkout sign-in forms.

Uploads support PNG, JPEG, and WebP, up to 2 MB and 2400×2400 px. Both the browser
and server validate images. Previews and removal apply to the editor draft;
**Save changes** publishes them. Existing portals receive empty defaults without
a database migration.
