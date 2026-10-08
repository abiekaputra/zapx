import { useEffect, useState, type FormEvent } from 'react';

import { EmptyState, Notice, PageHeader } from '../components/ui.js';
import { StatusBadge } from '../components/status-badge.js';
import { api, jsonBody } from '../lib/api.js';
import type { ApiKey, User } from '../lib/types.js';

export function ApiKeysPage({ user }: { user: User }) {
  const [items, setItems] = useState<ApiKey[]>([]);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  async function load() {
    setItems(await api<ApiKey[]>('/v1/api-keys'));
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<ApiKey & { secret: string }>(
        '/v1/api-keys',
        jsonBody({ name: data.get('name'), scopes: ['notifications:read', 'notifications:write'] }),
      );
      setSecret(result.secret);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'API key could not be created.');
    }
  }
  async function revoke(id: string) {
    await api(`/v1/api-keys/${id}/revoke`, jsonBody({}));
    await load();
  }
  useEffect(() => {
    if (user.role === 'OWNER') void api<ApiKey[]>('/v1/api-keys').then(setItems);
  }, [user.role]);
  if (user.role !== 'OWNER')
    return (
      <>
        <PageHeader eyebrow="DEVELOPER ACCESS" title="API keys" />
        <Notice tone="danger">Only workspace owners can manage API keys.</Notice>
      </>
    );
  return (
    <>
      <PageHeader eyebrow="DEVELOPER ACCESS" title="API keys" />
      {error && <Notice tone="danger">{error}</Notice>}
      {secret && (
        <Notice tone="success">
          <strong>Copy this secret now.</strong>
          <code className="secret">{secret}</code>
          <button className="secondary" onClick={() => void navigator.clipboard.writeText(secret)}>
            Copy
          </button>
        </Notice>
      )}
      <form className="panel key-form" onSubmit={create}>
        <label>
          Key name
          <input name="name" required placeholder="Local integration" />
        </label>
        <button className="primary" type="submit">
          Create API key
        </button>
      </form>
      <section className="panel flush">
        {items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className="mono">zx_key_{item.prefix}_…</td>
                    <td>
                      <StatusBadge status={item.revoked_at ? 'DISABLED' : 'ACTIVE'} />
                    </td>
                    <td>
                      {item.last_used_at ? new Date(item.last_used_at).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      {!item.revoked_at && (
                        <button className="text-button danger" onClick={() => void revoke(item.id)}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No API keys">Create a scoped key for a local integration.</EmptyState>
        )}
      </section>
    </>
  );
}
