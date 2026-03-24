CREATE TABLE delivery_attempts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES jobs(id),
  subscriber_id   UUID        NOT NULL REFERENCES subscribers(id),
  status          TEXT        NOT NULL,
  response_status INT,
  error           TEXT,
  attempt_number  INT         NOT NULL DEFAULT 1,
  attempted_at    TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at   TIMESTAMPTZ
);

CREATE INDEX idx_delivery_job_id        ON delivery_attempts(job_id);
CREATE INDEX idx_delivery_subscriber_id ON delivery_attempts(subscriber_id);