ALTER TABLE jobs
  ADD COLUMN external_delivery_id TEXT UNIQUE;

CREATE INDEX idx_jobs_external_delivery_id ON jobs(external_delivery_id);