ALTER TABLE provider_connections
  ADD COLUMN last_tested_at timestamptz,
  ADD COLUMN last_test_result text;

ALTER TABLE notifications
  ALTER COLUMN recipient_ciphertext DROP NOT NULL,
  ALTER COLUMN recipient_nonce DROP NOT NULL,
  ALTER COLUMN recipient_tag DROP NOT NULL,
  ALTER COLUMN body_ciphertext DROP NOT NULL,
  ALTER COLUMN body_nonce DROP NOT NULL,
  ALTER COLUMN body_tag DROP NOT NULL,
  ADD COLUMN payload_erased_at timestamptz;

CREATE INDEX notifications_workspace_channel_idx
  ON notifications(workspace_id, channel, created_at DESC);

CREATE INDEX notifications_workspace_provider_idx
  ON notifications(workspace_id, provider_connection_id, created_at DESC);
