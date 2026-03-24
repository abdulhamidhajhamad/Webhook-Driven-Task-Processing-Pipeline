CREATE TABLE pipeline_actions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   UUID        NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  action_type   TEXT        NOT NULL,
  action_config JSONB       NOT NULL DEFAULT '{}',
  order_index   INT         NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_actions_pipeline_id ON pipeline_actions(pipeline_id);
CREATE INDEX idx_pipeline_actions_order       ON pipeline_actions(pipeline_id, order_index);