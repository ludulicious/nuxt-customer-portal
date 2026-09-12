ALTER TABLE products.store ADD COLUMN languages text[] NOT NULL DEFAULT ARRAY['en','nl']::text[];
ALTER TABLE products.store ADD CONSTRAINT store_languages_valid CHECK(cardinality(languages)>0 AND languages <@ ARRAY['en','nl']::text[] AND default_locale=ANY(languages));
