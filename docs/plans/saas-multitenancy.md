# SaaS Dedicated-Instance Architecture

## Status

This document replaces the abandoned shared-runtime SaaS design. The
`saas-app` branch is historical research only. It must not be merged,
cherry-picked, or used as a source of implementation files.

The Customer Portal remains the primary product. SaaS is an independent control
plane that deploys ordinary Customer Portal instances; it is not a runtime mode
of the portal.

## Architecture invariants

- One deployed Customer Portal instance represents one SaaS customer.
- Each instance has one PostgreSQL database, one database role, one auth secret,
  one public origin, and its normal portal configuration.
- Platform users and sessions exist only in the control plane. Portal users and
  sessions exist only in their portal instance.
- The platform never injects request, database, auth, lifecycle, or workspace
  context into Customer Portal code.
- Customer Portal APIs, packages, permissions, and data access remain unaware of
  the control plane and Coolify.
- A portal release is an immutable image identified by a tag and digest. An
  instance upgrade is an explicit change from one digest to another.
- The control plane cannot read portal business data and receives no portal
  session or management API.

## Repository boundary

This repository owns the Customer Portal and publishes the deployable portal
image. It may contain generic deployment documentation, health checks,
migrations, and release automation useful to any portal operator. It must not
contain the SaaS control-plane application or Coolify client code.

The private control-plane repository owns its own Nuxt application, Better Auth
installation, PostgreSQL schema, migrations, secrets, background jobs, tests,
and deployment. It must not import Customer Portal layers or packages.

The boundary is enforced in CI by `pnpm verify:saas-boundary`.

## Portal release contract

The `apps/demo-apex/Dockerfile` image is built from a release tag and also tagged
with the source commit SHA. The registry digest recorded after publishing is the
only value used to provision or upgrade customer instances.

At startup the existing entrypoint validates portal configuration, reports
migration status, applies the configured package migrations, reports status
again, and starts Nuxt. `/api/health` remains the deployment health endpoint.

Each instance receives only ordinary portal environment configuration:

- `DATABASE_URL` for its dedicated database and least-privilege role;
- a unique `BETTER_AUTH_SECRET`;
- matching `PUBLIC_URL` and `BETTER_AUTH_URL` values;
- the verified customer email in `ADMIN_EMAILS`;
- regular registration, email, OAuth, module, and branding settings.

The platform does not pass a platform token, instance ID, lifecycle state,
callback URL, shared cookie configuration, or provisioning credential to the
portal.

## Independent control plane

The first release provides verified self-service signup without billing and
allows one instance per platform account. The platform stores only platform
users, instance ownership and desired configuration, external resource IDs,
image versions, provisioning attempts, sanitized failures, and audit history.
It never stores portal users or business records.

The lifecycle is `PENDING_EMAIL`, `QUEUED`, `PROVISIONING`, `ACTIVE`, `ERROR`,
`SUSPENDED`, and `DELETION_SCHEDULED`. Instance creation and retry are
owner-scoped; suspend, upgrade, and deletion scheduling are operator-only.

Infrastructure work runs in a resumable background job:

1. Verify the owner and atomically reserve the slug.
2. Create a unique PostgreSQL role and database on the managed shared server.
3. Generate the portal auth secret and ordinary environment configuration.
4. Create a Coolify application pinned to the selected portal image digest.
5. Set its domain and environment variables, then request deployment.
6. Poll the Coolify deployment and the portal health endpoint with bounded
   retries.
7. Mark the instance active and show or email its normal portal signup URL.

Every step uses the platform instance ID as its idempotency/correlation key and
discovers an existing resource before creating one. Partial resources are kept
for retry. Deletion is a separate, explicit, audited workflow.

Provisioning is expressed through `DatabaseProvider` and `DeploymentProvider`
contracts. V1 implements a shared-server PostgreSQL provider and Coolify. A
future BYOD provider must plug into the same orchestration without changing the
portal.

The verified owner becomes the first portal administrator through the existing
`ADMIN_EMAILS` behavior and completes the unchanged portal signup flow. There is
no password or session handoff.

## Verification

- Run the existing portal tests, lint, typecheck, build, package checks, and
  authentication end-to-end coverage on every portal change.
- Build one image and run two instances with different databases, origins,
  secrets, and administrator emails; sessions and records must not cross.
- Reject control-plane imports, SaaS runtime environment variables, and
  request-scoped auth/database infrastructure from portal runtime paths.
- In the control-plane repository, test ownership, slug reservation, lifecycle
  transitions, redaction, rate limits, adapter contracts, idempotent retries,
  PostgreSQL isolation, and Coolify failure recovery.

## V1 exclusions

Billing, shared login, session handoff, custom-domain self-service, BYOD,
cross-instance reporting, and central access to portal data are deliberately out
of scope.
