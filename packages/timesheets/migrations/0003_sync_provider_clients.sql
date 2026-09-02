INSERT INTO "timesheets"."workspace_client" (
  "id",
  "workspace_organization_id",
  "client_organization_id",
  "access_mode",
  "created_at",
  "updated_at"
)
SELECT
  md5(provider."id" || ':' || client."id" || ':timesheets'),
  provider."id",
  client."id",
  'DISABLED',
  now(),
  now()
FROM "organization" provider
CROSS JOIN "organization" client
INNER JOIN "clients"."client_profile" profile ON profile."organization_id" = client."id"
INNER JOIN "clients"."client_module" module
  ON module."organization_id" = client."id"
  AND module."module_id" = 'timesheets'
  AND module."enabled" = true
WHERE provider."organization_type" = 'PROVIDER'
  AND client."organization_type" = 'CLIENT'
  AND profile."archived_at" IS NULL
ON CONFLICT ("workspace_organization_id", "client_organization_id") DO NOTHING;
