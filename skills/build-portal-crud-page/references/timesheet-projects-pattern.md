# Timesheet projects CRUD pattern

## Source map

- Routes: `layers/timesheets/app/pages/admin/timesheets/`
- Shared page shell: `layers/timesheets/app/components/TimesheetsAdminSectionPage.vue`
- Section views: `layers/timesheets/app/components/TimesheetsAdmin*.vue`
- Shared create/edit forms: `layers/timesheets/app/components/TimesheetsProjectForm.vue` and `TimesheetsActivityForm.vue`
- Client API: `layers/timesheets/app/composables/useTimesheets.ts`
- Validation: `layers/timesheets/server/utils/timesheet-validation.ts`
- Repository: `layers/timesheets/server/utils/timesheet-repository.ts`
- Handlers: `layers/timesheets/server/api/timesheets/admin/projects/`
- Schema: `layers/timesheets/server/db/schema/timesheets.ts`
- Locales: `layers/timesheets/i18n/locales/en.json` and `nl.json`
- Tests: `layers/timesheets/test/timesheets.test.ts`

## Interaction model

The section header owns the compact create action when entities exist. An empty collection shows a shared first-use empty state with an entity icon, explanatory copy, and a large `Create your first …` action. That action opens the same create form used by populated pages; cancelling returns to the empty state. Entity cards own edit, delete, status, summary, and entity-specific secondary controls. The complete card is a keyboard-accessible edit trigger. Nested controls stop click and keyboard propagation so their actions override the card trigger. Forms and destructive confirmations appear inline in the list, immediately after the affected entity.

The page header shows the entity icon beside its title and retains the explanatory subtitle. Below it, shared responsive collection controls provide search, entity-specific filters, sort field, and sort direction for projects, clients, activities, and invoices.

List ordering uses CSS `order`:

- Entity card: `index * 2`
- Entity edit/delete card: `index * 2 + 1`
- New entity form: `-1`

Only one transient panel is open. Opening edit closes delete; opening delete closes edit. Clicking the same action again closes it. Empty lists do not imply that the create form is open; an explicit CTA action controls that state.

Each distinct sidebar page has a file-based route. `/admin/timesheets` redirects to approvals. The shared section shell owns bootstrap, headings, and loading, and uses a typed section-to-component map with Vue's `:is` binding. Key the dynamic component by section to prevent transient create/edit state from crossing routes.

## Collection query and pagination model

Treat the route query as the durable collection state. Persist search, filters, sort field, sort direction, and page; hydrate controls from it on entry and browser navigation. Reset page to 1 after any non-page query change. Normalize absent or invalid values to safe defaults and prevent route watchers from writing equivalent queries back to the router.

List endpoints are organization-scoped and server-backed. Search and filter before calculating the total, use 20-item pages, validate allowed sort fields and directions, and add a deterministic tie-breaker. Return the items with pagination metadata such as page, page size, total items, total pages, and previous/next availability.

Support direct numbered navigation and automatic boundary loading. Accumulate adjacent pages without duplicate entities: append later pages and prepend earlier pages. Track loaded and pending page numbers so intersection observers, rapid scrolling, and route updates cannot fetch or insert a page twice. A search/filter/sort change clears the accumulated window before loading page 1.

Before prepending an earlier page, capture the scroll container's height and scroll position. After insertion and `nextTick()`, add the height delta to `scrollTop` so the same content remains visually anchored. Keep the route's `page` query aligned with explicit page navigation even when the client retains adjacent pages in memory.

Make bootstrap requests section-aware. The visible paginated entity collection comes from its list endpoint only; bootstrap returns shared/supporting collections needed by that section's forms and controls, not a second copy of the visible list. Ensure create/edit flows still receive relations such as clients or activities where required.

## Form model

One reactive model and one extracted form component support create and update. An empty editing ID means create; an `editing` prop controls labels and submit copy. Opening edit copies entity values into the model; reset clears every field, the editing ID, and the open flag. Required fields control the submit button. Creation and update flow through the composable and refresh the bootstrap response.

Related records can be created in a small bordered nested panel when the parent form requires them, as projects allow creating clients and activities without abandoning the form.

Submitted forms use Nuxt UI `UForm` with a localized Zod schema. Bind the reactive model with `:state`, bind the schema with `:schema`, and give each validated `UFormField` a matching `name`. This replaces native browser validation and submit-button-only guards. Mirror request-schema normalization and constraints in the UI schema, use `refine`/`superRefine` for cross-field or bootstrap-aware rules, and map expected server conflicts back to fields with `setErrors`.

For relations with active/inactive state, the edit selector contains all active records plus inactive records already selected by that entity. New forms expose active records only. Repository update validation allows an inactive assignment only when it already exists, so saving an unchanged legacy relation succeeds without allowing new inactive assignments.

## Editor interaction and scrolling model

Give each entity card `role="button"`, `tabindex="0"`, and click, Enter, and Space handlers that toggle its editor. Put compact edit and delete buttons inside the card and use Vue's `@click.stop` and `@keydown.stop`. Stop propagation on all other interactive children, such as activity switches and project-rate `details`, so their behavior wins over the card click.

The edit form header contains a neutral ghost Close button. Close, the outlined Cancel action, and Escape all reset and close the editor. Put regular-sized Cancel and Save buttons in a right-aligned action row rather than stretching either action across the card.

The shared page shell is a constrained-height vertical scroll container. After an ordered edit card renders, guard for the client, await `nextTick()`, and measure the form root against the viewport minus the application header and spacing. Smoothly center the editor when it fits completely; otherwise align it to the top. Use a header-aware scroll margin. Focus the first enabled textarea, input, select, or combobox after positioning it, with `preventScroll: true`, so focus does not undo the chosen position. Apply this consistently to every inline editor.

## Delete model

Deletion is deliberately two-stage:

1. GET `/deletion` verifies ownership and checks for historical time entries.
2. The UI reports whether deletion is permitted.
3. The user types the exact entity name.
4. DELETE submits that name.
5. The repository transaction repeats ownership, name, and dependency checks before deleting.

Time-entry history blocks deletion. Join-table assignments may cascade when the schema explicitly permits it.

Simple deletes still require explicit confirmation. The row trash icon opens the portal's reusable Nuxt UI `ConfirmationModal`; it never calls the API directly. The modal identifies the record, states that deletion is irreversible, and offers neutral cancel plus a destructive final action. Use the longer inline eligibility and typed-name flow when dependencies or historical data require it.

## Visual conventions

- Container: centered, `max-w-[1440px]`, responsive padding.
- Header: stacked on mobile, aligned to bottom edge on larger screens.
- Header identity: restrained entity icon beside the title with the subtitle preserved.
- Collection controls: shared responsive search/filter/sort controls that wrap cleanly on narrow screens.
- List: full-width grid with `gap-3`.
- Cards: clickable and keyboard accessible; primary information left; compact actions and status right; selected editor card visibly outlined.
- Edit icon: neutral ghost pencil, size `xs`.
- Delete icon: error ghost trash, size `xs`.
- Create: small outlined plus button.
- First use: shared outlined `UEmpty`, restrained entity icon, concise localized copy, and a large primary `Create your first …` button. Pass presentation and action props into one reusable component.
- Delete panel: error border/header, eligibility icon and text, exact-name input, neutral cancel plus destructive confirmation.
- Forms: `space-y-4`, full-width inputs, close icon in edit header, regular right-aligned Cancel and Save/Create actions.
- Page shell: `h-full min-h-0 overflow-y-auto` when hosted inside the dashboard group.
- Pagination: accessible numbered controls plus automatic previous/next boundary loading, with translated loading, count, and empty-filtered-result states.
