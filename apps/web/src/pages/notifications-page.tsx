import { useEffect, useState } from 'react';

import { EmptyState, Notice, PageHeader } from '../components/ui.js';
import { StatusBadge } from '../components/status-badge.js';
import { api, jsonBody } from '../lib/api.js';
import type { Notification, NotificationDetail, Provider, User } from '../lib/types.js';

export function NotificationsPage({ refresh, user }: { refresh: number; user: User }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [channel, setChannel] = useState('');
  const [from, setFrom] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      api<Notification[]>(
        `/v1/notifications?${filters({ channel, from, providerId, status, to })}`,
      ),
      api<Provider[]>('/v1/providers'),
    ])
      .then(([notifications, availableProviders]) => {
        if (active) {
          setItems(notifications);
          setProviders(availableProviders);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Notifications could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [channel, from, providerId, refresh, status, to]);

  async function load() {
    try {
      setError('');
      const query = filters({ channel, from, providerId, status, to });
      setItems(await api<Notification[]>(`/v1/notifications?${query}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notifications could not be loaded.');
    }
  }

  async function open(id: string) {
    try {
      setDetail(await api<NotificationDetail>(`/v1/notifications/${id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notification could not be loaded.');
    }
  }

  async function replay() {
    if (!detail) return;
    await api(`/v1/notifications/${detail.id}/replay`, jsonBody({}));
    setDetail(await api<NotificationDetail>(`/v1/notifications/${detail.id}`));
    await load();
  }

  return (
    <>
      <PageHeader eyebrow="DELIVERY LOG" title="Notifications" />
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="filter-bar">
        <label>
          Status
          <select onChange={(e) => setStatus(e.target.value)} value={status}>
            <option value="">All statuses</option>
            {[
              'ACCEPTED',
              'QUEUED',
              'PROCESSING',
              'DELIVERED',
              'RETRY_SCHEDULED',
              'DEAD_LETTER',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Channel
          <select onChange={(event) => setChannel(event.target.value)} value={channel}>
            <option value="">All channels</option>
            <option value="EMAIL">Email</option>
            <option value="WEBHOOK">Webhook</option>
          </select>
        </label>
        <label>
          Provider
          <select onChange={(event) => setProviderId(event.target.value)} value={providerId}>
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label>
          To
          <input onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </label>
        <button className="secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <section className="panel flush">
        {items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Provider</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="clickable" key={item.id} onClick={() => void open(item.id)}>
                    <td>
                      <strong>{item.template_name}</strong>
                      <small>{item.id.slice(0, 8)}</small>
                    </td>
                    <td>{item.provider_name}</td>
                    <td>{item.channel}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.attempt_count}</td>
                    <td>{new Date(item.accepted_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No notifications match">
            Change the filter or compose a synthetic notification.
          </EmptyState>
        )}
      </section>
      {detail && (
        <DetailDrawer
          detail={detail}
          onClose={() => setDetail(null)}
          onReplay={replay}
          role={user.role}
        />
      )}
    </>
  );
}

function filters(values: {
  channel: string;
  from: string;
  providerId: string;
  status: string;
  to: string;
}): URLSearchParams {
  const query = new URLSearchParams();
  if (values.channel) query.set('channel', values.channel);
  if (values.from) query.set('created_from', new Date(`${values.from}T00:00:00`).toISOString());
  if (values.providerId) query.set('provider_connection_id', values.providerId);
  if (values.status) query.set('status', values.status);
  if (values.to) query.set('created_to', new Date(`${values.to}T23:59:59.999`).toISOString());
  return query;
}

function DetailDrawer({
  detail,
  onClose,
  onReplay,
  role,
}: {
  detail: NotificationDetail;
  onClose: () => void;
  onReplay: () => Promise<void>;
  role: string | undefined;
}) {
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        aria-label="Notification detail"
        className="drawer"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <p className="eyebrow">NOTIFICATION DETAIL</p>
            <h2>{detail.template_name}</h2>
          </div>
          <button aria-label="Close detail" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <StatusBadge status={detail.status} />
        <dl className="detail-grid">
          <div>
            <dt>Recipient</dt>
            <dd>{detail.recipient}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{detail.provider_name}</dd>
          </div>
          <div>
            <dt>Trace ID</dt>
            <dd className="mono">{detail.trace_id}</dd>
          </div>
          <div>
            <dt>Attempts</dt>
            <dd>{detail.attempt_count}</dd>
          </div>
        </dl>
        <div className="message-preview">
          <strong>{detail.subject ?? 'Webhook payload'}</strong>
          <p>{detail.body}</p>
        </div>
        <h3>Attempt timeline</h3>
        {detail.attempts.length ? (
          <ol className="timeline">
            {detail.attempts.map((attempt) => (
              <li key={String(attempt.id)}>
                <StatusBadge status={String(attempt.outcome ?? 'PROCESSING')} />
                <div>
                  <strong>Attempt {String(attempt.attempt_number)}</strong>
                  <p>{String(attempt.error_summary ?? 'Provider accepted the delivery.')}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No provider attempt has started yet.</p>
        )}
        {detail.status === 'DEAD_LETTER' && role !== 'VIEWER' && (
          <button className="primary" onClick={() => void onReplay()}>
            Replay delivery
          </button>
        )}
      </aside>
    </div>
  );
}
