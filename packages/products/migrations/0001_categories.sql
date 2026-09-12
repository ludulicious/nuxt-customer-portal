CREATE TABLE products.category (
  id text PRIMARY KEY,
  store_id text NOT NULL REFERENCES public.organization(id),
  name text NOT NULL,
  CONSTRAINT category_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX category_store_name ON products.category(store_id, lower(name));
INSERT INTO products.category(id,store_id,name)
SELECT md5(store_id || ':' || lower(btrim(data->>'category'))), store_id, min(btrim(data->>'category'))
FROM products.product WHERE btrim(coalesce(data->>'category','')) <> ''
GROUP BY store_id, lower(btrim(data->>'category'));
UPDATE products.product p SET data=jsonb_set(p.data,'{category}',to_jsonb(c.name))
FROM products.category c WHERE c.store_id=p.store_id AND lower(btrim(p.data->>'category'))=lower(c.name);
