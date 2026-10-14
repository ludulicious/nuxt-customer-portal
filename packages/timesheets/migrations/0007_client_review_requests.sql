-- Work-date cutover is persisted once, including for workspaces created later.
CREATE TABLE timesheets.client_review_rollout (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  starts_on date NOT NULL
);
INSERT INTO timesheets.client_review_rollout (starts_on)
VALUES ((date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Amsterdam') + interval '1 month')::date);

CREATE TABLE timesheets.client_review_schedule (
  workspace_client_id text NOT NULL REFERENCES timesheets.workspace_client(id) ON DELETE CASCADE,
  effective_on date NOT NULL,
  interval text NOT NULL CHECK (interval IN ('WEEKLY', 'TWO_WEEKLY', 'MONTHLY')),
  PRIMARY KEY (workspace_client_id, effective_on)
);
CREATE TABLE timesheets.client_review_request (
  id text PRIMARY KEY,
  workspace_client_id text NOT NULL REFERENCES timesheets.workspace_client(id) ON DELETE RESTRICT,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DISPUTED', 'WITHDRAWN')),
  version integer NOT NULL DEFAULT 1,
  supplementary boolean NOT NULL DEFAULT false,
  replaces_id text REFERENCES timesheets.client_review_request(id) ON DELETE RESTRICT,
  sent_by_id text NOT NULL REFERENCES public."user"(id),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_client_id, starts_on, ends_on, revision)
);
CREATE TABLE timesheets.client_review_request_replacement (
  request_id text NOT NULL REFERENCES timesheets.client_review_request(id) ON DELETE RESTRICT,
  replaces_id text NOT NULL REFERENCES timesheets.client_review_request(id) ON DELETE RESTRICT,
  PRIMARY KEY (request_id, replaces_id),
  UNIQUE (replaces_id)
);
CREATE TABLE timesheets.client_review_request_entry (
  request_id text NOT NULL REFERENCES timesheets.client_review_request(id) ON DELETE RESTRICT,
  entry_id text NOT NULL,
  snapshot jsonb NOT NULL,
  PRIMARY KEY (request_id, entry_id)
);
CREATE INDEX client_review_request_entry_entry_idx ON timesheets.client_review_request_entry(entry_id);
CREATE TABLE timesheets.client_review_request_event (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES timesheets.client_review_request(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('SENT', 'APPROVED', 'DISPUTED', 'WITHDRAWN')),
  actor_id text NOT NULL REFERENCES public."user"(id),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Serialize sending against changes to the same client's entries. Sent values stay immutable.
CREATE FUNCTION timesheets.guard_reviewed_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_key text; workspace_key text; client_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    workspace_key := NEW.organization_id; client_key := NEW.client_organization_id;
  ELSE
    workspace_key := OLD.organization_id; client_key := OLD.client_organization_id; entry_key := OLD.id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('client-review:' || workspace_key || ':' || client_key));
  IF TG_OP = 'UPDATE' AND (NEW.organization_id, NEW.client_organization_id) IS DISTINCT FROM (OLD.organization_id, OLD.client_organization_id) THEN
    PERFORM pg_advisory_xact_lock(hashtext('client-review:' || NEW.organization_id || ':' || NEW.client_organization_id));
  END IF;
  IF entry_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM timesheets.client_review_request_entry e
    JOIN timesheets.client_review_request r ON r.id = e.request_id
    WHERE e.entry_id = entry_key AND r.status <> 'WITHDRAWN'
  ) THEN
    RAISE EXCEPTION 'Withdraw affected client review requests before changing this time' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reviewed_entry BEFORE INSERT OR UPDATE OR DELETE ON timesheets.time_entry
FOR EACH ROW EXECUTE FUNCTION timesheets.guard_reviewed_entry();

-- Historical client slices must never expose post-cutover entries from crossing weeks.
CREATE FUNCTION timesheets.guard_legacy_client_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timesheets.time_entry e, timesheets.client_review_rollout rollout
    WHERE e.submission_id = NEW.submission_id AND e.client_organization_id = NEW.client_organization_id
      AND e.entry_date < rollout.starts_on
  ) THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_legacy_client_review BEFORE INSERT ON timesheets.client_review
FOR EACH ROW EXECUTE FUNCTION timesheets.guard_legacy_client_review();

-- Internal status changes and sending share the same client locks.
CREATE FUNCTION timesheets.guard_reviewed_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR c IN SELECT DISTINCT organization_id, client_organization_id FROM timesheets.time_entry WHERE submission_id = OLD.id ORDER BY organization_id, client_organization_id LOOP
      PERFORM pg_advisory_xact_lock(hashtext('client-review:' || c.organization_id || ':' || c.client_organization_id));
    END LOOP;
    IF EXISTS (SELECT 1 FROM timesheets.time_entry te
      JOIN timesheets.client_review_request_entry re ON re.entry_id = te.id
      JOIN timesheets.client_review_request r ON r.id = re.request_id
      WHERE te.submission_id = OLD.id AND r.status <> 'WITHDRAWN') THEN
      RAISE EXCEPTION 'Withdraw affected client review requests before changing this submission' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reviewed_submission BEFORE UPDATE ON timesheets.submission
FOR EACH ROW EXECUTE FUNCTION timesheets.guard_reviewed_submission();
