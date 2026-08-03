CREATE TABLE "organization_email_credential" (
  "organization_id" text PRIMARY KEY REFERENCES "organization"("id") ON DELETE cascade,
  "provider" text DEFAULT 'RESEND' NOT NULL,
  "api_key" text,
  "key_fingerprint" text,
  "key_last_four" text,
  "configured_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "removed_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "removed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
