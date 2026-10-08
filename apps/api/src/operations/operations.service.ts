import { Inject, Injectable } from '@nestjs/common';
import { loadApiEnvironment } from '@zapx/config';
import { AuditRepository, ConsoleRepository, type NotificationFilters } from '@zapx/database';
import { DomainError, type Principal } from '@zapx/domain';
import { PayloadCipher } from '@zapx/security';

@Injectable()
export class OperationsService {
  private readonly cipher = PayloadCipher.fromBase64(loadApiEnvironment().ZAPX_MASTER_KEY);

  public constructor(
    @Inject(ConsoleRepository) private readonly console: ConsoleRepository,
    @Inject(AuditRepository) private readonly audit: AuditRepository,
  ) {}

  public async overview(principal: Principal) {
    this.requireConsoleUser(principal);
    const overview = await this.console.overview(principal.workspaceId);
    return {
      counts: this.completeCounts(overview.counts),
      recent_failures: overview.recentFailures.map((row) => this.listView(row)),
      updated_at: new Date().toISOString(),
    };
  }

  public async listNotifications(principal: Principal, filters: NotificationFilters) {
    this.requireRead(principal);
    return (await this.console.listNotifications(principal.workspaceId, filters)).map((row) =>
      this.listView(row),
    );
  }

  public async notificationDetail(principal: Principal, id: string) {
    this.requireRead(principal);
    const record = await this.console.notificationDetail(principal.workspaceId, id);
    if (!record) throw new DomainError('NOT_FOUND', 'Notification was not found', 404);
    const association = `${principal.workspaceId}:${record.id}`;
    return {
      ...this.listView(record),
      attempts: record.attempts.map((attempt) => ({
        ...attempt,
        finished_at: this.iso(attempt.finished_at),
        started_at: this.iso(attempt.started_at),
      })),
      body: record.body
        ? this.cipher.decrypt(record.body, `${association}:body`)
        : 'Payload erased by the retention policy.',
      next_attempt_at: this.iso(record.next_attempt_at),
      payload_erased_at: this.iso(record.payload_erased_at),
      recipient: this.maskRecipient(
        record.channel,
        record.recipient
          ? this.cipher.decrypt(record.recipient, `${association}:recipient`)
          : 'erased',
      ),
      subject: record.subject
        ? this.cipher.decrypt(record.subject, `${association}:subject`)
        : null,
      terminal_at: this.iso(record.terminal_at),
    };
  }

  public async auditEvents(principal: Principal) {
    if (principal.kind !== 'USER' || principal.role === 'OPERATOR') {
      throw new DomainError('FORBIDDEN', 'Audit access is restricted', 403);
    }
    return (await this.audit.list(principal.workspaceId)).map((event) => ({
      ...event,
      occurred_at: this.iso(event.occurred_at),
    }));
  }

  public async metrics(): Promise<string> {
    const snapshot = await this.console.metricSnapshot();
    const statuses = [
      'ACCEPTED',
      'QUEUED',
      'PROCESSING',
      'DELIVERED',
      'RETRY_SCHEDULED',
      'DEAD_LETTER',
    ];
    return [
      '# HELP zapx_notifications Notifications by durable status.',
      '# TYPE zapx_notifications gauge',
      ...statuses.map(
        (status) => `zapx_notifications{status="${status}"} ${snapshot.statuses[status] ?? 0}`,
      ),
      '# HELP zapx_delivery_attempts Delivery attempts by normalized outcome.',
      '# TYPE zapx_delivery_attempts counter',
      ...Object.entries(snapshot.attempts).map(
        ([outcome, count]) => `zapx_delivery_attempts{outcome="${outcome}"} ${count}`,
      ),
      '# HELP zapx_queue_wait_milliseconds Average accepted-to-first-attempt delay.',
      '# TYPE zapx_queue_wait_milliseconds gauge',
      `zapx_queue_wait_milliseconds ${snapshot.averageQueueWaitMs}`,
      '# HELP zapx_delivery_duration_milliseconds Average provider attempt duration.',
      '# TYPE zapx_delivery_duration_milliseconds gauge',
      `zapx_delivery_duration_milliseconds ${snapshot.averageDeliveryMs}`,
      '',
    ].join('\n');
  }

  private listView(row: Record<string, unknown>) {
    return {
      accepted_at: this.iso(row.accepted_at),
      attempt_count: row.attempt_count,
      channel: row.channel,
      created_at: this.iso(row.created_at),
      id: row.id,
      last_error_code: row.last_error_code,
      provider_name: row.provider_name,
      status: row.status,
      template_name: row.template_name,
      trace_id: row.trace_id,
    };
  }

  private completeCounts(counts: Record<string, number>) {
    return Object.fromEntries(
      ['ACCEPTED', 'QUEUED', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'DEAD_LETTER'].map(
        (status) => [status, counts[status] ?? 0],
      ),
    );
  }

  private iso(value: unknown): string | null {
    return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : null;
  }

  private maskRecipient(channel: unknown, recipient: string): string {
    if (channel !== 'EMAIL') return new URL(recipient).origin;
    const [local, domain] = recipient.split('@');
    return `${local?.slice(0, 2) ?? ''}•••@${domain ?? ''}`;
  }

  private requireRead(principal: Principal): void {
    if (!principal.scopes.includes('notifications:read')) {
      throw new DomainError('FORBIDDEN', 'Read permission is required', 403);
    }
  }

  private requireConsoleUser(principal: Principal): void {
    if (principal.kind !== 'USER') {
      throw new DomainError('FORBIDDEN', 'Browser session is required', 403);
    }
  }
}
