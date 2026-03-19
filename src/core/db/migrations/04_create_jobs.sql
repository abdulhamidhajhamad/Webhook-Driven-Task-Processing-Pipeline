CREATE TABLE jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id  UUID        NOT NULL REFERENCES pipelines(id),
  status       TEXT        NOT NULL DEFAULT 'pending',
  payload      JSONB       NOT NULL,
  result       JSONB,
  error        TEXT,
  error_detail JSONB,
  attempts     INT         DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_status      ON jobs(status);
CREATE INDEX idx_jobs_pipeline_id ON jobs(pipeline_id);
CREATE INDEX idx_jobs_created_at  ON jobs(created_at);