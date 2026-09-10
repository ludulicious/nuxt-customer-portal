# Clients layer

Owns CLIENT organizations, business profiles, memberships, invitations, archival, and generic feature-module activations. Feature layers depend on its public server contracts instead of implementing their own client directories.

## Business and personal clients

The default configuration remains B2B-only. Enable `clients.allowedTypes: ['organization', 'person']` and optionally `clients.personalSelfRegistration: true` for mixed portals. See [configuration, access, timezone contracts, and migration guidance](../../docs/guides/business-and-personal-clients.md).
