ALTER TABLE planning.job
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_attempt_at timestamptz;

UPDATE planning.job
SET last_attempt_at = available_at - make_interval(secs => LEAST(3600, (5 * power(2::numeric, LEAST(attempts, 10)))::int))
WHERE attempts > 0;

CREATE INDEX job_pending_activity
  ON planning.job (COALESCE(last_attempt_at, created_at) DESC)
  WHERE completed_at IS NULL;
