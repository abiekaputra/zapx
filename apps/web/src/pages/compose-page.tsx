import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Notice, PageHeader } from '../components/ui.js';
import { api, jsonBody } from '../lib/api.js';
import type { Provider, Template, User } from '../lib/types.js';

export function ComposePage({ user }: { user: User }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [recipient, setRecipient] = useState('recipient@example.test');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ body: string; subject: string | null } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selected = useMemo(
    () => templates.find((item) => item.version_id === templateId),
    [templates, templateId],
  );

  useEffect(() => {
    void Promise.all([api<Provider[]>('/v1/providers'), api<Template[]>('/v1/templates')]).then(
      ([providerData, templateData]) => {
        setProviders(providerData.filter((item) => item.status === 'READY'));
        setTemplates(templateData.filter((item) => item.published_at));
      },
    );
  }, []);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    setPreview(null);
    const item = templates.find((template) => template.version_id === id);
    setVariables(
      Object.fromEntries(
        (item?.required_variables ?? []).map((name) => [
          name,
          name === 'first_name' ? 'Naya' : 'ORDER-1042',
        ]),
      ),
    );
    const provider = providers.find((entry) =>
      item?.channel === 'EMAIL' ? entry.kind === 'SMTP' : entry.kind === 'WEBHOOK',
    );
    setProviderId(provider?.id ?? '');
    setRecipient(
      item?.channel === 'WEBHOOK' ? 'http://127.0.0.1:4010/deliveries' : 'recipient@example.test',
    );
  }

  async function showPreview() {
    try {
      setError('');
      setPreview(await api(`/v1/template-versions/${templateId}/preview`, jsonBody({ variables })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Preview failed.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await api<{ id: string }>('/v1/notifications', {
        ...jsonBody({
          provider_connection_id: providerId,
          recipient,
          template_version_id: templateId,
          variables,
        }),
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setMessage(`Notification ${result.id.slice(0, 8)} was accepted for durable delivery.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Submission failed.');
    }
  }

  if (user.role === 'VIEWER')
    return (
      <>
        <PageHeader eyebrow="COMPOSER" title="Compose notification" />
        <Notice tone="danger">Viewer access is read-only.</Notice>
      </>
    );
  return (
    <>
      <PageHeader eyebrow="COMPOSER" title="Send a synthetic notification" />
      {error && <Notice tone="danger">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <form className="form-layout" onSubmit={submit}>
        <section className="panel form-panel">
          <h2>Delivery</h2>
          <label>
            Published template
            <select required value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
              <option value="">Select a template</option>
              {templates.map((item) => (
                <option key={item.version_id!} value={item.version_id!}>
                  {item.name} · v{item.version_number}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ready provider
            <select required value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Select a provider</option>
              {providers
                .filter((item) =>
                  selected?.channel === 'EMAIL' ? item.kind === 'SMTP' : item.kind === 'WEBHOOK',
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Recipient
            <input required value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </label>
          {selected?.required_variables.map((name) => (
            <label key={name}>
              {name.replaceAll('_', ' ')}
              <input
                required
                value={variables[name] ?? ''}
                onChange={(e) => setVariables({ ...variables, [name]: e.target.value })}
              />
            </label>
          ))}
          <div className="button-row">
            <button
              className="secondary"
              disabled={!templateId}
              onClick={() => void showPreview()}
              type="button"
            >
              Preview
            </button>
            <button className="primary" disabled={!preview} type="submit">
              Send notification
            </button>
          </div>
        </section>
        <section className="panel preview-panel">
          <p className="eyebrow">LIVE PREVIEW</p>
          {preview ? (
            <div className="message-preview">
              <strong>{preview.subject ?? 'Signed webhook payload'}</strong>
              <p>{preview.body}</p>
            </div>
          ) : (
            <div className="preview-placeholder">
              Choose a template, complete its fields, then generate a validated preview.
            </div>
          )}
        </section>
      </form>
    </>
  );
}
