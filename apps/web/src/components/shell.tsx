import type { Page, User } from '../lib/types.js';
import { LogoMark } from './logo-mark.js';

const navigation: Array<{ label: string; page: Page; short: string }> = [
  { label: 'Overview', page: 'overview', short: 'OV' },
  { label: 'Compose', page: 'compose', short: 'CO' },
  { label: 'Notifications', page: 'notifications', short: 'NT' },
  { label: 'Providers', page: 'providers', short: 'PR' },
  { label: 'Templates', page: 'templates', short: 'TM' },
  { label: 'API keys', page: 'api-keys', short: 'AK' },
  { label: 'Audit trail', page: 'audit', short: 'AU' },
];

export function Shell({
  children,
  live,
  onLogout,
  onNavigate,
  page,
  user,
}: React.PropsWithChildren<{
  live: boolean;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  page: Page;
  user: User;
}>) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate('overview')}>
          <LogoMark />
          <span>ZapX</span>
        </button>
        <nav aria-label="Primary navigation">
          {navigation
            .filter((item) => visible(item.page, user))
            .map((item) => (
              <button
                aria-current={page === item.page ? 'page' : undefined}
                key={item.page}
                onClick={() => onNavigate(item.page)}
              >
                <span>{item.short}</span>
                {item.label}
              </button>
            ))}
        </nav>
        <div className="sidebar-foot">
          <div className="live-state">
            <i className={live ? 'live' : ''} /> {live ? 'Live updates' : 'Refresh mode'}
          </div>
          <div className="identity">
            <strong>{user.display_name ?? user.email}</strong>
            <span>{user.role}</span>
          </div>
          <button className="text-button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}

function visible(page: Page, user: User): boolean {
  if (page === 'api-keys') return user.role === 'OWNER';
  if (page === 'audit') return user.role !== 'OPERATOR';
  return true;
}
