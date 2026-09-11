ALTER TABLE products.product ADD COLUMN category_id text;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM products.product p WHERE coalesce(p.data->>'category','')<>'' AND NOT EXISTS(SELECT 1 FROM products.category c WHERE c.store_id=p.store_id AND c.code=p.data->>'category')) THEN
 RAISE EXCEPTION 'Cannot migrate unresolved product categories';
 END IF;
END $$;
UPDATE products.product p SET category_id=c.id FROM products.category c WHERE c.store_id=p.store_id AND c.code=p.data->>'category';
UPDATE products.product SET data=data-'category';
CREATE UNIQUE INDEX category_store_id ON products.category(store_id,id);
ALTER TABLE products.product ADD CONSTRAINT product_category_fk FOREIGN KEY(store_id,category_id) REFERENCES products.category(store_id,id) ON DELETE RESTRICT;
CREATE INDEX product_category_id ON products.product(category_id);
