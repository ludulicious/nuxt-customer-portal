# Contributing to the Customer Portal website

This repository contains the marketing and documentation site for [Customer Portal](https://github.com/ludulicious/customer-portal).

Start with the rendered [contribution guide](https://nuxt-customer-portal.com/contributing). Documentation changes should follow the [writing guide](https://nuxt-customer-portal.com/contributing/documentation); product behavior must be verified against the current Customer Portal source before it is described here.

## Local workflow

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Before opening a pull request, run:

```bash
pnpm test:docs
pnpm lint
pnpm typecheck
pnpm test:e2e
```

`test:e2e` creates the production build before running Playwright. Each maintained content page requires `title`, `description`, and a `githubPath` matching its source path. Keep internal links valid, update the machine-readable documentation catalog, and review the rendered page at desktop and mobile widths.

The product verification pin lives in `shared/documentation.ts`. When moving it to a newer Customer Portal commit, review the source diff and update every affected guide, reference, and limitation in the same pull request.

Use one pull request for one coherent improvement. Explain the source used to verify product behavior and include screenshots when layout changes.

## Security

Do not disclose vulnerabilities or secrets in public issues or pull requests. Follow [SECURITY.md](SECURITY.md).
