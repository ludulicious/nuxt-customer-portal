# SaaS Workspace Plan

## Status and implementation order

This document preserves the intended future SaaS architecture. It is not the next implementation milestone. The generic Clients module refactor described in `generic-clients-module.md` must be completed first.

In this plan, a workspace is the isolation and lifecycle boundary formerly described by the legacy terminology. There is no parent entity beneath a workspace: a workspace is the dedicated runtime, database, domain, and authentication context in which client organizations are managed.

## Summary

Build `apps/saas` as a private production host that provides:

- the platform-domain control plane, with its own database and authentication;
- the Customer Portal runtime for workspace subdomains and verified custom domains.

All workspaces run the same application release, but each workspace receives a separate PostgreSQL database. Each workspace database contains exactly one `PROVIDER` organization—the workspace/provider organization—and zero or more `CLIENT` organizations. Clients are organizations managed within a workspace; they are not workspaces and there is no separate isolation entity beneath a workspace.

Platform onboarding creates the workspace and its initial client organization together. The platform UI may list workspace clients, but it must not expose a direct “create client” flow. Subsequent client lifecycle behavior belongs to the workspace’s product model and authorization rules.

## Application architecture

- Add a private `apps/saas` application; do not publish it as an npm package.
- Consume the public Customer Portal preset and feature packages.
- The platform domain and control plane may be served by the same `apps/saas` runtime as workspace domains. Platform routes and workspace routes must remain explicitly separated by host and request context.
- The platform has its own PostgreSQL database and its own Better Auth installation. Platform users, onboarding records, platform sessions, and workspace lifecycle records never live in workspace databases.
- Resolve every portal request by normalized hostname before initializing authentication or feature repositories.
- Resolve the hostname through a central control-plane database to obtain:
  - workspace ID and immutable slug;
  - canonical and alias domains;
  - workspace lifecycle status;
  - database and workspace-auth secret references;
  - workspace schema and application version.
- Extend Core during the SaaS phase with injectable, request-scoped database and authentication providers.
- Existing dedicated Customer Portal hosts use a fixed database provider. `apps/saas` uses hostname-based workspace resolution.
- Cache workspace database pools with a strict maximum size, idle eviction, and guaranteed cleanup.
- Never expose or log raw workspace connection strings.

## Control plane

The central control-plane database stores platform-level workspace data and the minimal onboarding metadata needed to link a workspace to its initial client:

- workspace ID, immutable slug, and lifecycle status;
- standard subdomain, custom domains, verification status, and canonical-domain selection;
- database and workspace-auth secret references and provisioning metadata;
- schema/application version and health information;
- primary owner contact details;
- subscription status and external billing identifiers;
- creation, suspension, restoration, and deletion audit timestamps.
- platform onboarding records, including requested company information, selected modules, requested owner email, initial client organization/profile metadata, and provisioning progress.

Database credentials and workspace-specific Better Auth secrets belong in a host secret manager. The control-plane database stores references to those secrets, not their values. Every workspace receives a unique generated Better Auth secret; workspace authentication secrets are never shared with the platform or another workspace.

The control-plane database and authentication data are not workspace data. Platform authentication is used for platform-domain onboarding, operator access, and post-onboarding account management; workspace authentication remains local to each workspace database.

Use the following lifecycle states:

- `PENDING_EMAIL`
- `PROVISIONING`
- `ACTIVE`
- `READ_ONLY`
- `DELETION_SCHEDULED`
- `ERROR`
- `DELETED`

Do not store workspace users or workspace business data centrally. The control plane may retain the minimal initial client organization/profile and module metadata created by onboarding; client memberships, timesheets, invoices, and other product records belong to the workspace database.

## Self-service onboarding

Onboarding is a platform-domain workflow and is separate from workspace authentication. It collects the workspace company information, immutable workspace slug, selected modules, and the credentials for the first workspace administrator, who receives the workspace `admin` role. It creates the initial `CLIENT` organization as part of workspace creation; users do not create clients directly from the SaaS Clients screen.

1. Authenticate or verify the onboarding identity through platform authentication.
2. Collect the workspace company information, immutable workspace slug, selected modules, and first workspace admin username/password.
3. Reserve `slug.platform.tld` atomically.
4. Provision or register the workspace PostgreSQL database through a provider adapter.
5. Generate and store a unique workspace Better Auth secret.
6. Run all configured Customer Portal package migrations.
7. Seed exactly one `PROVIDER` organization in the workspace database and create the initial `CLIENT` organization/profile in the control plane.
8. Configure the selected module activations for the workspace. The SaaS offering currently includes Timesheets and Invoices; Service Requests is not part of this plan.
9. Mark the workspace active and register its standard subdomain.
10. Redirect to the workspace subdomain using a short-lived, single-use handoff code.
11. Exchange the handoff code for a workspace-local session.

Provisioning must be idempotent and resumable after partial failures. Retrying a failed step must not create a second database, provider organization, user, or domain binding.

The first workspace admin password must be transferred only through the provisioning workflow and must not be stored in the control-plane database, onboarding journal, logs, or handoff code. If the platform stores a temporary credential, it must be encrypted, single-use, and deleted immediately after successful workspace-user creation.

## Provider adapters

`apps/saas` should define or implement adapters for:

- database provisioning, migration, suspension, restoration, and deletion;
- workspace database registration for bring-your-own-database deployments;
- secret storage and secret-reference resolution;
- custom-domain registration, DNS instructions, validation, and certificate provisioning;
- billing-plan and subscription-state synchronization;
- platform-operator authentication and authorization.

Billing integration in the first version stores plan, status, and external customer/subscription IDs. Checkout and provider-specific billing workflows remain outside the Customer Portal packages.

The default database flow provisions a dedicated PostgreSQL database. A BYOD flow accepts a provider-approved PostgreSQL connection, such as a Neon database URL, validates connectivity and permissions, stores only a secret reference, and applies the same migration and health checks. Raw BYOD connection strings must never be persisted in control-plane records or logs.

## Workspace request lifecycle

For every workspace-domain request:

1. Normalize and validate the hostname.
2. Trust forwarded host headers only when the request came through an explicitly configured trusted proxy.
3. Resolve the workspace and canonical domain from the control plane.
4. Reject unknown, deleted, or invalid domains before authentication.
5. Redirect verified aliases to the canonical domain before creating or reading a session.
6. Resolve the database secret and obtain a cached workspace pool.
7. Initialize workspace-local Better Auth and the request database context.
8. Execute Customer Portal handlers against that request context only.

Feature code must never import a global database singleton in the SaaS runtime. Workspace handlers must enforce that client operations target `CLIENT` organizations and must not treat the workspace/provider organization as a client.

## Domains and sessions

- Give every workspace a standard `slug.platform.tld` subdomain.
- Allow verified custom domains through the domain-provider adapter.
- Maintain exactly one canonical active domain per workspace.
- Redirect other verified aliases before authentication.
- Retain the standard subdomain as the recovery fallback.
- If monitoring detects that a custom canonical domain is no longer valid, fall back to the standard subdomain.
- Use host-only cookies; do not share sessions across workspace domains.
- Keep workspace identities and sessions workspace-local. There is no shared workspace login directory or workspace switcher; platform users authenticate separately on the platform domain.

The platform domain may support centrally configured social login because it has stable callback URLs. Workspace portals initially support email/password and email OTP only. A later phase may allow each workspace to configure its own social-login providers and callback domains; workspace OAuth credentials must remain workspace-specific secrets and must not be shared with the platform or other workspaces.

## Workspace administration and lifecycle

- Workspace-domain users cannot manage custom domains, subscription settings, onboarding, or workspace termination.
- These actions are available exclusively on the platform domain through platform authentication and a narrow, server-only control-plane service.
- Workspace feature code does not receive general control-plane database access.
- Authenticate platform operators through a host-provided authorization adapter.
- Platform operators may inspect provisioning, versions, domains, and health, but do not automatically receive access to workspace business data.
- Suspended or cancelled workspaces become `READ_ONLY` first.
- In read-only state, block business-data mutations while allowing authorized export and restoration flows.
- Retain workspace data for 30 days.
- After 30 days, an audited background job removes the database, secrets, custom-domain bindings, and remaining workspace routing records.

## Public Customer Portal integration

The SaaS implementation will require public Core contracts for:

- resolving a workspace for an incoming request;
- obtaining a request-scoped database context;
- creating a request-scoped Better Auth instance;
- disposing or evicting database pools;
- reporting the required package migration set and schema version;
- running the same portal packages in fixed-database and workspace-resolved modes.

These contracts should remain provider-neutral. Concrete SaaS provisioning, domain, secret, and billing integrations stay private to `apps/saas`.
The platform control plane and its Better Auth integration are host-owned by `apps/saas`; they are not part of the public Customer Portal preset.

## Verification

- Prove isolation with two workspace databases containing overlapping user, organization, client, and record IDs.
- Test hostname normalization, unknown hosts, spoofed forwarded headers, and trusted-proxy behavior.
- Test canonical redirects and ensure authentication cookies are never created on aliases.
- Test database-pool limits, idle eviction, application shutdown, and unavailable workspace databases.
- Test duplicate slugs, expired verification, failed provisioning, failed migrations, and idempotent retry.
- Test platform authentication boundaries, onboarding credential handling, initial client creation, selected module activation, and workspace-admin creation.
- Test BYOD database registration, connectivity failure, insufficient permissions, secret rotation, and removal.
- Test custom-domain validation, certificate failure, invalidated primary domains, and fallback to the standard subdomain.
- Test `READ_ONLY`, restoration within 30 days, and audited deletion after the retention period.
- Run the same package contract and feature suites against fixed-database and hostname-resolved database providers.

## Assumptions

- PostgreSQL remains the only database provider.
- The first shared deployment targets approximately 10-100 workspaces.
- One runtime release serves all shared workspaces.
- Every workspace database contains exactly one `PROVIDER` organization.
- The platform has a separate database and authentication system from every workspace.
- Client business data remains workspace-local. The control plane stores only workspace lifecycle data and the minimal initial client metadata required by onboarding.
- Platform-domain administration is the only location for onboarding, domain, subscription, and workspace lifecycle management.
- Workspaces may use either a provisioned PostgreSQL database or an approved bring-your-own PostgreSQL database.
- Cross-workspace reporting and central workspace-data access are out of scope.
- Dedicated deployment per workspace is not part of the first SaaS implementation.
