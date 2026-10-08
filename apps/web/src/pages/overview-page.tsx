import { EmptyState, PageHeader } from '../components/ui.js';
import { StatusBadge } from '../components/status-badge.js';
import type { Overview, Page } from '../lib/types.js';

const cards = [
  ['DELIVERED', 'Delivered'],
  ['PROCESSING', 'Processing'],
  ['QUEUED', 'Queued'],
  ['RETRY_SCHEDULED', 'Retrying'],
  ['DEAD_LETTER', 'Dead letter'],
  ['ACCEPTED', 'Accepted'],
] as const;

export function OverviewPage({
  data,
  onNavigate,
}: {
  data: Overview | null;
  onNavigate: (page: Page) => void;
}) {
  return (
    <>
      <PageHeader
        action={
          <button className="primary compact" onClick={() => onNavigate('compose')}>
            Compose notification
          </button>
        }
        eyebrow="OPERATIONS OVERVIEW"
        title="Delivery, without the guesswork."
      />
      <section className="metric-grid" aria-label="Notification status counts">
        {cards.map(([status, label]) => (
          <article className="metric-card" key={status}>
            <span>{label}</span>
            <strong>{data?.counts[status] ?? 0}</strong>
            <StatusBadge status={status} />
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ATTENTION</p>
            <h2>Recent delivery issues</h2>
          </div>
          <button className="secondary" onClick={() => onNavigate('notifications')}>
            View all
          </button>
        </div>
        {data?.recent_failures.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_failures.map((item) => (
                  <tr key={item.id}>
                    <td>{item.template_name}</td>
                    <td>{item.channel}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.last_error_code ?? 'Waiting for next attempt'}</td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No delivery issues">
            Failures and retries will appear here with their recorded reason.
          </EmptyState>
        )}
      </section>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
