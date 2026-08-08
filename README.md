# Customer Portal website

The marketing and documentation site for [Customer Portal](https://github.com/ludulicious/customer-portal), an extensible customer portal built with Nuxt. The product source is public and is intended for an open-source release, but its explicit license is still pending; see [Compatibility and releases](https://portalnuxt.com/reference/compatibility-and-releases).

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

The site is prerendered and can be deployed to any platform supported by Nuxt/Nitro.

## Source verification

Every documentation page shows the immutable Customer Portal commit against which its behavior was reviewed. Defaults live in `shared/documentation.ts` and can be overridden with the public runtime variables in `.env.example`.

When documentation moves to a newer product revision, update `NUXT_PUBLIC_PRODUCT_SOURCE_COMMIT`, review affected guides and references, then run the complete verification suite. Documentation reports open in this repository with the page URL and verified Customer Portal revision prefilled; product bugs and module proposals remain in the Customer Portal repository.
