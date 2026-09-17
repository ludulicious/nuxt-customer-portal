WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY payload->>'id'
      ORDER BY created_at DESC, id DESC
    ) AS position
  FROM planning.job
  WHERE completed_at IS NULL
    AND kind = 'availability'
)
DELETE FROM planning.job job
USING ranked
WHERE job.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX job_pending_availability_target
  ON planning.job ((payload->>'id'))
  WHERE completed_at IS NULL
    AND kind = 'availability';
