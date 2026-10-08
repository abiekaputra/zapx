import { useState, type FormEvent } from 'react';

import { api, jsonBody } from '../lib/api.js';
import type { User } from '../lib/types.js';
import { Notice } from '../components/ui.js';
import { LogoMark } from '../components/logo-mark.js';

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('owner@zapx.local');
  const [password, setPassword] = useState('local-zapx-owner');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ user: User }>('/v1/auth/login', jsonBody({ email, password }));
      onLogin(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand" href="https://github.com/abiekaputra/zapx">
          <LogoMark /> ZapX
        </a>
        <div>
          <p className="eyebrow">LOCAL DELIVERY OPERATIONS</p>
          <h1>Every notification has a story.</h1>
          <p>See the queue, understand the failure, and recover without losing history.</p>
        </div>
        <small>SMTP · signed webhooks · durable retries</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use the synthetic local account prepared by the seed command.</p>
          {error && <Notice tone="danger">{error}</Notice>}
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button className="primary" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Open workspace'}
          </button>
          <div className="local-hint">
            <strong>Local-only environment</strong>
            <span>No production recipients or credentials are required.</span>
          </div>
        </form>
      </section>
    </main>
  );
}
