ALTER TABLE products.store ADD COLUMN currency_tax_behavior jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE products.store s SET currency_tax_behavior = (
  SELECT jsonb_object_agg(currency, COALESCE((
    SELECT pr.tax_behavior FROM products.price pr
    JOIN products.product p ON p.id = pr.product_id
    WHERE p.store_id = s.organization_id AND pr.currency = currencies.currency AND pr.active
    ORDER BY p.updated_at DESC, pr.id DESC LIMIT 1
  ), 'inclusive')) FROM unnest(s.currencies) AS currencies(currency)
);
WITH changed AS (
  UPDATE products.price pr SET active=false
  FROM products.product p, products.store s
  WHERE p.id=pr.product_id AND p.store_id=s.organization_id AND pr.active
    AND s.currency_tax_behavior ? pr.currency
    AND pr.tax_behavior<>s.currency_tax_behavior->>pr.currency
  RETURNING pr.product_id, pr.currency, pr.amount, s.currency_tax_behavior->>pr.currency AS tax_behavior
)
INSERT INTO products.price(id,product_id,currency,amount,tax_behavior)
SELECT gen_random_uuid()::text,product_id,currency,amount,tax_behavior FROM changed;
