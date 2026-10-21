CREATE TABLE "products"."page_text" (
  "store_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE CASCADE,
  "page" text NOT NULL,
  "locale" text NOT NULL,
  "copy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("store_id", "page", "locale"),
  CONSTRAINT "page_text_page" CHECK ("page" IN ('order-details')),
  CONSTRAINT "page_text_locale" CHECK ("locale" IN ('en', 'nl')),
  CONSTRAINT "page_text_copy_object" CHECK (jsonb_typeof("copy") = 'object')
);
