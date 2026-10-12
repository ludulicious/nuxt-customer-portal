CREATE TABLE timesheets.approval_email (
  id text PRIMARY KEY,
  submission_id text NOT NULL REFERENCES timesheets.submission(id) ON DELETE CASCADE,
  client_organization_id text REFERENCES public.organization(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('internal-requested', 'client-requested')),
  recipient_user_id text NOT NULL,
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('SENDING', 'SENT', 'FAILED')),
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  sent_at timestamp
);
CREATE INDEX approval_email_submission_idx ON timesheets.approval_email(submission_id, created_at);
