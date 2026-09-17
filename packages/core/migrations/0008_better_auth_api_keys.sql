CREATE TABLE IF NOT EXISTS "apikey" (
  "id" text PRIMARY KEY NOT NULL,
  "config_id" text DEFAULT 'default' NOT NULL,
  "name" text,
  "start" text,
  "reference_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "prefix" text,
  "key" text NOT NULL,
  "refill_interval" integer,
  "refill_amount" integer,
  "last_refill_at" timestamp,
  "enabled" boolean DEFAULT true NOT NULL,
  "rate_limit_enabled" boolean DEFAULT true NOT NULL,
  "rate_limit_time_window" integer,
  "rate_limit_max" integer,
  "request_count" integer DEFAULT 0 NOT NULL,
  "remaining" integer,
  "last_request" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "permissions" text,
  "metadata" text
);
CREATE INDEX IF NOT EXISTS "apikey_config_id_idx" ON "apikey" ("config_id");
CREATE INDEX IF NOT EXISTS "apikey_reference_id_idx" ON "apikey" ("reference_id");
CREATE UNIQUE INDEX IF NOT EXISTS "apikey_key_uidx" ON "apikey" ("key");
