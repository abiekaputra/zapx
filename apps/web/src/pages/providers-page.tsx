import { useEffect, useState, type FormEvent } from 'react';

import { EmptyState, Notice, PageHeader } from '../components/ui.js';
import { StatusBadge } from '../components/status-badge.js';
import { api, jsonBody } from '../lib/api.js';
import type { Provider, User } from '../lib/types.js';

export function ProvidersPage({ user }: { user: User }) {
  const [items, setItems] = useState<Provider[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<'SMTP' | 'WEBHOOK'>('SMTP');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setItems(await api<Provider[]>('/v1/providers'));
  }
  async function test(id: string) {
    try {
      const result = await api<{ message: string }>(`/v1/providers/${id}/test`, jsonBody({}));
      setNotice(result.message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connection test failed.');
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const input =
      kind === 'SMTP'
        ? {
            config: {
              from: data.get('from'),
              host: data.get('host'),
              port: Number(data.get('port')),
              rate_limit_per_second: 5,
              secure: false,
            },
            kind,
            name: data.get('name'),
          }
        : {
            config: {
              rate_limit_per_second: 5,
              signing_secret: data.get('secret'),
              url: data.get('url'),
            },
            kind,
            name: data.get('name'),
          };
    try {
      await api('/v1/providers', jsonBody(input));
      setShowForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Provider could not be created.');
    }
  }
  useEffect(() => {
    void api<Provider[]>('/v1/providers').then(setItems);
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="DELIVERY INFRASTRUCTURE"
        title="Providers"
        action={
          user.role === 'OWNER' ? (
            <button className="primary compact" onClick={() => setShowForm(!showForm)}>
              Add provider
            </button>
          ) : undefined
        }
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {showForm && (
        <form className="panel inline-form" onSubmit={create}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">NEW CONNECTION</p>
              <h2>Configure local delivery</h2>
            </div>
          </div>
          <label>
            Name
            <input name="name" required placeholder="Local Mailpit" />
          </label>
          <label>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as 'SMTP' | 'WEBHOOK')}>
              <option>SMTP</option>
              <option>WEBHOOK</option>
            </select>
          </label>
          {kind === 'SMTP' ? (
            <>
              <label>
                Host
                <input name="host" required defaultValue="127.0.0.1" />
              </label>
              <label>
                Port
                <input name="port" required type="number" defaultValue="1026" />
              </label>
              <label>
                From address
                <input name="from" required type="email" defaultValue="notifications@zapx.local" />
              </label>
            </>
          ) : (
            <>
              <label>
                Webhook URL
                <input
                  name="url"
                  required
                  type="url"
                  defaultValue="http://127.0.0.1:4010/deliveries"
                />
              </label>
              <label>
                Signing secret
                <input
                  name="secret"
                  required
                  type="password"
                  minLength={16}
                  defaultValue="local-webhook-secret"
                />
              </label>
            </>
          )}
          <div className="button-row">
            <button className="secondary" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Save draft
            </button>
          </div>
        </form>
      )}
      <section className="card-grid">
        {items.length ? (
          items.map((item) => (
            <article className="resource-card" key={item.id}>
              <div className="resource-icon">{item.kind === 'SMTP' ? 'EM' : 'WH'}</div>
              <div>
                <h2>{item.name}</h2>
                <p>{summary(item)}</p>
              </div>
              <StatusBadge status={item.status} />
              <dl>
                <div>
                  <dt>Last tested</dt>
                  <dd>
                    {item.last_tested_at
                      ? new Date(item.last_tested_at).toLocaleString()
                      : 'Not tested yet'}
                  </dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>{item.last_test_result ?? 'Run a bounded connection test.'}</dd>
                </div>
              </dl>
              {user.role === 'OWNER' && item.status !== 'DISABLED' && (
                <button className="secondary" onClick={() => void test(item.id)}>
                  Test connection
                </button>
              )}
            </article>
          ))
        ) : (
          <EmptyState title="No providers configured">
            Add a local SMTP or signed webhook connection.
          </EmptyState>
        )}
      </section>
    </>
  );
}

function summary(provider: Provider) {
  if (!provider.config_summary) return 'Configuration unavailable';
  return provider.kind === 'SMTP'
    ? `${String(provider.config_summary.host)}:${String(provider.config_summary.port)}`
    : String(provider.config_summary.url);
}
