ALTER TABLE products.store ADD COLUMN media_variants jsonb;
ALTER TABLE products.store ADD COLUMN media_variants_revision integer NOT NULL DEFAULT 1;
UPDATE products.store SET media_variants=jsonb_build_array(
  jsonb_build_object('key','thumbnail','label','Thumbnail','width',COALESCE((image_policy->'thumbnail'->>'width')::integer,400),'height',COALESCE((image_policy->'thumbnail'->>'height')::integer,400)),
  jsonb_build_object('key','gallery','label','Gallery','width',COALESCE((image_policy->'gallery'->>'width')::integer,800),'height',COALESCE((image_policy->'gallery'->>'height')::integer,1000)),
  jsonb_build_object('key','detail','label','Detail','width',COALESCE((image_policy->'detail'->>'width')::integer,1200),'height',COALESCE((image_policy->'detail'->>'height')::integer,900))
);
ALTER TABLE products.store ALTER COLUMN media_variants SET DEFAULT '[{"key":"thumbnail","label":"Thumbnail","width":400,"height":400},{"key":"gallery","label":"Gallery","width":800,"height":1000},{"key":"detail","label":"Detail","width":1200,"height":900}]'::jsonb;
ALTER TABLE products.store ALTER COLUMN media_variants SET NOT NULL;
ALTER TABLE products.media_file ADD COLUMN variant_key text;
ALTER TABLE products.media_file DROP CONSTRAINT media_file_role_check;
ALTER TABLE products.media_file DROP CONSTRAINT media_file_upload_id_role_key;
ALTER TABLE products.media_file ADD CONSTRAINT media_file_role_check CHECK(role IN ('original','image','thumbnail','variant','rendition'));
ALTER TABLE products.media_file ADD CONSTRAINT media_file_variant_key_check CHECK((role IN ('variant','rendition')) = (variant_key IS NOT NULL));
CREATE UNIQUE INDEX media_file_upload_role_variant ON products.media_file(upload_id,role,COALESCE(variant_key,''));
ALTER TABLE products.media ADD CONSTRAINT media_store_id_unique UNIQUE(store_id,id);
CREATE TABLE products.media_variant (
  store_id text NOT NULL,
  media_id text NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  mode text NOT NULL CHECK(mode IN ('automatic','custom')),
  width integer NOT NULL,
  height integer NOT NULL,
  file_id text NOT NULL,
  source_file_id text NOT NULL,
  PRIMARY KEY(store_id,media_id,key),
  FOREIGN KEY(store_id,media_id) REFERENCES products.media(store_id,id) ON DELETE CASCADE,
  FOREIGN KEY(store_id,file_id) REFERENCES products.media_file(store_id,id),
  FOREIGN KEY(store_id,source_file_id) REFERENCES products.media_file(store_id,id)
);
CREATE INDEX media_variant_file ON products.media_variant(file_id);
CREATE INDEX media_variant_source ON products.media_variant(source_file_id);
INSERT INTO products.media_variant(store_id,media_id,key,label,mode,width,height,file_id,source_file_id)
SELECT m.store_id,m.id,'thumbnail','Thumbnail','custom',f.width,f.height,f.id,f.id FROM products.media m JOIN products.media_file f ON f.id=m.thumbnail_file_id AND f.store_id=m.store_id WHERE f.ready;
