import nodemailer from 'nodemailer';

import type {
  DeliveryMessage,
  DeliveryProvider,
  ProviderResult,
  SmtpConfig,
} from './provider.types.js';

interface SmtpError extends Error {
  code?: string;
  command?: string;
  responseCode?: number;
}

export class SmtpProvider implements DeliveryProvider<SmtpConfig> {
  public async deliver(config: SmtpConfig, message: DeliveryMessage): Promise<ProviderResult> {
    const transport = nodemailer.createTransport({
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      host: config.host,
      port: config.port,
      secure: config.secure,
      socketTimeout: 10_000,
    });
    try {
      const result = await transport.sendMail({
        from: config.from,
        headers: { 'X-ZapX-Delivery-Id': message.deliveryId, 'X-ZapX-Trace-Id': message.traceId },
        subject: message.subject ?? 'ZapX notification',
        text: message.body,
        to: message.recipient,
      });
      return this.result('SUCCEEDED', null, null, result.messageId);
    } catch (error) {
      return this.classify(error as SmtpError);
    } finally {
      transport.close();
    }
  }

  private classify(error: SmtpError): ProviderResult {
    const code = error.code ?? 'SMTP_ERROR';
    const summary = error.message.slice(0, 300);
    if (error.command === 'DATA' && ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(code)) {
      return this.result('INDETERMINATE', code, summary, null);
    }
    if (error.responseCode && error.responseCode >= 500) {
      return this.result('PERMANENT_FAILURE', `SMTP_${error.responseCode}`, summary, null);
    }
    return this.result('TRANSIENT_FAILURE', code, summary, null);
  }

  private result(
    outcome: ProviderResult['outcome'],
    errorCode: string | null,
    errorSummary: string | null,
    providerRequestId: string | null,
  ): ProviderResult {
    return { errorCode, errorSummary, outcome, providerRequestId };
  }
}
