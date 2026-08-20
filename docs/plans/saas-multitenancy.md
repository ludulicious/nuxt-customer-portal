# SaaS Multitenancy Plan

## Status and implementation order

This document preserves the intended future SaaS architecture. It is not the next implementation milestone. The generic Clients module refactor described in `generic-clients-module.md` must be completed first.

## Summary

Build `apps/saas` as a private production host that provides:

- the platform-domain control plane, with its own database and authentication;
- the Customer Portal runtime for tenant subdomains and verified custom domains.

All tenants run the same application release, but each tenant receives a separate PostgreSQL database. Each tenant database contains exactly one `PROVIDER` organization and that provider's `CLIENT` organizations.

## Application architecture

- Add a private `apps/saas` application; do not publish it as an npm package.
- Consume the public Customer Portal preset and feature packages.
- The platform domain and control plane may be served by the same `apps/saas` runtime as tenant domains. Platform routes and tenant routes must remain explicitly separated by host and request context.
- The platform has its own PostgreSQL database and its own Better Auth installation. Platform users, onboarding records, platform sessions, and control-plane records never live in tenant databases.
- Resolve every portal request by normalized hostname before initializing authentication or feature repositories.
- Resolve the hostname through a central control-plane database to obtain:
  - tenant ID and immutable slug;
  - canonical and alias domains;
  - tenant lifecycle status;
  - database and tenant-auth secret references;
  - tenant schema and application version.
- Extend Core during the SaaS phase with injectable, request-scoped database and authentication providers.
- Existing dedicated Customer Portal hosts use a fixed database provider. `apps/saas` uses hostname-based tenant resolution.
- Cache tenant database pools with a strict maximum size, idle eviction, and guaranteed cleanup.
- Never expose or log raw tenant connection strings.

## Control plane

The central control-plane database stores only platform-level data:

- tenant ID, immutable slug, and lifecycle status;
- standard subdomain, custom domains, verification status, and canonical-domain selection;
- database and tenant-auth secret references and provisioning metadata;
- schema/application version and health information;
- primary owner contact details;
- subscription status and external billing identifiers;
- creation, suspension, restoration, and deletion audit timestamps.
- platform onboarding records, including requested company information, selected modules, requested owner email, and provisioning progress.

Database credentials and tenant-specific Better Auth secrets belong in a host secret manager. The control-plane database stores references to those secrets, not their values. Every tenant receives a unique generated Better Auth secret; tenant authentication secrets are never shared with the platform or another tenant.

The control-plane database and authentication data are not tenant data. Platform authentication is used for platform-domain onboarding, operator access, and post-onboarding account management; tenant authentication remains local to each tenant database.

Use the following lifecycle states:

- `PENDING_EMAIL`
- `PROVISIONING`
- `ACTIVE`
- `READ_ONLY`
- `DELETION_SCHEDULED`
- `ERROR`
- `DELETED`

Do not store tenant users, clients, timesheets, requests, invoices, or other tenant business data centrally.

## Self-service onboarding

Onboarding is a platform-domain workflow and is separate from tenant authentication. It collects the company information, immutable tenant slug, selected modules, and the credentials for the first tenant user, who receives the tenant `admin` role.

1. Authenticate or verify the onboarding identity through platform authentication.
2. Collect the company information, immutable tenant slug, selected modules, and first tenant admin username/password.
3. Reserve `slug.platform.tld` atomically.
4. Provision or register the tenant PostgreSQL database through a provider adapter.
5. Generate and store a unique tenant Better Auth secret.
6. Run all configured Customer Portal package migrations.
7. Seed exactly one `PROVIDER` organization and the first Better Auth tenant user with the `admin` role.
8. Configure the selected module activations for the tenant.
9. Mark the tenant active and register its standard subdomain.
10. Redirect to the tenant subdomain using a short-lived, single-use handoff code.
11. Exchange the handoff code for a tenant-local session.

Provisioning must be idempotent and resumable after partial failures. Retrying a failed step must not create a second database, provider organization, user, or domain binding.

The first tenant admin password must be transferred only through the provisioning workflow and must not be stored in the control-plane database, onboarding journal, logs, or handoff code. If the platform stores a temporary credential, it must be encrypted, single-use, and deleted immediately after successful tenant-user creation.

## Provider adapters

`apps/saas` should define or implement adapters for:

- database provisioning, migration, suspension, restoration, and deletion;
- tenant database registration for bring-your-own-database deployments;
- secret storage and secret-reference resolution;
- custom-domain registration, DNS instructions, validation, and certificate provisioning;
- billing-plan and subscription-state synchronization;
- platform-operator authentication and authorization.

Billing integration in the first version stores plan, status, and external customer/subscription IDs. Checkout and provider-specific billing workflows remain outside the Customer Portal packages.

The default database flow provisions a dedicated PostgreSQL database. A BYOD flow accepts a provider-approved PostgreSQL connection, such as a Neon database URL, validates connectivity and permissions, stores only a secret reference, and applies the same migration and health checks. Raw BYOD connection strings must never be persisted in control-plane records or logs.

## Tenant request lifecycle

For every tenant-domain request:

1. Normalize and validate the hostname.
2. Trust forwarded host headers only when the request came through an explicitly configured trusted proxy.
3. Resolve the tenant and canonical domain from the control plane.
4. Reject unknown, deleted, or invalid domains before authentication.
5. Redirect verified aliases to the canonical domain before creating or reading a session.
6. Resolve the database secret and obtain a cached tenant pool.
7. Initialize tenant-local Better Auth and the request database context.
8. Execute Customer Portal handlers against that request context only.

Feature code must never import a global database singleton in the SaaS runtime.

## Domains and sessions

- Give every tenant a standard `slug.platform.tld` subdomain.
- Allow verified custom domains through the domain-provider adapter.
- Maintain exactly one canonical active domain per tenant.
- Redirect other verified aliases before authentication.
- Retain the standard subdomain as the recovery fallback.
- If monitoring detects that a custom canonical domain is no longer valid, fall back to the standard subdomain.
- Use host-only cookies; do not share sessions across tenant domains.
- Keep tenant identities and sessions tenant-local. There is no shared tenant login directory or tenant switcher; platform users authenticate separately on the platform domain.

The platform domain may support centrally configured social login because it has stable callback URLs. Tenant portals initially support email/password and email OTP only. A later phase may allow each tenant to configure its own social-login providers and callback domains; tenant OAuth credentials must remain tenant-specific secrets and must not be shared with the platform or other tenants.

## Tenant administration and lifecycle

- Tenant-domain users cannot manage custom domains, subscription settings, onboarding, or tenant termination.
- These actions are available exclusively on the platform domain through platform authentication and a narrow, server-only control-plane service.
- Tenant feature code does not receive general control-plane database access.
- Authenticate platform operators through a host-provided authorization adapter.
- Platform operators may inspect provisioning, versions, domains, and health, but do not automatically receive access to tenant business data.
- Suspended or cancelled tenants become `READ_ONLY` first.
- In read-only state, block business-data mutations while allowing authorized export and restoration flows.
- Retain tenant data for 30 days.
- After 30 days, an audited background job removes the database, secrets, custom-domain bindings, and remaining tenant routing records.

## Public Customer Portal integration

The SaaS implementation will require public Core contracts for:

- resolving a tenant for an incoming request;
- obtaining a request-scoped database context;
- creating a request-scoped Better Auth instance;
- disposing or evicting database pools;
- reporting the required package migration set and schema version;
- running the same portal packages in fixed-database and tenant-resolved modes.

These contracts should remain provider-neutral. Concrete SaaS provisioning, domain, secret, and billing integrations stay private to `apps/saas`.
The platform control plane and its Better Auth integration are host-owned by `apps/saas`; they are not part of the public Customer Portal preset.

## Verification

- Prove isolation with two tenant databases containing overlapping user, organization, client, and record IDs.
- Test hostname normalization, unknown hosts, spoofed forwarded headers, and trusted-proxy behavior.
- Test canonical redirects and ensure authentication cookies are never created on aliases.
- Test database-pool limits, idle eviction, application shutdown, and unavailable tenant databases.
- Test duplicate slugs, expired verification, failed provisioning, failed migrations, and idempotent retry.
- Test platform authentication boundaries, onboarding credential handling, selected module activation, and tenant-admin creation.
- Test BYOD database registration, connectivity failure, insufficient permissions, secret rotation, and removal.
- Test custom-domain validation, certificate failure, invalidated primary domains, and fallback to the standard subdomain.
- Test `READ_ONLY`, restoration within 30 days, and audited deletion after the retention period.
- Run the same package contract and feature suites against fixed-database and hostname-resolved database providers.

## Assumptions

- PostgreSQL remains the only database provider.
- The first shared deployment targets approximately 10-100 tenants.
- One runtime release serves all shared tenants.
- Every tenant database contains exactly one `PROVIDER` organization.
- The platform has a separate database and authentication system from every tenant.
- Clients and all business data remain tenant-local.
- Platform-domain administration is the only location for onboarding, domain, subscription, and tenant lifecycle management.
- Tenants may use either a provisioned PostgreSQL database or an approved bring-your-own PostgreSQL database.
- Cross-tenant reporting and central tenant-data access are out of scope.
- Dedicated deployment per tenant is not part of the first SaaS implementation.
