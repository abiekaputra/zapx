import { useEffect, useState, type FormEvent } from 'react';

import { EmptyState, Notice, PageHeader } from '../components/ui.js';
import { StatusBadge } from '../components/status-badge.js';
import { api, jsonBody } from '../lib/api.js';
import type { Template, User } from '../lib/types.js';

export function TemplatesPage({ user }: { user: User }) {
  const [items, setItems] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setItems(await api<Template[]>('/v1/templates'));
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const template = await api<{ id: string }>(
        '/v1/templates',
        jsonBody({ channel: data.get('channel'), name: data.get('name') }),
      );
      const version = await api<{ id: string }>(
        `/v1/templates/${template.id}/versions`,
        jsonBody({
          body_template: data.get('body'),
          required_variables: String(data.get('variables'))
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          subject_template: data.get('subject') || null,
        }),
      );
      await api(`/v1/template-versions/${version.id}/publish`, jsonBody({}));
      setShowForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Template could not be created.');
    }
  }
  useEffect(() => {
    void api<Template[]>('/v1/templates').then(setItems);
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="MESSAGE DESIGN"
        title="Templates"
        action={
          user.role !== 'VIEWER' ? (
            <button className="primary compact" onClick={() => setShowForm(!showForm)}>
              Create template
            </button>
          ) : undefined
        }
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {showForm && (
        <form className="panel template-form" onSubmit={create}>
          <label>
            Name
            <input name="name" required placeholder="Payment received" />
          </label>
          <label>
            Channel
            <select name="channel">
              <option>EMAIL</option>
              <option>WEBHOOK</option>
            </select>
          </label>
          <label>
            Subject
            <input name="subject" placeholder="Payment {{reference}} received" />
          </label>
          <label>
            Required variables
            <input name="variables" placeholder="first_name, reference" />
          </label>
          <label className="full">
            Body template
            <textarea
              name="body"
              required
              rows={5}
              defaultValue="Hello {{first_name}}, payment {{reference}} was received."
            />
          </label>
          <div className="button-row full">
            <button className="secondary" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Create and publish
            </button>
          </div>
        </form>
      )}
      <section className="card-grid">
        {items.length ? (
          items.map((item) => (
            <article className="resource-card template-card" key={item.id}>
              <div className="resource-icon">{item.channel === 'EMAIL' ? 'EM' : 'WH'}</div>
              <div>
                <h2>{item.name}</h2>
                <p>
                  {item.channel} · Version {item.version_number ?? '—'}
                </p>
              </div>
              <StatusBadge status={item.published_at ? 'ACTIVE' : item.status} />
              <div className="message-preview">
                <strong>{item.subject_template ?? 'Webhook payload'}</strong>
                <p>{item.body_template ?? 'No version created.'}</p>
              </div>
              <small>Variables: {item.required_variables.join(', ') || 'none'}</small>
            </article>
          ))
        ) : (
          <EmptyState title="No templates created">
            Create a versioned template for a local provider.
          </EmptyState>
        )}
      </section>
    </>
  );
}
