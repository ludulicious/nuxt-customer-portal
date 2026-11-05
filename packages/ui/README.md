# Nuxt Customer Portal UI

Neutral shell primitives and fallback layouts for Nuxt Customer Portal. Hosts
can override every layout and branded component while retaining the shared
feature registry, session state, and navigation contracts from core.

## Shared visual styling

The default theme keeps Nuxt UI's native component variants, surfaces, rounding,
shadows, and interaction states. Shared component configuration adds inert
`portal-surface` and `portal-field-surface` hooks, not replacement field variants
or fixed blue/slate colors. Primary solid buttons retain a contrast-aware
foreground for custom brand colors without suppressing native hover states.

Use standard Nuxt UI components instead of setting local input backgrounds.
Primary actions and primary-tinted states use the brand palette, while ordinary
backgrounds, text, borders, and menus retain Nuxt UI's neutral semantics. Reserve explicit backgrounds
for meaningful states, not for distinguishing one input type from another.
The sidebar's top-level buttons retain their local primary hover treatment;
native Nuxt UI navigation handles submenu, active, and focus states.
Group nested form sections with spacing and dividers rather than tinted cards.

Shared tokens in `app/assets/css/surfaces.css` support optional custom surfaces.
They do not replace Nuxt UI's component rounding, size variants, padding, or
icon spacing. Explicit soft shape settings can opt into 8px controls and 12px
panels. Brutal retains its square corners, heavier rules, and distinct typography.

With `data-portal-surfaces="custom"` on the portal or preview root, `portal-surface`
establishes surface-specific text and border colors for a container, including
teleported menus and dialogs. `portal-field-surface` does the same for a field
without changing its parent or page canvas. A default preview opts out of a
custom host's surface styles. Without this opt-in, both hooks are inert. Do not
reassign global `--ui-bg` to the surface color: page backgrounds and nested
surface colors intentionally serve different roles.

`PortalMarkdownEditor` provides visual formatting and a raw Markdown mode over
one string `v-model`. It integrates with Nuxt UI `UFormField` validation and
inherits the form's disabled state. Use it for fields rendered as Markdown;
plain text fields should retain their text inputs. Product summaries and
descriptions and email bodies and footers use this component.

Pass `placeholders` as an array of `{ label, value }` options to offer insertion
at the current cursor in either mode. Email forms derive these options from the
selected email definition. Supported visual formatting includes headings,
bold, italic, links, lists, quotes, code and dividers. HTML, images, tables,
checklists, reference links and other unsupported syntax are shown as inert,
protected source blocks; edit these through Markdown mode. Opening the editor
or changing modes does not rewrite the stored string. Visual edits serialize
standard Markdown formatting while retaining protected blocks. Existing
server renderers still determine what appears in published content.
