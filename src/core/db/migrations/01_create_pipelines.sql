CREATE TABLE pipelines (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  source_token TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  secret       TEXT,
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);