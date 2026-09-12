ALTER TABLE products.store
  ADD COLUMN checkout_appearance jsonb NOT NULL DEFAULT '{}'::jsonb;
