ALTER TABLE "products"."page_text" ADD COLUMN "product_slug" text DEFAULT '' NOT NULL;
ALTER TABLE "products"."page_text" DROP CONSTRAINT "page_text_pkey";
ALTER TABLE "products"."page_text" ADD PRIMARY KEY ("store_id", "page", "locale", "product_slug");
