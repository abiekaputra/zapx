import { useEffect, useState } from 'react';

import { Shell } from './components/shell.js';
import { LogoMark } from './components/logo-mark.js';
import { Notice } from './components/ui.js';
import { api, jsonBody } from './lib/api.js';
import type { Overview, Page, User } from './lib/types.js';
import { ApiKeysPage } from './pages/api-keys-page.js';
import { AuditPage } from './pages/audit-page.js';
import { ComposePage } from './pages/compose-page.js';
import { LoginPage } from './pages/login-page.js';
import { NotificationsPage } from './pages/notifications-page.js';
import { OverviewPage } from './pages/overview-page.js';
import { ProvidersPage } from './pages/providers-page.js';
import { TemplatesPage } from './pages/templates-page.js';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [live, setLive] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');

  async function logout() {
    await api('/v1/auth/logout', jsonBody({})).catch(() => undefined);
    setUser(null);
    setOverview(null);
    setLive(false);
  }
  useEffect(() => {
    void api<User>('/v1/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    void api<Overview>('/v1/overview')
      .then((data) => {
        setOverview(data);
        setError('');
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Overview unavailable.'),
      );
    const events = new EventSource('/v1/events', { withCredentials: true });
    events.onopen = () => setLive(true);
    events.onerror = () => setLive(false);
    events.addEventListener('status', (event) => {
      setOverview(JSON.parse((event as MessageEvent).data) as Overview);
      setRefresh((value) => value + 1);
    });
    return () => events.close();
  }, [user]);
  if (loading)
    return (
      <main className="loading-screen">
        <LogoMark />
        <p>Preparing workspace…</p>
      </main>
    );
  if (!user) return <LoginPage onLogin={setUser} />;
  return (
    <Shell live={live} onLogout={() => void logout()} onNavigate={setPage} page={page} user={user}>
      {error && <Notice tone="danger">{error}</Notice>}
      {page === 'overview' && <OverviewPage data={overview} onNavigate={setPage} />}
      {page === 'compose' && <ComposePage user={user} />}
      {page === 'notifications' && <NotificationsPage refresh={refresh} user={user} />}
      {page === 'providers' && <ProvidersPage user={user} />}
      {page === 'templates' && <TemplatesPage user={user} />}
      {page === 'api-keys' && <ApiKeysPage user={user} />}
      {page === 'audit' && <AuditPage />}
    </Shell>
  );
}
