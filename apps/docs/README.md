# Customer Portal website

The documentation application for [Nuxt Customer Portal](https://github.com/ludulicious/nuxt-customer-portal), an MIT-licensed SaaS portal application with private source modules. It is maintained in the canonical monorepo under `apps/docs` and served from [nuxt-customer-portal.com](https://nuxt-customer-portal.com).

The site covers:

- evaluating and installing Customer Portal;
- understanding portal core and the feature registry;
- completing a first workflow with timesheets, approvals, invoicing, and client access;
- studying Service Requests as an optional example extension;
- looking up configuration, extension contracts, deployed APIs, and compatibility expectations;
- building a business module as a Nuxt layer;
- contributing code and documentation.

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Editing documentation with Nuxt Studio

The development server includes [Nuxt Studio](https://nuxt.studio/). Open the
site and use the floating Studio button in the bottom-left corner, navigate to
`http://localhost:3000/_studio`, or press `Cmd/Ctrl + .`.

In development mode, Studio edits the Markdown files under `content/` directly
and does not require authentication. Review and commit those file changes with
the normal Git workflow.

Publishing from a deployed Studio requires a GitHub OAuth app. Configure its
callback URL as
`https://nuxt-customer-portal.com/__nuxt_studio/auth/github`, then set
`NUXT_STUDIO_AUTH_GITHUB_CLIENT_ID` and
`NUXT_STUDIO_AUTH_GITHUB_CLIENT_SECRET` in the deployment environment. See
`.env.example` for the optional moderator allowlist.

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

The production build uses the Nitro Node server. Marketing and documentation pages are prerendered for fast delivery, while raw Markdown, `llms.txt`, sitemap, robots, social images, and MCP endpoints remain available through the same deployment. Use a Nuxt/Nitro-compatible Node host rather than publishing only the generated static directory.

The Docker deployment builds `apps/docs` independently and uses its own `pnpm-lock.yaml`. After changing the docs dependencies, update both the workspace lockfile and this standalone lockfile. From the repository root:

```bash
pnpm install --lockfile-only
pnpm --dir apps/docs install --lockfile-only --ignore-workspace --ignore-scripts
docker build --tag customer-portal-docs:local apps/docs
```

Keep `--frozen-lockfile` enabled in the Dockerfile. Build this image manually when changing docs dependencies or deployment behavior; the standalone docs image is not a gate for SaaS portal Docker publication.

## Source verification

Every documentation page shows its Customer Portal source reference. Development documentation follows master; release deployments can pin an immutable commit. Defaults live in `shared/documentation.ts` and can be overridden with the public runtime variables in `.env.example`.

When documentation moves to a newer product revision, update `NUXT_PUBLIC_PRODUCT_SOURCE_COMMIT`, review affected guides and references, then run the complete verification suite. Documentation reports open in this repository with the page URL and verified Customer Portal revision prefilled; product bugs and module proposals remain in the Customer Portal repository.

## Release checklist

1. Confirm the source release and Docker workflow verified the intended product version and commit. Record its image digest.
2. Run pnpm test:docs, pnpm --filter @nuxt-customer-portal/docs typecheck, and pnpm test:e2e:docs from the repository root.
3. Verify the matching image in a disposable deployment with PostgreSQL: startup, migrations, owner login, client creation, time entry, approvals and invoicing.
4. Review source/Docker instructions and source references, then deploy the matching documentation. Set NUXT_PUBLIC_PRODUCT_SOURCE_COMMIT to the release commit when pinning a release-specific site.
5. Check the docs hosting branch and deployment settings before merging, and verify public links before announcing availability.

Installation documentation supports source checkout and Docker only. Modules remain private workspaces; there is no npm release checklist or generated installer.
