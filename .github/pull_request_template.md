## Problem

Describe the user problem and why this change belongs in Customer Portal.

Closes #

## Scope

- Affected layer(s):
- Routes or APIs:
- Out of scope:

## Architecture and safety

- [ ] Server operations enforce authentication, policy, and active-organization scope independently of the UI.
- [ ] Feature code respects the portal-core boundary and remains removable from the host.
- [ ] Schema changes, when present, use a feature-owned PostgreSQL schema and include a reviewed migration.
- [ ] English and Dutch locale key trees remain aligned.
- [ ] Examples, fixtures, screenshots, and logs contain no customer data or secrets.

Explain authorization, tenant isolation, schema, migration, or portability decisions that reviewers should verify:

## Documentation and user interface

- [ ] Public documentation is updated or the change has no documentation impact.
- [ ] Visible changes include screenshots for relevant viewport, theme, role, and locale states.
- [ ] Keyboard, focus, loading, empty, error, validation, and destructive states were considered where applicable.

Documentation pull request or reason none is needed:

## Verification

- [ ] `pnpm test:features`
- [ ] `pnpm validate:feature-locales`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] Relevant migrations, when present, were tested on an empty database and representative pre-change data.
- [ ] A new or changed reusable layer was tested both absent from the host and in a clean Customer Portal checkout.

List focused tests and manual checks performed:
