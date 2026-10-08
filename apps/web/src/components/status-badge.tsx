export function StatusBadge({ status }: { status: string }) {
  const tone = ['DELIVERED', 'READY', 'ACTIVE', 'SUCCEEDED'].includes(status)
    ? 'success'
    : ['DEAD_LETTER', 'UNHEALTHY', 'PERMANENT_FAILURE'].includes(status)
      ? 'danger'
      : ['RETRY_SCHEDULED', 'PROCESSING', 'QUEUED'].includes(status)
        ? 'warning'
        : 'neutral';
  return <span className={`badge badge-${tone}`}>{status.replaceAll('_', ' ')}</span>;
}
