ALTER TABLE products.orders ADD COLUMN download_token text NOT NULL
  DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
ALTER TABLE products.orders ADD CONSTRAINT orders_download_token_unique UNIQUE (download_token);
CREATE TABLE products.download (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES products.orders(id) ON DELETE CASCADE,
  order_line_id text NOT NULL REFERENCES products.order_line(id) ON DELETE CASCADE,
  asset_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('public', 'portal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX download_order ON products.download(order_id, created_at);
