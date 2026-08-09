# Customer Portal

A modular Nuxt 4 customer portal with authentication, organizations, PostgreSQL, and independently owned feature layers. The production-oriented timesheets layer includes approvals, reporting, invoicing, and document workflows.

- [Documentation](https://portalnuxt.com)
- [Installation guide](https://portalnuxt.com/getting-started/installation)
- [Architecture](https://portalnuxt.com/architecture/overview)
- [Modules](https://portalnuxt.com/modules)
- [Contributing](https://portalnuxt.com/contributing)

> The source is public, but this repository does not yet contain an explicit software license. Review the [current licensing status](https://portalnuxt.com/reference/compatibility-and-releases) before using, modifying, or distributing the code.

## Architecture documentation

- [Portal feature layers](docs/LAYERS.md): create, register, enable, disable, test, and remove reusable feature layers.
- [Service-request layer](layers/service-requests/README.md): reference implementation and feature-specific lifecycle notes.
- [Timesheets and invoices](https://portalnuxt.com/modules/timesheets-invoices): production module boundaries, roles, workflows, and limitations.

## Quick start (scaffold from GitHub template)

Use Nuxt’s initializer (powered by `unjs/giget`) to create a new project from this repository:

```bash
npx nuxi init -t github:ludulicious/customer-portal my-customer-portal
```

If you prefer the `create-nuxt` wrapper:

```bash
npm create nuxt@latest -- -t github:ludulicious/customer-portal my-customer-portal
```

Customer Portal does not currently publish versioned releases. For a reproducible evaluation, pin a commit and record it with your deployment.

```bash
npx nuxi init -t github:ludulicious/customer-portal#<commit> my-customer-portal
```

## Setup

Install dependencies:

```bash
pnpm install
```

Create your local env file from the example:

```bash
# macOS / Linux
cp .env.example .env

# Windows (cmd)
copy .env.example .env
```

At minimum, configure `DATABASE_URL`, `PUBLIC_URL`, `BETTER_AUTH_URL`, and a stable, high-entropy `BETTER_AUTH_SECRET`. Optional email and OAuth providers can remain disabled until they are configured. See the [configuration reference](https://portalnuxt.com/reference/configuration) for the complete environment contract.

Apply the database migrations:

```bash
pnpm exec drizzle-kit migrate
```

## Development

Start the dev server:

```bash
pnpm dev
```

By default this repo runs on `http://localhost:3051` (see `nuxt.config.ts` → `devServer.port`).

## Production

Build:

```bash
pnpm build
```

Preview:

```bash
pnpm preview
```

## Docker

Build the image:

```bash
docker build -t customer-portal .
```

Run with a production-configured environment file:

```bash
docker run --rm -p 3000:3000 --env-file .env customer-portal
```

Set `PUBLIC_URL` and `BETTER_AUTH_URL` in that file to the externally reachable deployment URL, and keep the authentication secret out of the image. Follow the [deployment guide](https://portalnuxt.com/getting-started/deployment) before exposing an instance publicly.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the structured [issue forms](https://github.com/ludulicious/customer-portal/issues/new/choose) for bugs, questions, feature requests, and reusable layer proposals.

Do not disclose vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) for private reporting guidance.
