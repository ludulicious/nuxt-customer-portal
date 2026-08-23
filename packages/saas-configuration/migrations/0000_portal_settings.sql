CREATE SCHEMA IF NOT EXISTS "saas_configuration";

CREATE TABLE "saas_configuration"."portal_settings" (
  "id" boolean PRIMARY KEY DEFAULT true NOT NULL CHECK ("id" = true),
  "settings" jsonb NOT NULL,
  "onboarding_step" text DEFAULT 'branding' NOT NULL,
  "completed_at" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
