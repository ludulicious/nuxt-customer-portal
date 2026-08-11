# SaaS Multitenancy Plan

## Status and implementation order

This document preserves the intended future SaaS architecture. It is not the next implementation milestone. The generic Clients module refactor described in `generic-clients-module.md` must be completed first.

## Summary

Build `apps/saas` as a private production host that provides both:

- the central signup, tenant, domain, subscription, and lifecycle control plane;
- the Customer Portal runtime for tenant subdomains and verified custom domains.

All tenants run the same application release, but each tenant receives a separate PostgreSQL database. Each tenant database contains exactly one `OWNER` organization and that owner's `CLIENT` organizations.

## Application architecture

- Add a private `apps/saas` application; do not publish it as an npm package.
- Consume the public Customer Portal preset and feature packages.
- Resolve every portal request by normalized hostname before initializing authentication or feature repositories.
- Resolve the hostname through a central control-plane database to obtain:
  - tenant ID and immutable slug;
  - canonical and alias domains;
  - tenant lifecycle status;
  - database secret reference;
  - tenant schema and application version.
- Extend Core during the SaaS phase with injectable, request-scoped database and authentication providers.
- Existing dedicated Customer Portal hosts use a fixed database provider. `apps/saas` uses hostname-based tenant resolution.
- Cache tenant database pools with a strict maximum size, idle eviction, and guaranteed cleanup.
- Never expose or log raw tenant connection strings.

## Control plane

The central control-plane database stores only platform-level data:

- tenant ID, immutable slug, and lifecycle status;
- standard subdomain, custom domains, verification status, and canonical-domain selection;
- database secret reference and provisioning metadata;
- schema/application version and health information;
- primary owner contact details;
- subscription status and external billing identifiers;
- creation, suspension, restoration, and deletion audit timestamps.

Database credentials belong in a host secret manager. The control-plane database stores references to those secrets, not connection strings.

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

1. Collect the owner company name, immutable tenant slug, and owner email on the platform domain.
2. Verify the email address before provisioning infrastructure.
3. Reserve `slug.platform.tld` atomically.
4. Provision the tenant PostgreSQL database through a provider adapter.
5. Run all configured Customer Portal package migrations.
6. Seed exactly one `OWNER` organization and the first Better Auth owner user.
7. Mark the tenant active and register its standard subdomain.
8. Redirect to the tenant subdomain using a short-lived, single-use handoff code.
9. Exchange the handoff code for a tenant-local session.

Provisioning must be idempotent and resumable after partial failures. Retrying a failed step must not create a second database, owner organization, user, or domain binding.

## Provider adapters

`apps/saas` should define or implement adapters for:

- database provisioning, migration, suspension, restoration, and deletion;
- secret storage and secret-reference resolution;
- custom-domain registration, DNS instructions, validation, and certificate provisioning;
- billing-plan and subscription-state synchronization;
- platform-operator authentication and authorization.

Billing integration in the first version stores plan, status, and external customer/subscription IDs. Checkout and provider-specific billing workflows remain outside the Customer Portal packages.

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
- Keep identities and sessions tenant-local. There is no central user account, login directory, or tenant switcher.

Initially support email/password and email OTP. Dynamic custom domains make provider callback URLs difficult to manage, so social login remains disabled until a central OAuth broker is designed.

## Tenant administration and lifecycle

- Only members with `organizationType = OWNER` and Better Auth role `owner` may manage custom domains, subscription settings, and tenant termination.
- These sensitive actions call a narrow, server-only control-plane service. Tenant feature code does not receive general control-plane database access.
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

## Verification

- Prove isolation with two tenant databases containing overlapping user, organization, client, and record IDs.
- Test hostname normalization, unknown hosts, spoofed forwarded headers, and trusted-proxy behavior.
- Test canonical redirects and ensure authentication cookies are never created on aliases.
- Test database-pool limits, idle eviction, application shutdown, and unavailable tenant databases.
- Test duplicate slugs, expired verification, failed provisioning, failed migrations, and idempotent retry.
- Test custom-domain validation, certificate failure, invalidated primary domains, and fallback to the standard subdomain.
- Test `READ_ONLY`, restoration within 30 days, and audited deletion after the retention period.
- Run the same package contract and feature suites against fixed-database and hostname-resolved database providers.

## Assumptions

- PostgreSQL remains the only database provider.
- The first shared deployment targets approximately 10-100 tenants.
- One runtime release serves all shared tenants.
- Every tenant database contains exactly one `OWNER` organization.
- Clients and all business data remain tenant-local.
- Cross-tenant reporting and central tenant-data access are out of scope.
- Dedicated deployment per tenant is not part of the first SaaS implementation.

