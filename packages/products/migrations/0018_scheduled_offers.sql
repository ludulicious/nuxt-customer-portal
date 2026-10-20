CREATE TABLE products.offer (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products.product(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_free boolean NOT NULL DEFAULT false,
  CONSTRAINT offer_period_valid CHECK (starts_at < ends_at)
);
CREATE INDEX offer_product ON products.offer(product_id);
ALTER TABLE products.price ADD COLUMN offer_id text REFERENCES products.offer(id);
DROP INDEX products.price_active_currency;
CREATE UNIQUE INDEX price_active_currency ON products.price(product_id, currency) WHERE active AND offer_id IS NULL;
CREATE UNIQUE INDEX price_active_offer_currency ON products.price(offer_id, currency) WHERE active AND offer_id IS NOT NULL;
