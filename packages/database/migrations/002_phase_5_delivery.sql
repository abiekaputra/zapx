ALTER TABLE provider_connections
  ADD COLUMN config_ciphertext text,
  ADD COLUMN config_nonce text,
  ADD COLUMN config_tag text,
  ADD COLUMN key_version integer NOT NULL DEFAULT 1;

ALTER TABLE notifications
  ADD COLUMN trace_id text,
  ADD COLUMN delivery_cycle_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz,
  ADD COLUMN last_error_code text,
  ADD COLUMN terminal_at timestamptz;

UPDATE notifications
SET trace_id = md5(id::text) || md5('zapx:' || id::text)
WHERE trace_id IS NULL;

ALTER TABLE notifications ALTER COLUMN trace_id SET NOT NULL;

CREATE TABLE delivery_attempts (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome text CHECK (outcome IN (
    'SUCCEEDED', 'TRANSIENT_FAILURE', 'PERMANENT_FAILURE', 'INDETERMINATE'
  )),
  error_code text,
  error_summary text,
  provider_request_id text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  trace_id text NOT NULL,
  UNIQUE (notification_id, attempt_number)
);

CREATE INDEX delivery_attempts_notification_idx
  ON delivery_attempts(notification_id, attempt_number);

CREATE INDEX notifications_retry_idx
  ON notifications(next_attempt_at, id) WHERE status = 'RETRY_SCHEDULED';
