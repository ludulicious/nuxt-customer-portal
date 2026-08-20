CREATE TABLE IF NOT EXISTS platform_tenant (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  lifecycle_status text NOT NULL,
  canonical_domain text NOT NULL UNIQUE,
  database_secret_ref text NOT NULL,
  auth_secret_ref text NOT NULL,
  database_mode text NOT NULL,
  database_provider_resource_id text,
  selected_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version text NOT NULL,
  application_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_domain (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES platform_tenant(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  verified_at timestamptz,
  is_canonical boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_domain_one_canonical_per_tenant
  ON platform_domain (tenant_id) WHERE is_canonical;

CREATE TABLE IF NOT EXISTS platform_onboarding (
  id text PRIMARY KEY,
  tenant_id text REFERENCES platform_tenant(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  slug text NOT NULL,
  admin_email text NOT NULL,
  selected_modules jsonb NOT NULL,
  database_mode text NOT NULL,
  status text NOT NULL,
  provisioning_step text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_lifecycle_event (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES platform_tenant(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
