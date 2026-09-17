ALTER TABLE clients.client_profile ADD COLUMN first_name text;
ALTER TABLE clients.client_profile ADD COLUMN last_name text;
UPDATE clients.client_profile AS profile
SET
  first_name = COALESCE(account.first_name, split_part(client.name, ' ', 1)),
  last_name = COALESCE(
    account.last_name,
    NULLIF(trim(regexp_replace(client.name, '^\S+\s*', '')), ''),
    client.name
  )
FROM organization AS client
LEFT JOIN member AS membership ON membership.organization_id = client.id
LEFT JOIN "user" AS account ON account.id = membership.user_id
WHERE profile.organization_id = client.id AND profile.client_type = 'person';
ALTER TABLE clients.client_profile ADD CONSTRAINT person_name_parts_check CHECK (
  client_type <> 'person'
  OR (first_name IS NOT NULL AND length(trim(first_name)) > 0 AND last_name IS NOT NULL AND length(trim(last_name)) > 0)
);
