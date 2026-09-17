ALTER TABLE products.store
  ADD COLUMN stripe_secret_key text,
  ADD COLUMN stripe_webhook_secret text,
  ADD COLUMN stripe_tested_at timestamptz;
