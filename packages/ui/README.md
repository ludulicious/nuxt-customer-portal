# Nuxt Customer Portal UI

Neutral shell primitives and fallback layouts for Nuxt Customer Portal. Hosts
can override every layout and branded component while retaining the shared
feature registry, session state, and navigation contracts from core.

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
