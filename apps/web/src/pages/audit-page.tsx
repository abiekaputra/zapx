import { useEffect, useState } from 'react';

import { EmptyState, PageHeader } from '../components/ui.js';
import { api } from '../lib/api.js';

interface AuditEvent {
  action: string;
  actor_label: string;
  id: string;
  occurred_at: string;
  target_type: string;
  trace_id: string;
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  useEffect(() => {
    void api<AuditEvent[]>('/v1/audit-events').then(setEvents);
  }, []);
  return (
    <>
      <PageHeader eyebrow="ACCOUNTABILITY" title="Audit trail" />
      <section className="panel flush">
        {events.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Trace</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.action.replaceAll('.', ' · ')}</strong>
                    </td>
                    <td>{event.actor_label}</td>
                    <td>{event.target_type}</td>
                    <td className="mono">{event.trace_id.slice(0, 12)}</td>
                    <td>{new Date(event.occurred_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit events">
            Security-sensitive workspace changes appear here.
          </EmptyState>
        )}
      </section>
    </>
  );
}
