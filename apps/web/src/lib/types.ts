export type Page =
  'overview' | 'compose' | 'notifications' | 'providers' | 'templates' | 'api-keys' | 'audit';

export interface User {
  display_name?: string;
  email: string;
  role?: 'OWNER' | 'OPERATOR' | 'VIEWER';
  workspace_id: string;
}

export interface Provider {
  config_summary: Record<string, unknown> | null;
  id: string;
  kind: 'SMTP' | 'WEBHOOK';
  last_test_result: string | null;
  last_tested_at: string | null;
  name: string;
  status: string;
}

export interface Template {
  body_template: string | null;
  channel: 'EMAIL' | 'WEBHOOK';
  id: string;
  name: string;
  published_at: string | null;
  required_variables: string[];
  status: string;
  subject_template: string | null;
  version_id: string | null;
  version_number: number | null;
}

export interface Notification {
  accepted_at: string;
  attempt_count: number;
  channel: 'EMAIL' | 'WEBHOOK';
  created_at: string;
  id: string;
  last_error_code: string | null;
  provider_name: string;
  status: string;
  template_name: string;
  trace_id: string;
}

export interface NotificationDetail extends Notification {
  attempts: Array<Record<string, unknown>>;
  body: string;
  next_attempt_at: string | null;
  recipient: string;
  subject: string | null;
  terminal_at: string | null;
}

export interface Overview {
  counts: Record<string, number>;
  recent_failures: Notification[];
  updated_at: string;
}

export interface ApiKey {
  created_at: string;
  id: string;
  last_used_at: string | null;
  name: string;
  prefix: string;
  revoked_at: string | null;
  scopes: string[];
}
