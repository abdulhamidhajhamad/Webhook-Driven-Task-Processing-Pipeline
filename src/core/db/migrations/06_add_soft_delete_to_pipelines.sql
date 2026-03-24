ALTER TABLE pipelines
  ADD COLUMN is_deleted  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN deleted_at  TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_pipelines_is_deleted ON pipelines(is_deleted);