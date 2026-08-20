DO $$
BEGIN
  IF to_regclass('platform_tenant') IS NOT NULL AND to_regclass('platform_workspace') IS NULL THEN
    ALTER TABLE platform_tenant RENAME TO platform_workspace;
  END IF;

  IF to_regclass('platform_domain') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_domain' AND column_name = 'tenant_id') THEN
    ALTER TABLE platform_domain RENAME COLUMN tenant_id TO workspace_id;
  END IF;

  IF to_regclass('platform_onboarding') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_onboarding' AND column_name = 'tenant_id') THEN
    ALTER TABLE platform_onboarding RENAME COLUMN tenant_id TO workspace_id;
  END IF;

  IF to_regclass('platform_lifecycle_event') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_lifecycle_event' AND column_name = 'tenant_id') THEN
    ALTER TABLE platform_lifecycle_event RENAME COLUMN tenant_id TO workspace_id;
  END IF;

  IF to_regclass('platform_domain_one_canonical_per_tenant') IS NOT NULL
    AND to_regclass('platform_domain_one_canonical_per_workspace') IS NULL THEN
    ALTER INDEX platform_domain_one_canonical_per_tenant RENAME TO platform_domain_one_canonical_per_workspace;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS platform_workspace (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  lifecycle_status text NOT NULL,
  canonical_domain text NOT NULL UNIQUE,
  database_secret_ref text NOT NULL,
  auth_secret_ref text NOT NULL,
  database_mode text NOT NULL,
  database_provider_resource_id text,
  selected_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  organization_id text UNIQUE REFERENCES organization(id) ON DELETE SET NULL,
  schema_version text NOT NULL,
  application_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_workspace
  ADD COLUMN IF NOT EXISTS organization_id text UNIQUE REFERENCES organization(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS platform_domain (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES platform_workspace(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  verified_at timestamptz,
  is_canonical boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_domain_one_canonical_per_workspace
  ON platform_domain (workspace_id) WHERE is_canonical;

CREATE TABLE IF NOT EXISTS platform_onboarding (
  id text PRIMARY KEY,
  workspace_id text REFERENCES platform_workspace(id) ON DELETE SET NULL,
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
  workspace_id text NOT NULL REFERENCES platform_workspace(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
