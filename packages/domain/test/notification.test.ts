import { describe, expect, it } from 'vitest';

import { normalizeRecipient, renderTemplate } from '../src/index.js';

const template = {
  bodyTemplate: 'Hello {{ first_name }}, order {{reference}} is ready.',
  channel: 'EMAIL' as const,
  requiredVariables: ['first_name', 'reference'],
  subjectTemplate: 'Order {{reference}}',
};

describe('notification domain', () => {
  it('renders a validated immutable message snapshot', () => {
    expect(renderTemplate(template, { first_name: 'Naya', reference: 'ORDER-1042' })).toEqual({
      body: 'Hello Naya, order ORDER-1042 is ready.',
      subject: 'Order ORDER-1042',
    });
  });

  it('rejects missing required variables', () => {
    expect(() => renderTemplate(template, { first_name: 'Naya' })).toThrow(
      'Missing required variables: reference',
    );
  });

  it('normalizes an email recipient', () => {
    expect(normalizeRecipient('EMAIL', ' Recipient@Example.Test ')).toBe('recipient@example.test');
  });

  it('rejects an invalid email recipient', () => {
    expect(() => normalizeRecipient('EMAIL', 'invalid')).toThrow();
  });
});
