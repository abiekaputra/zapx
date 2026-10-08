CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('OWNER', 'OPERATOR', 'VIEWER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  token_family_id uuid NOT NULL,
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_family_idx ON sessions(token_family_id);
CREATE INDEX sessions_expiry_idx ON sessions(refresh_expires_at);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  prefix text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  scopes text[] NOT NULL,
  creator_user_id uuid NOT NULL REFERENCES users(id),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_connections (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('SMTP', 'WEBHOOK')),
  status text NOT NULL CHECK (status IN ('DRAFT', 'READY', 'DISABLED', 'UNHEALTHY')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE templates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'WEBHOOK')),
  status text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES templates(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  subject_template text,
  body_template text NOT NULL,
  required_variables text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  creator_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  template_version_id uuid NOT NULL REFERENCES template_versions(id),
  provider_connection_id uuid NOT NULL REFERENCES provider_connections(id),
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'WEBHOOK')),
  recipient_ciphertext text NOT NULL,
  recipient_nonce text NOT NULL,
  recipient_tag text NOT NULL,
  recipient_fingerprint text NOT NULL,
  subject_ciphertext text,
  subject_nonce text,
  subject_tag text,
  body_ciphertext text NOT NULL,
  body_nonce text NOT NULL,
  body_tag text NOT NULL,
  payload_key_version integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('ACCEPTED', 'QUEUED', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'DEAD_LETTER')),
  attempt_count integer NOT NULL DEFAULT 0,
  accepted_at timestamptz NOT NULL,
  created_by_type text NOT NULL CHECK (created_by_type IN ('USER', 'API_KEY')),
  created_by_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_workspace_created_idx
  ON notifications(workspace_id, created_at DESC, id DESC);
CREATE INDEX notifications_workspace_status_idx
  ON notifications(workspace_id, status, created_at DESC);

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  operation text NOT NULL,
  idempotency_key_hash text NOT NULL,
  request_hash text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  response_snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, operation, idempotency_key_hash)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0,
  last_publish_error text
);

CREATE INDEX outbox_unpublished_idx
  ON outbox_events(occurred_at, id) WHERE published_at IS NULL;

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  actor_type text NOT NULL,
  actor_label text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  trace_id text NOT NULL
);

CREATE INDEX audit_workspace_occurred_idx
  ON audit_events(workspace_id, occurred_at DESC, id DESC);
