# Generic Clients Module Refactor Plan

## Status and implementation order

This is the next implementation milestone. Complete this refactor before building the SaaS application described in `saas-multitenancy.md`.

## Summary

Refactor the current Customer Portal so that:

- every installation contains exactly one `OWNER` organization;
- every other organization has the exclusive type `CLIENT`;
- organizations remain Better Auth organizations with ordinary memberships and active-organization switching;
- a user may belong to the OWNER and one or more CLIENT organizations;
- a new `@nuxt-customer-portal/clients` package owns the shared client domain;
- Timesheets, Service Requests, and future modules reuse the same clients;
- the global system-administrator bypass and `@nuxt-customer-portal/administration` package are removed.

## Target domain model

`organizationType` is a global, exclusive classification:

- `OWNER`: the single organization that owns and operates the portal workspace;
- `CLIENT`: a customer company that cannot operate an owner workspace.

There is no owner-client relationship table because a Customer Portal installation has exactly one owner. A CLIENT organization may be enabled for several feature modules through generic client-module activation records.

Users may hold memberships in organizations of both types. The active Better Auth organization determines whether a user is currently acting as owner staff or as a client contact.

## Core changes

- Extend Better Auth's organization schema with a required custom database field:

  ```ts
  organizationType: 'OWNER' | 'CLIENT'
  ```

- Add a database check constraint for the two allowed values.
- Add a partial unique index that permits at most one `OWNER` organization.
- Extend Better Auth members with organization-specific contact fields such as phone and job title. Name and email remain user fields.
- Disable ordinary user-created organizations.
- Remove automatic organization creation after ordinary signup.
- Add an idempotent CLI/seed operation that creates exactly one OWNER organization and its first owner user.
- Remove global `user.role = admin`, its authorization bypass, and tenant-wide system-administrator behavior.
- Include `organizationType` and the active membership role in the server session projection.
- Replace role-only feature policies with organization-type-aware policies. Policies must distinguish OWNER actions from CLIENT actions even when both memberships use role names such as `owner`, `admin`, and `member`.
- Provide server guards for OWNER context, CLIENT context, client-module activation, and client selection.
- Keep the organization switcher because a user may have both OWNER and CLIENT memberships.

## Organizations package

Keep `@nuxt-customer-portal/organizations` and limit it to OWNER responsibilities:

- OWNER organization profile and settings;
- OWNER members and invitations;
- user profile and security settings;
- OWNER email-provider settings;
- organization switching and active-organization presentation.

OWNER-only APIs and pages must reject active CLIENT organizations. Creation and management of CLIENT organizations move to the Clients package.

## Remove Administration

- Retire `@nuxt-customer-portal/administration`.
- Remove it from the preset, package verification, demos, documentation, and navigation.
- Move any remaining OWNER team/settings behavior into Organizations.
- Move CLIENT organization, profile, member, and invitation management into Clients.
- Do not retain a global organization/user administration bypass.

## New Clients package

Add `@nuxt-customer-portal/clients` to the default preset. It owns everything specific to CLIENT organizations:

- client creation, lookup, editing, archival, and guarded hard deletion;
- client business profiles;
- client memberships and invitations;
- contact/member administration;
- module activations;
- reusable client selectors and server-side validation;
- OWNER-side Clients navigation and detail pages;
- CLIENT-side profile and member settings.

### Database schema

Create a dedicated PostgreSQL schema with at least:

- `client_profile`
  - CLIENT organization ID as primary key and foreign key;
  - official company name;
  - address;
  - registration and VAT numbers;
  - invoice email;
  - preferred locale;
  - archived timestamp and actor;
  - created/updated audit fields.
- `client_module`
  - CLIENT organization ID;
  - registered module ID;
  - enabled/disabled state and timestamps;
  - enabling/disabling actor;
  - unique constraint on organization and module ID.

Only `organizationType` belongs on the Better Auth organization row. Client-specific business fields belong in `client_profile`.

### Creation and membership

- OWNER `owner` and `admin` roles may create CLIENT organizations.
- Client creation requires company data but does not require an initial member.
- Creating a client must not leave the creating OWNER user as a member of the new CLIENT organization.
- OWNER owner/admin may invite and manage members of any CLIENT organization.
- CLIENT owner/admin may manage members of their own active CLIENT organization.
- Every contact is a Better Auth user/member; remove the separate nullable-contact concept.
- Store organization-specific phone and job-title data on the member extension.
- OWNER owner/admin and CLIENT owner/admin may edit the client business profile. Record the editing actor for auditability.

### Archival and deletion

- Archive clients before deletion.
- Archived clients disappear from new-record selectors and reject new module activity.
- Preserve memberships and historical module references while archived.
- Permit hard deletion only when no memberships, module activations, or feature records reference the client.
- Never cascade-delete Timesheets, Service Requests, invoices, or other business history from the Clients UI.

### Navigation and UI

Expose a top-level Clients module only when the active organization is `OWNER` and the member role is `owner` or `admin`.

Provide:

- searchable, filterable client list;
- create-client flow;
- client detail page;
- profile section;
- members and invitations section;
- modules section;
- extension surfaces for module-specific client configuration.

CLIENT members do not see the OWNER Clients module. CLIENT owner/admin manages their own profile and members through CLIENT-scoped settings.

## Client-aware feature contract

Extend portal feature definitions with an optional client integration contribution containing:

- stable module ID;
- translated label and description keys;
- supported CLIENT-side actions;
- optional client-detail configuration surface.

Clients owns the generic activation record. Each feature package owns its own module-specific settings and records.

Configure new-client defaults through the host portal configuration:

```ts
clients: {
  defaultModules: ['timesheets', 'service-requests']
}
```

Validate that configured IDs belong to installed modules that advertise client support.

Disabling a module for a client:

- blocks new records for that client;
- removes CLIENT-member access to the module;
- preserves all historical feature records;
- keeps historical data readable by authorized OWNER staff.

Both navigation and server authorization must verify organization type, membership role, client state, and module activation.

## Public Clients contracts

Expose stable package contracts for feature packages, including equivalents of:

- `requireClientOrganization`;
- `getClient` and `listSelectableClients`;
- `requireClientModuleEnabled`;
- client profile and membership projections;
- module activation queries;
- a reusable client picker component/composable;
- a client-detail contribution surface.

Feature packages must not query Better Auth organization tables directly to rediscover client rules.

## Timesheets refactor

- Add Clients as a package and migration dependency.
- Remove Timesheets ownership of generic client creation, profiles, contacts, list APIs, and client administration UI.
- Remove the current generic `workspace_client` responsibility.
- Replace it with Timesheets-specific client settings keyed by CLIENT organization ID.
- Preserve Timesheets-only settings such as review access and invoice-viewer access in the Timesheets schema.
- Require a valid, active, Timesheets-enabled CLIENT organization for every project.
- Require every time entry to resolve to the project's client; do not accept an unrelated client ID from the request.
- Continue scoping OWNER-side Timesheets data to the single OWNER organization.
- Keep reviewers and invoice viewers as Timesheets-owned assignments referencing members of the selected CLIENT organization.
- Move client recipient/company fields to `client_profile`.
- Keep OWNER invoice sender configuration, banking data, and sender email templates outside the client profile.
- Expose Timesheets client settings through a contribution on the generic client detail page.
- Remove the Timesheets-specific Clients administration menu and endpoints.
- When Timesheets is disabled for a client, reject new projects, time entries, reviews, and CLIENT-side invoice access while preserving OWNER-readable history.

## Service Requests refactor

- Add Clients as a package and migration dependency.
- Require every Service Request to reference both the OWNER organization and one active, Service Requests-enabled CLIENT organization.
- In OWNER context, require the creator to select a client.
- In CLIENT context, derive the client from the active organization and reject request-body attempts to override it.
- Allow OWNER members according to the Service Requests feature policy.
- Allow CLIENT owner/admin to see all requests belonging to their client.
- Allow ordinary CLIENT members to see only requests they created.
- Add client filtering and identity to OWNER request administration, lists, details, and dashboard projections.
- When Service Requests is disabled for a client, block new requests and CLIENT access while preserving OWNER-readable history.

## One-time migration

Add a dry-run-first migration command requiring:

```text
--owner <organization-id-or-slug>
```

The migration must:

1. Validate that the selected organization exists.
2. Mark the selected organization `OWNER`.
3. Convert organizations linked as Timesheets clients of that owner to active `CLIENT` organizations.
4. Convert every remaining organization to an archived CLIENT organization and report it.
5. Exclude data owned by previous secondary Timesheets workspaces and report those exclusions.
6. Move current client company and recipient-invoice fields into `client_profile`.
7. Migrate contacts only when they already reference a valid user and CLIENT membership.
8. Skip unlinked contacts and include them in the migration report.
9. Convert selected-owner `workspace_client` rows into active Timesheets `client_module` records and Timesheets-specific client settings.
10. Apply the host's configured default modules to migrated clients in addition to inferred Timesheets activation.
11. Preserve and validate selected-owner Timesheets projects, entries, reviews, invoices, viewers, and client references.
12. Export/report existing Service Requests but do not migrate them into the new client-required model.
13. Initialize the new Service Requests tables without legacy requests.
14. Remove legacy Timesheets client/profile/contact structures only after successful validation.

The command must remain read-only unless an explicit apply option is supplied. Require and document a database backup before applying the destructive phase.

The migration report must list:

- chosen OWNER;
- active converted clients;
- archived unclassified organizations;
- skipped contacts;
- excluded secondary workspace data;
- excluded Service Requests;
- inferred and default module activations;
- blocking integrity errors.

## Implementation order

1. Core organization type, member fields, context-aware policies, and OWNER seed flow.
2. New Clients package, default-preset integration, APIs, and Clients UI.
3. Organizations cleanup and Administration removal.
4. Timesheets conversion to generic Clients.
5. Migration tooling and selected-owner data conversion.
6. Service Requests client integration and empty legacy transition.
7. Demo applications, package manifests, public contracts, and documentation.
8. Full regression and end-to-end verification.
9. Begin `apps/saas` only after this refactor is complete.

## Acceptance tests

- The database rejects invalid organization types and a second OWNER.
- Ordinary signup cannot create another organization.
- OWNER seed/bootstrap is idempotent.
- CLIENT admins cannot access OWNER administration APIs or navigation.
- Users with mixed OWNER and CLIENT memberships receive the correct UI and permissions after switching organizations.
- Creating a client does not accidentally add the creating OWNER user as a CLIENT member.
- OWNER admins and CLIENT admins can manage only the intended client profiles and memberships.
- Configured default modules and manual activation behave consistently.
- Module disablement blocks new work and CLIENT access without deleting history.
- Archived clients disappear from selectors but retain historical references.
- Timesheets rejects projects and time entries without a valid, enabled client.
- Timesheets prevents mismatches between project and time-entry clients.
- Service Requests rejects missing, disabled, archived, or cross-client IDs.
- CLIENT members see only their own requests; CLIENT owner/admin sees all requests for their client.
- Migration dry-run reports all classifications, skipped records, exclusions, and destructive actions before apply.
- Package tests, typecheck, build, and both demo end-to-end suites pass without the Administration package.

## Assumptions

- PostgreSQL remains the database provider.
- Exactly one OWNER exists per Customer Portal database.
- OWNER and CLIENT are mutually exclusive organization types.
- CLIENT organizations may never operate their own owner workspace in the same database.
- A CLIENT may be active in multiple feature modules.
- Timesheets and Service Requests always require a client.
- Historical business data is preserved when clients or module activations are disabled.
- Existing Service Requests are deliberately not imported into the new required-client model.
