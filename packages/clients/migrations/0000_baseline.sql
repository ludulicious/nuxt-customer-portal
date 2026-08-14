CREATE SCHEMA IF NOT EXISTS "clients";

CREATE TABLE IF NOT EXISTS "clients"."client_profile" (
  "organization_id" text PRIMARY KEY REFERENCES "organization"("id") ON DELETE restrict,
  "official_name" text NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "registration_number" text,
  "vat_number" text,
  "invoice_email" text,
  "preferred_locale" text DEFAULT 'nl' NOT NULL,
  "archived_at" timestamp,
  "archived_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "client_profile_archived_idx" ON "clients"."client_profile" ("archived_at");

CREATE TABLE IF NOT EXISTS "clients"."client_module" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE restrict,
  "module_id" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "enabled_at" timestamp DEFAULT now() NOT NULL,
  "enabled_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "disabled_at" timestamp,
  "disabled_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_module_org_module_uidx" ON "clients"."client_module" ("organization_id", "module_id");
CREATE INDEX IF NOT EXISTS "client_module_org_enabled_idx" ON "clients"."client_module" ("organization_id", "enabled");
