ALTER TABLE products.store ADD COLUMN markdown_style jsonb NOT NULL DEFAULT '{}'::jsonb;
