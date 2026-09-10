ALTER TABLE "user" ADD COLUMN timezone text;
CREATE TABLE organization_settings (
 organization_id text PRIMARY KEY REFERENCES organization(id) ON DELETE CASCADE,
 timezone text NOT NULL DEFAULT 'Europe/Amsterdam'
);
INSERT INTO organization_settings (organization_id) SELECT id FROM organization WHERE organization_type = 'PROVIDER';
DO $$ BEGIN
 IF to_regclass('timesheets.workspace_settings') IS NOT NULL THEN
  EXECUTE 'UPDATE organization_settings s SET timezone = w.timezone FROM timesheets.workspace_settings w WHERE w.organization_id = s.organization_id';
 END IF;
END $$;

-- Bootstrap paths can create the provider after migrations have completed.
CREATE FUNCTION initialize_provider_timezone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.organization_type = 'PROVIDER' THEN
  INSERT INTO organization_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_provider_timezone AFTER INSERT OR UPDATE OF organization_type ON organization
 FOR EACH ROW EXECUTE FUNCTION initialize_provider_timezone();
