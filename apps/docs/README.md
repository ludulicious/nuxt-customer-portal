# Customer Portal website

The documentation application for [Nuxt Customer Portal](https://github.com/ludulicious/customer-portal), an MIT-licensed collection of reusable Nuxt layers. It is maintained in the canonical monorepo under `apps/docs` and served from [nuxt-customer-portal.com](https://nuxt-customer-portal.com).

The site covers:

- evaluating and installing Customer Portal;
- understanding portal core and the feature registry;
- using the timesheets, invoices, and service-request modules;
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
