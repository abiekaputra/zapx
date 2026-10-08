import type { EncryptedValue } from '@zapx/security';

export type DeliveryChannel = 'EMAIL' | 'WEBHOOK';
export type DeliveryOutcome =
  'SUCCEEDED' | 'TRANSIENT_FAILURE' | 'PERMANENT_FAILURE' | 'INDETERMINATE';

export interface OutboxDeliveryEvent {
  eventId: string;
  notificationId: string;
  traceId: string;
  workspaceId: string;
}

export interface ClaimedDelivery {
  attemptId: string;
  attemptNumber: number;
  body: EncryptedValue;
  channel: DeliveryChannel;
  cycleAttempt: number;
  notificationId: string;
  providerConfig: EncryptedValue | null;
  providerConnectionId: string;
  recipient: EncryptedValue;
  subject: EncryptedValue | null;
  traceId: string;
  workspaceId: string;
}

export interface DeliveryCompletion {
  attemptId: string;
  durationMs: number;
  errorCode: string | null;
  errorSummary: string | null;
  nextAttemptAt: Date | null;
  notificationId: string;
  outcome: DeliveryOutcome;
  providerRequestId: string | null;
}

export interface ReplayRequest {
  actorId: string;
  actorLabel: string;
  actorType: 'USER' | 'API_KEY';
  notificationId: string;
  traceId: string;
  workspaceId: string;
}
