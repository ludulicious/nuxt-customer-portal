ALTER TABLE timesheets.time_entry ADD COLUMN externally_billed boolean NOT NULL DEFAULT false;
ALTER TABLE timesheets.time_entry ADD COLUMN import_metadata jsonb;
