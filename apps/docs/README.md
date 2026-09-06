# Customer Portal website

The documentation application for [Nuxt Customer Portal](https://github.com/ludulicious/nuxt-customer-portal), an MIT-licensed collection of reusable Nuxt layers. It is maintained in the canonical monorepo under `apps/docs` and served from [nuxt-customer-portal.com](https://nuxt-customer-portal.com).

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

## Source verification

Every documentation page shows the immutable Customer Portal commit against which its behavior was reviewed. Defaults live in `shared/documentation.ts` and can be overridden with the public runtime variables in `.env.example`.

When documentation moves to a newer product revision, update `NUXT_PUBLIC_PRODUCT_SOURCE_COMMIT`, review affected guides and references, then run the complete verification suite. Documentation reports open in this repository with the page URL and verified Customer Portal revision prefilled; product bugs and module proposals remain in the Customer Portal repository.

## Release checklist

Prepare documentation changes on a branch. Publish the matching npm packages and verify the registry installation before deploying the updated installation guide or announcing the release.

For the first npm publication, sign in with `npm login` using an account that can
publish under `@nuxt-customer-portal`. Run `pnpm release-packages --dry-run`, then
`pnpm release-packages` from the reviewed release commit. This packs with pnpm and
publishes the resulting tarballs with npm. It skips versions already published,
so a partial publication can be resumed. Configure trusted publishing for each
package after this initial release; subsequent GitHub releases can then publish
without a local npm login. The workflow uses `release-npm-packages.yml`, owner
`ludulicious`, repository `nuxt-customer-portal`, and permission to publish directly.

1. Confirm the intended package version in `content/1.getting-started/2.installation.md` matches every public package it installs. The current guide uses the published `0.3.0` release, including the kit and the configurable portal package.
2. Run the docs checks below and `pnpm pack:check` from the repository root. Use `pnpm pack:consumer:pnpm` (and the other supported package-manager consumer checks) to verify tarballs outside workspace links. These checks do not replace the manual workflow.
3. Follow the installation guide in an empty directory against locally packed packages and a disposable PostgreSQL database. Generate the project with `init` and use exactly its declared dependencies: broad consumer checks that install every public package can hide missing dependency declarations. Verify both Docker and an existing empty PostgreSQL database, cancellation, and resuming setup. Check the layout, owner login, client creation, time entry, approvals, and an invoice. Test client access using a separate client account and a test email recipient.
4. Publish the package release using the repository's release process. Verify that all required package versions and their dependencies are available from npm.
5. Repeat the exact registry installation commands from the guide in a fresh directory without workspace links or tarball overrides. Record the package versions and any setup corrections before publishing the docs.
6. Check the deployment host's branch and auto-deploy settings before merging. The repository's GitHub workflows cover CI, npm publication, and portal images; they do not establish the docs host's deployment behavior. Keep this documentation branch unpublished until the registry verification passes.
7. Deploy the matching docs and README, verify the public links, and then announce the release.

Run from the repository root:

```bash
pnpm test:docs
pnpm --filter @nuxt-customer-portal/docs lint
pnpm --filter @nuxt-customer-portal/docs typecheck
pnpm test:e2e:docs
```

The content tests check metadata, source links, internal routes, and the MCP catalog. Playwright builds the documentation and checks its rendered journeys and accessibility. Review new or changed pages at desktop and mobile widths as well.
