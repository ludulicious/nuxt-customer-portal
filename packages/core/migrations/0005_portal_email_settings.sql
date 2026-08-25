CREATE TABLE "portal_email_settings" (
  "id" boolean PRIMARY KEY DEFAULT true NOT NULL CHECK ("id" = true),
  "provider" text DEFAULT 'RESEND' NOT NULL,
  "encrypted_api_key" text,
  "key_fingerprint" text,
  "key_last_four" text,
  "from_name" text,
  "from_email" text,
  "default_locale" text DEFAULT 'en' NOT NULL,
  "html_template" text,
  "text_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "configured_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
