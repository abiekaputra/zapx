import { Inject, Injectable } from '@nestjs/common';
import { AuditRepository, TemplateRepository } from '@zapx/database';
import { DomainError, renderTemplate, type Principal } from '@zapx/domain';
import { randomBytes } from 'node:crypto';

@Injectable()
export class TemplateService {
  public constructor(
    @Inject(TemplateRepository) private readonly templates: TemplateRepository,
    @Inject(AuditRepository) private readonly audit: AuditRepository,
  ) {}

  public async list(principal: Principal) {
    return (await this.templates.list(principal.workspaceId)).map((row) => ({
      body_template: row.body_template,
      channel: row.channel,
      created_at: row.created_at.toISOString(),
      id: row.id,
      name: row.name,
      published_at: row.published_at?.toISOString() ?? null,
      required_variables: row.required_variables ?? [],
      status: row.status,
      subject_template: row.subject_template,
      version_id: row.version_id,
      version_number: row.version_number,
    }));
  }

  public async create(principal: Principal, input: { channel: 'EMAIL' | 'WEBHOOK'; name: string }) {
    this.requireEditor(principal);
    const template = await this.templates.create({
      ...input,
      userId: principal.actorId,
      workspaceId: principal.workspaceId,
    });
    await this.record(principal, 'template.created', template.id);
    return { ...template, status: 'DRAFT' };
  }

  public async createVersion(
    principal: Principal,
    templateId: string,
    input: {
      body_template: string;
      required_variables: string[];
      subject_template?: string | null | undefined;
    },
  ) {
    this.requireEditor(principal);
    const version = await this.templates.createVersion({
      body: input.body_template,
      subject: input.subject_template ?? null,
      templateId,
      userId: principal.actorId,
      variables: [...new Set(input.required_variables)],
      workspaceId: principal.workspaceId,
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Template was not found', 404);
    await this.record(principal, 'template.version_created', version.id);
    return this.versionView(version);
  }

  public async preview(principal: Principal, id: string, variables: Record<string, string>) {
    const version = await this.templates.findVersion(principal.workspaceId, id);
    if (!version) throw new DomainError('NOT_FOUND', 'Template version was not found', 404);
    try {
      return renderTemplate(
        {
          bodyTemplate: version.body_template,
          channel: version.channel,
          requiredVariables: version.required_variables,
          subjectTemplate: version.subject_template,
        },
        variables,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Template variables are invalid';
      throw new DomainError('VALIDATION_FAILED', message, 422);
    }
  }

  public async publish(principal: Principal, id: string) {
    this.requireEditor(principal);
    const version = await this.templates.publish(principal.workspaceId, id);
    if (!version) throw new DomainError('NOT_FOUND', 'Template version was not found', 404);
    await this.record(principal, 'template.published', id);
    return this.versionView(version);
  }

  private requireEditor(principal: Principal): void {
    if (principal.kind !== 'USER' || principal.role === 'VIEWER') {
      throw new DomainError('FORBIDDEN', 'Template editor permission is required', 403);
    }
  }

  private versionView(version: {
    body_template: string;
    channel: string;
    id: string;
    published_at: Date | null;
    required_variables: string[];
    subject_template: string | null;
    template_id: string;
    version_number: number;
  }) {
    return {
      body_template: version.body_template,
      channel: version.channel,
      id: version.id,
      published_at: version.published_at?.toISOString() ?? null,
      required_variables: version.required_variables,
      subject_template: version.subject_template,
      template_id: version.template_id,
      version_number: version.version_number,
    };
  }

  private async record(principal: Principal, action: string, targetId: string) {
    await this.audit.record({
      action,
      actorId: principal.actorId,
      actorLabel: principal.actorLabel,
      actorType: principal.kind,
      targetId,
      targetType: 'TEMPLATE',
      traceId: randomBytes(16).toString('hex'),
      workspaceId: principal.workspaceId,
    });
  }
}
