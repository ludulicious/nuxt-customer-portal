ALTER TABLE clients.client_profile ADD COLUMN client_type text NOT NULL DEFAULT 'organization'
 CHECK (client_type IN ('organization', 'person'));
ALTER TABLE clients.client_profile ADD COLUMN timezone text;
ALTER TABLE clients.client_profile ADD CONSTRAINT person_no_company_fields
 CHECK (client_type <> 'person' OR (registration_number IS NULL AND vat_number IS NULL));
-- Unique constraints serialize competing invitations and onboarding requests.
CREATE TABLE clients.personal_membership (
 organization_id text PRIMARY KEY REFERENCES clients.client_profile(organization_id) ON DELETE CASCADE,
 user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
 member_id text NOT NULL UNIQUE REFERENCES member(id) ON DELETE CASCADE
);
CREATE FUNCTION clients.enforce_personal_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (OLD.user_id <> NEW.user_id OR OLD.organization_id <> NEW.organization_id)
 AND EXISTS (SELECT 1 FROM clients.personal_membership WHERE member_id = OLD.id) THEN
  RAISE EXCEPTION 'Personal membership cannot be reassigned' USING ERRCODE = '23514';
 END IF;
 IF EXISTS (SELECT 1 FROM clients.client_profile WHERE organization_id = NEW.organization_id AND client_type = 'person') THEN
  IF NEW.role <> 'owner' THEN RAISE EXCEPTION 'A personal client has one owner' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD.user_id <> NEW.user_id OR OLD.organization_id <> NEW.organization_id) THEN
   RAISE EXCEPTION 'Personal membership cannot be reassigned' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' OR NOT EXISTS (SELECT 1 FROM clients.personal_membership WHERE member_id = NEW.id) THEN
   INSERT INTO clients.personal_membership VALUES (NEW.organization_id, NEW.user_id, NEW.id);
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_personal_membership AFTER INSERT OR UPDATE ON member
 FOR EACH ROW EXECUTE FUNCTION clients.enforce_personal_membership();
CREATE FUNCTION clients.immutable_client_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.client_type <> NEW.client_type THEN RAISE EXCEPTION 'Client type cannot be changed' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_client_type BEFORE UPDATE ON clients.client_profile
 FOR EACH ROW EXECUTE FUNCTION clients.immutable_client_type();
