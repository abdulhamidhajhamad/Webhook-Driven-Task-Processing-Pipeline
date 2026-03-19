CREATE TABLE subscribers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID        NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscribers_pipeline_id ON subscribers(pipeline_id);