---
name: build-portal-crud-page
description: Analyze, create, or refactor CRUD administration pages in the Ludu customer portal so they follow the timesheets admin interaction pattern. Use for Nuxt/Vue admin routes and section shells that need searchable, filterable, sortable, server-paginated entity card lists; URL-persisted collection state; shared create/edit forms; viewport-aware inline forms; isolated nested card actions; inactive linked relations; validated destructive deletion; Nitro APIs through composables; and English and Dutch translations.
---

# Build Portal CRUD Page

Use the timesheet projects page as the interaction baseline, then adapt the pattern to the entity rather than copying fields mechanically.

## Inspect before editing

1. Locate the page, composable, Nitro handlers, repository functions, validation schemas, database relations, DTOs, locales, and tests.
2. Read existing and staged changes. Preserve user work and treat the current implementation as the source of truth.
3. Read [references/timesheet-projects-pattern.md](references/timesheet-projects-pattern.md) for the baseline behavior and file map.
4. Determine whether delete means permanent deletion, deactivation, or archival from schema constraints and existing product language.
5. Identify dependent records. A hidden button is not sufficient protection; enforce deletion rules in the repository transaction.
6. Identify whether navigation represents distinct pages. Give each distinct page its own file-based route; do not model pages as query-string sections.

## Apply the page pattern

### Layout

- Keep the page header responsive with an entity icon beside the title, the subtitle retained below it, and a small outlined `New …` button on the right.
- Use one full-width, single-column card list with `gap-3`.
- When the list is empty, render a reusable first-use empty state with an entity icon, concise title and description, and a large `Create your first …` action. Open the existing create form only after that action; cancelling returns to the empty state.
- When entities exist, keep the create form closed until requested and retain the compact outlined `New …` header action.
- Insert an edit form directly after its entity card. Put a new-item form first in the list.
- Insert delete confirmation directly after its entity card.
- Keep edit and delete states mutually exclusive.
- Use responsive flex/grid utilities already present in the page. Avoid a permanent form sidebar.
- Make the dashboard page body an explicit vertical scroll container (`h-full min-h-0 overflow-y-auto`) when its ancestors constrain height.

### Collection experience

- Add shared responsive controls for free-text search, entity-appropriate filters, sort field, and sort direction. Reuse the same control component or pattern across section views instead of duplicating it.
- Persist search, filters, sort field, sort direction, and page in URL query parameters. Initialize controls from the route, update the route when state changes, and avoid route/watch feedback loops.
- Reset to page 1 when search, filters, sorting, or direction changes. Omit default-valued query parameters when the existing portal convention does so.
- Implement organization-scoped server pagination with 20-item pages. Apply search and filters before counting, use a stable secondary sort such as entity ID, and return enough metadata to determine the current page, total pages, and available previous/next pages.
- Provide automatic previous/next loading at the list boundaries plus accessible numbered pagination. Prevent duplicate requests and repeated page insertion while a load is pending.
- When loading a later page, append unique entities. When loading an earlier page, prepend unique entities and preserve the user's visual scroll position by compensating for the change in scroll height after `nextTick()`.
- Keep the URL page aligned with the page the user navigated to even when multiple pages are accumulated in memory. Replace the accumulated window when search, filters, or sorting changes.
- Make section bootstrap loading section-aware: load only collections required by the visible section and its forms. Do not fetch a visible paginated collection again as part of a broad bootstrap payload.
- Preserve create/edit/delete panels and selection across safe page accumulation, but close or reset transient state when its entity disappears after a query-state change.
- Add English and Dutch copy for search placeholders, filter choices, sort labels, pagination labels, result counts, empty filtered results, and loading/error states.

### Routes and components

- Give each distinct admin page its own route file, such as `/admin/timesheets/projects`; let the section root redirect to the default page.
- Update navigation destinations and active states to compare route paths rather than query parameters.
- Keep shared bootstrap, header, and loading behavior in a section-page component when appropriate.
- Select shared section views through a typed component map and `<component :is="selectedComponent">` rather than a long conditional component chain.
- Key a dynamic section component by its section identifier so create/edit state cannot leak between admin routes.
- Extract the first-use presentation into one reusable component that accepts the icon, title, description, action label/icon, and optional disabled state, and emits one action event. Reuse it across entity sections instead of duplicating `UEmpty` markup.
- Extract substantial forms into dedicated components. Use the same form component for create and edit, controlled by an editing ID or `editing` prop; do not duplicate create and edit markup.
- Keep list, deletion, and mutation orchestration in the parent unless moving it produces a clearer domain boundary.

### Buttons and state

- Make each entity card clickable and keyboard accessible with `role="button"`, `tabindex="0"`, Enter, and Space bindings. Clicking the selected card again closes its editor.
- Use compact ghost icon buttons for edit and delete with translated `aria-label` and `aria-expanded`.
- Keep edit/delete buttons inside the card. Add `@click.stop` and `@keydown.stop` so their actions override the card interaction.
- Stop propagation from every other nested interactive region, including switches, expandable details, inputs, and secondary actions. A status toggle or disclosure must not open or close the editor.
- Use a plus icon and outlined button for create.
- Put regular-sized Cancel and Save/Create buttons in a right-aligned action row. Use an outlined neutral Cancel and a primary submit action.
- Add a close icon button to the edit-form header. Make Close, Cancel, and Escape reset and close the same editor state.
- Use a destructive color and trash icon only for the final delete action.
- Toggle an already-open editor or delete panel closed when its action is clicked again.
- Reset form values and entity IDs after save/cancel. Avoid stale state when switching between entities.
- Keep an empty collection's `formOpen` state false initially. Let only the first-use CTA or a `New …` action open it; do not infer open state from an empty list.
- Disable submit until required trimmed values are valid. Show loading state while requests run.
- Keep lightweight domain actions such as active/inactive switches on the entity card when useful.
- After inserting or moving an ordered edit form, await `nextTick()`. If the complete form fits below the application header, smoothly center it; otherwise smoothly align it to the top. Apply a header-aware scroll margin, then focus the first enabled field with `preventScroll: true`.
- Guard viewport and DOM access with `import.meta.client`.

### Form validation

- Use Nuxt UI `UForm` with a Zod schema for every submitted data-entry form. Do not depend on native browser validation, disabled submit buttons, or mutation errors as the primary validation mechanism.
- Pass the reactive model through `:state`, the schema through `:schema`, and submit with `@submit`. Give every validated `UFormField` a `name` matching its schema path so errors render beside the correct control; use dotted array paths such as `lines.${index}.description` for repeated fields.
- Build schemas with the same normalization and constraints as the Nitro request schema: trim strings, normalize case where the API does, validate email/date/number formats, enforce ranges, and model cross-field rules with `refine` or `superRefine`.
- Localize client-side validation messages in both English and Dutch. Keep server request schemas language-neutral and authoritative.
- Validate collection-aware rules, such as unique contact emails, against current bootstrap data while excluding the record being edited. Repeat uniqueness and dependency checks in the repository to handle stale clients and concurrent writes.
- Translate expected repository conflicts to typed HTTP errors such as 409. When a conflict belongs to one field, use the `UForm` instance's `setErrors` to show it inline instead of exposing a raw fetch/database error toast.
- Clear form errors and stale values when cancelling, switching records, or reopening create mode.

### CRUD wiring

- Read entities from the page bootstrap response.
- Route writes through the domain composable; do not call `$fetch` directly from the page.
- Reuse one form and save handler for create/update, branching on an editing ID.
- Refresh bootstrap data after successful mutations.
- Parse every request with a Zod schema and require the feature's `manage` policy in every admin handler.
- Scope every repository query and mutation by organization ID.
- When a selectable relation can be deactivated, show active options plus inactive options already linked to the edited entity. On update, allow retaining those existing inactive links but reject newly assigned inactive links; repeat this rule in repository validation and cover both cases with tests.
- For deletion, add:
  1. a read-only eligibility endpoint;
  2. a DELETE endpoint with typed-name validation;
  3. a repository-level dependency check repeated inside the delete transaction;
  4. a 404 for foreign/missing entities, 400 for name mismatch, and 409 for dependency conflicts.
- Never execute deletion directly from a list-row trash icon. Open a Nuxt UI confirmation surface first—prefer the portal's reusable `ConfirmationModal` for straightforward deletes, and use an inline typed-name panel when dependency eligibility or exact-name confirmation is required. Show the entity identity, explain irreversibility, provide a neutral cancel action, and reserve destructive color/icon styling for the final confirmation action.
- Let database cascades remove join rows only when domain history is not lost. Never cascade-delete time entries.

### Copy and accessibility

- Add all UI strings to both `en.json` and `nl.json`.
- Include create/edit/delete labels, eligibility states, typed-name instruction, confirmation label, success message, and generic failure handling.
- Prefer entity names in destructive confirmation over generic “Are you sure?” dialogs.
- Keep visual status understandable in text; do not rely on color alone.

## Verify

1. Run the feature tests and locale validation.
2. Run Nuxt typecheck.
3. Run ESLint on changed source files or the project lint task.
4. Run `git diff --check`.
5. Inspect the final diff for accidental changes to existing work.
6. If the app can run locally, verify card click, keyboard activation, edit, Close, Cancel, Escape, quick status changes, blocked delete, successful delete, narrow viewport layout, editor placement, first-field focus, and translated labels.
7. For first-use states, load each empty route cleanly and verify the empty-state CTA appears before its form. Then activate the CTA, verify the form, cancel, and verify the empty state returns. When hot reload has preserved prior component state, reload the route before diagnosing initial-state behavior.
8. Submit each form empty and with malformed values; verify localized inline errors appear on the correct fields and no request is sent. Exercise uniqueness conflicts through both the client-side check and a server-side 409 response.
9. Click every trash action and verify no mutation occurs before explicit confirmation. Verify cancel preserves the record and the final destructive action deletes it.
10. Exercise every nested card control and verify it does not trigger the card editor. Confirm the edit and delete buttons remain independently clickable.
11. Verify search, each filter, every sort option, both sort directions, and page survive reload and browser Back/Forward through URL queries. Confirm query changes reset to page 1 without duplicate requests or watcher loops.
12. Verify the API scopes list and count queries to the organization, returns 20-item pages with deterministic ordering, and cannot expose another organization's records.
13. Exercise numbered pagination and automatic previous/next loading. Confirm later pages append without duplicates, earlier pages prepend without a visible scroll jump, and rapid/repeated boundary triggers do not insert a page twice.
14. Inspect network requests for each section and confirm the visible paginated collection is fetched once rather than duplicated by bootstrap. Verify forms still receive every supporting collection they require.

If an existing page lacks a backend capability required for complete CRUD, implement the capability across validation, repository, handler, composable, UI, and translations rather than producing a visual-only imitation.
