# Clients layer

Owns CLIENT organizations, business profiles, memberships, invitations, archival, and generic feature-module activations. Feature layers depend on its public server contracts instead of implementing their own client directories.

## Client URLs and slugs

Client detail pages use `/clients/<slug>`. New client forms suggest a URL-safe slug from the display name until the user edits the slug manually. Both company and personal client slugs can be edited; changing an existing display name does not silently change its URL. Slugs must be unique across organizations and contain at most 160 lowercase letters, numbers, and single separating hyphens. Conflicts are shown on the slug field.

Legacy internal-ID detail links redirect to the current slug while retaining query parameters, including list return state. Editing a slug replaces the current detail URL. Previously used slugs are not kept as aliases. Mutation APIs and internal relationships continue to use stable client IDs; resolving a slug requires the same client profile management permissions as ID-based access. Personal self-registration retains its generated private identifier unless a manager supplies a slug through the client form.

## Business and personal clients

The default configuration remains B2B-only. Enable `clients.allowedTypes: ['organization', 'person']` and optionally `clients.personalSelfRegistration: true` for mixed portals. See [configuration, access, timezone contracts, and migration guidance](../../docs/guides/business-and-personal-clients.md).
