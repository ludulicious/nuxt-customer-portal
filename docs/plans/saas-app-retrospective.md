# `saas-app` Retrospective

## Classification

The `saas-app` branch is an abandoned prototype and historical evidence only.
The greenfield control plane has no code lineage from it: no merges,
cherry-picks, copied files, or runtime compatibility requirements.

## What the prototype taught us

The prototype attempted to serve the platform domain and many portal domains
from one Nuxt runtime. That required resolving a workspace from every hostname
before authentication and selecting a database and Better Auth instance per
request. Shared packages then needed request-scoped proxies and platform-aware
fallbacks even though fixed deployments had no need for them.

Authentication became the sharpest boundary problem. Platform sessions,
workspace sessions, SSR cookie forwarding, callback origins, alias domains, and
per-workspace secrets all affected shared portal auth code. Fixes for the host
therefore changed the behavior of ordinary Customer Portal deployments.

Platform lifecycle and module concepts also reached feature registries,
permissions, navigation, user state, and portal APIs. This reversed the desired
dependency direction: the Customer Portal was being adapted to the hosting
platform instead of the platform operating stable portal releases.

## Decisions carried forward

- Keep platform identity, lifecycle, audit, and provisioning data separate from
  portal users and business data.
- Use dedicated databases and unique auth secrets.
- Make provisioning idempotent, resumable, and observable.
- Pin deployments to immutable releases and retain external resource IDs.
- Keep secrets out of logs and expose sanitized failures.

## Decisions rejected

- One runtime serving multiple customer portals.
- Hostname-selected auth or database instances inside portal request handling.
- Platform-to-portal session or password handoff.
- Platform permissions, lifecycle state, or provisioning APIs in shared portal
  packages.
- Treating Customer Portal as a library embedded by the control plane.

The durable rule is simple: SaaS may automate deployment of Customer Portal,
but it must not redefine how Customer Portal runs.
