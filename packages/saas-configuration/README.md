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

**Default (Nuxt UI)** uses the installed Nuxt UI theme rather than a separate
blue/slate skin. Default component variants, rounding, typography, shadows,
overlays, and hover/focus behavior come from Nuxt UI. Changing the light/dark
primary colors updates the complete primary palette used by actions, selected
navigation, focus rings, and primary-tinted states. Nuxt UI intentionally keeps
page backgrounds, ordinary text, borders, and inactive menus neutral; success
and error colors retain their semantic meaning instead of following the brand.
There are no fixed blue gradients or global button/shadow overrides.

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

Custom surfaces apply only when configured, including fields and teleported
menus/dialogs. Clearing them restores native Nuxt UI defaults. The live preview
uses the same semantic tokens and isolates its light/dark defaults from the saved
portal's custom surfaces. Brutal retains its separate typography and palette.

To run the isolated CSS/browser regressions without starting a server, prepare
the SaaS app first (`pnpm --filter @nuxt-customer-portal/saas-portal exec nuxt prepare`),
then run `pnpm exec playwright test --config=test/e2e/appearance.config.ts`.
These compare computed styles against the installed Nuxt UI stylesheet in light
and dark modes, including primary updates, preview isolation, and Brutal styling.

## Legal content

In **Portal settings → Legal**, edit English and Dutch terms and privacy policies
with the shared visual/Markdown editor. Titles remain plain text. **Save changes**
publishes the draft to `/terms` and `/privacy`, which render sanitized Markdown
including headings, lists, links, quotes, code and tables. Scripts, embedded content,
unsafe links and arbitrary HTML attributes are removed. Existing plain text remains
readable, including line breaks; no data migration is required.

The dashboard sidebar footer includes localized terms and privacy policy links.
Collapsed sidebars show accessible icons; selecting a link closes the mobile menu.

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

## Connected website account menus

In **Portal settings → General settings → Connected websites**, add the exact
HTTPS origin of each website you control, for example `https://www.marpos.nl`,
and save. Each SaaS instance has its own list. Changes apply to subsequent
requests without a restart. Existing instances default to an empty list; no
migration is needed. The list is administrator-only and is not part of public
portal settings.

Connected websites may call `GET /api/auth/get-session` with
`credentials: 'include'` to display the user's `user.image`, name or initials,
and `POST /api/auth/sign-out` with a JSON `{}` body and the same credentials to
sign out. Handle a null session or unavailable portal by showing a link to the
portal's `/dashboard`. Keep session responses out of page caches and persistent
browser storage. Configured websites are trusted authentication clients: only
add origins you control, since a session response includes authentication data.

The portal sends credentialed CORS headers only on these two routes and handles
their OPTIONS preflights. The same exact origins are added dynamically to Better
Auth's trusted origins for sign-out checks; other API routes do not receive CORS
access. HTTPS origins must contain no credentials, wildcard, path, query or
fragment. Up to 20 origins are accepted. `http://localhost:<port>` is allowed for
local development; use localhost consistently for both local applications.

For Marpos, deploy the version containing this feature to `portal.marpos.nl`,
then save `https://www.marpos.nl` in its connected websites. Sign in to the
portal, return to the website, and verify the avatar appears and sign-out works.
An HTTPS website and portal on subdomains of the same site can retain host-only
portal cookies: the browser sends the cookies directly to the portal. Unrelated
sites may be blocked by browser third-party-cookie policies; this setting does
not weaken SameSite, Secure, or HttpOnly cookie protections.

For deployment-managed origins (also available to custom Core hosts), set
`PORTAL_AUTH_WEBSITE_ORIGINS=https://www.example.com,https://example.com` at
runtime and restart. These origins are combined with saved settings; remove
an origin from both sources to revoke it. Neither source accepts wildcards.
Reference: [Better Auth trusted origins](https://better-auth.com/docs/reference/options#trustedorigins).
