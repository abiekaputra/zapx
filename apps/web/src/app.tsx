const capabilities = [
  'Workspace-scoped sessions and role authorization',
  'One-time API key secrets with revocation',
  'Validated, idempotent notification intake',
  'Encrypted message content in PostgreSQL',
  'Transactional notification and outbox writes',
];

export function App() {
  return (
    <main>
      <nav aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="ZapX home">
          <span className="brand-mark">Z</span>
          ZapX
        </a>
        <a href="https://github.com/abiekaputra/zapx">Repository</a>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">Phase 4 · Durable intake</p>
        <h1>Notification delivery you can inspect and recover.</h1>
        <p className="lede">
          ZapX is being built as a local-first delivery platform for SMTP email and signed webhooks,
          with durable execution and visible failure recovery.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" /> Intake API operational
        </div>
      </section>

      <section className="foundation" aria-labelledby="capabilities-heading">
        <div>
          <p className="eyebrow">Available now</p>
          <h2 id="capabilities-heading">Secure acceptance before delivery</h2>
          <p>
            The API now authenticates clients, validates requests, encrypts message data, and
            commits each accepted notification with its outbox event. Queue delivery begins in Phase
            5.
          </p>
        </div>
        <ul>
          {capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
      </section>

      <footer>
        <p>Built transparently, one verified phase at a time.</p>
        <span>Local development · No public deployment yet</span>
      </footer>
    </main>
  );
}
