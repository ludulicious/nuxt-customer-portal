UPDATE products.product
SET data = data || jsonb_build_object(
  'thumbnailImageId', NULLIF(data->'imageIds'->>0, ''),
  'galleryImageIds', COALESCE(data->'imageIds', '[]'::jsonb),
  'detailImageIds', COALESCE(data->'imageIds', '[]'::jsonb)
)
WHERE NOT (data ? 'thumbnailImageId')
   OR NOT (data ? 'galleryImageIds')
   OR NOT (data ? 'detailImageIds');
