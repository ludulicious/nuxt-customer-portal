# SaaS host

`apps/saas` serves the platform control plane and all tenant Customer Portal domains from one Nuxt runtime. The platform and every tenant use separate PostgreSQL databases and separate Better Auth instances.

## Bootstrap

1. Copy `.env.example`. `DATABASE_URL` and `BETTER_AUTH_SECRET` configure the platform itself; configure the hosts and provider adapters separately.
2. Apply platform authentication and control-plane migrations with `pnpm platform:migrate`.
3. Add the platform administrator email addresses to `ADMIN_EMAILS`. Those users can register or sign in through the platform portal, including with a configured social provider.
4. Start the host with `pnpm dev` or the production container.

Platform administrator access is granted exclusively through the case-insensitive `ADMIN_EMAILS` allowlist. No bootstrap password or separate seeded administrator account is required.

Tenant database credentials and tenant Better Auth secrets are generated or received during onboarding and stored through the secret-store adapter. They are never configured through the SaaS app's environment or reused between tenants.

## Provider adapter HTTP contracts

- `PUT {SAAS_SECRET_STORE_ENDPOINT}/tenant-databases/{tenantId}` accepts `{ "value": "postgresql://..." }` and returns `{ "reference": "..." }`.
- `GET {SAAS_SECRET_STORE_ENDPOINT}/tenant-databases/{tenantId}` returns `{ "value": "postgresql://..." }`.
- `DELETE {SAAS_SECRET_STORE_ENDPOINT}/tenant-databases/{tenantId}` removes the credential.
- `PUT {SAAS_SECRET_STORE_ENDPOINT}/tenant-auth-secrets/{tenantId}` stores a generated tenant-specific Better Auth secret and returns `{ "reference": "..." }`.
- `GET {SAAS_SECRET_STORE_ENDPOINT}/tenant-auth-secrets/{tenantId}` returns the tenant-specific Better Auth secret as `{ "value": "..." }`.
- `DELETE {SAAS_SECRET_STORE_ENDPOINT}/tenant-auth-secrets/{tenantId}` removes that secret.
- `POST {SAAS_DATABASE_PROVIDER_ENDPOINT}/databases` accepts `{ "tenantId": "...", "slug": "..." }` and returns `{ "url": "postgresql://...", "resourceId": "..." }`.

All adapter requests include `Authorization: Bearer {SAAS_PROVIDER_ADAPTER_TOKEN}` when configured. Raw connection strings are held only for the duration of provisioning or tenant-pool creation and are not stored in the control-plane database.
