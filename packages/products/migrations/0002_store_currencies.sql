ALTER TABLE products.store ADD COLUMN currencies text[] NOT NULL DEFAULT ARRAY['EUR']::text[];
UPDATE products.store s SET currencies = ARRAY(SELECT DISTINCT currency FROM products.price pr JOIN products.product p ON p.id=pr.product_id WHERE p.store_id=s.organization_id AND pr.active ORDER BY currency) WHERE EXISTS(SELECT 1 FROM products.price pr JOIN products.product p ON p.id=pr.product_id WHERE p.store_id=s.organization_id AND pr.active);
ALTER TABLE products.store ADD CONSTRAINT store_currencies_nonempty CHECK(cardinality(currencies)>0);
ALTER TABLE products.price DROP CONSTRAINT price_amount_check;
ALTER TABLE products.price ADD CONSTRAINT price_amount_check CHECK(amount >= 0);
