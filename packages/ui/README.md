# Nuxt Customer Portal UI

Neutral shell primitives and fallback layouts for Nuxt Customer Portal. Hosts
can override every layout and branded component while retaining the shared
feature registry, session state, and navigation contracts from core.

## Shared visual styling

The portal separates the page canvas (`--ui-bg`) from content surfaces
(`--portal-surface`). Cards, dialogs, menus, text inputs, selects, and Markdown
editors use the same opaque surface. The default is white in light mode and
slate in dark mode; saved appearance settings override these colors without
changing each form. Products and other feature packages inherit these defaults.

Use standard Nuxt UI components instead of setting local input backgrounds.
Neutral outline buttons remain transparent, primary actions use the brand
color, and selected items use a soft brand tint. Reserve explicit backgrounds
for meaningful states, not for distinguishing one input type from another.
Sidebar submenu hover uses the same 10% brand tint and brand-colored text as
top-level primary ghost links, such as Clients. Active submenu links keep that
tint with a stronger font weight, and keyboard focus retains a visible outline.
Group nested form sections with spacing and dividers rather than tinted cards.

Shared tokens in `app/assets/css/surfaces.css` define surface text, borders,
and hover colors. Nuxt UI theme overrides use Tailwind rounding utilities:
normal controls and buttons have 8px corners and panels have 12px corners.
Nuxt UI's size variants, internal padding, and icon spacing remain unchanged,
including compact toolbar controls. The Brutal theme retains its square
corners, heavier rules, and distinct typography.

`portal-surface` establishes surface-specific text and border colors for a
container, including teleported menus and dialogs. `portal-field-surface` does
the same for a field without changing its parent or the page canvas. Do not
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
