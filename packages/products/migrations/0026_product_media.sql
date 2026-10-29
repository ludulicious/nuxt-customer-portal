ALTER TABLE products.asset ADD COLUMN media_id text REFERENCES products.media(id) ON DELETE CASCADE;
ALTER TABLE products.asset ADD COLUMN media_variant text;
ALTER TABLE products.asset ADD CONSTRAINT asset_media_link_check CHECK (
  (media_id IS NULL AND media_variant IS NULL) OR
  (media_id IS NOT NULL AND media_variant IS NOT NULL AND visibility='public' AND image_purpose IS NOT NULL)
);
CREATE UNIQUE INDEX asset_media_placement_unique ON products.asset(product_id,media_id,image_purpose,media_variant) WHERE media_id IS NOT NULL;
CREATE INDEX asset_media_id_idx ON products.asset(media_id) WHERE media_id IS NOT NULL;
