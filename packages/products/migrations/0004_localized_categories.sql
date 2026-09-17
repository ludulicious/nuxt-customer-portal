ALTER TABLE products.category ADD COLUMN code text;
ALTER TABLE products.category ADD COLUMN content jsonb NOT NULL DEFAULT '{}'::jsonb;
WITH codes AS (
 SELECT id, coalesce(nullif(trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')),''),'category') AS base,
 row_number() OVER (ORDER BY id) AS position FROM products.category
)
UPDATE products.category c SET code=left(codes.base,60)||'-'||codes.position,
 content=jsonb_build_object('en',jsonb_build_object('name',c.name,'description',''),'nl',jsonb_build_object('name',c.name,'description','')) FROM codes WHERE c.id=codes.id;
UPDATE products.product p SET data=jsonb_set(p.data,'{category}',to_jsonb(c.code)) FROM products.category c WHERE c.store_id=p.store_id AND p.data->>'category'=c.name;
ALTER TABLE products.category ALTER COLUMN code SET NOT NULL;
DROP INDEX products.category_store_name;
CREATE UNIQUE INDEX category_store_code ON products.category(store_id,lower(code));
