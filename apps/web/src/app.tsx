const capabilities = [
  'Transactional outbox relay to BullMQ',
  'Local SMTP delivery and signed webhooks',
  'Bounded retries with classified failures',
  'Durable attempt history and dead letters',
  'Audited manual recovery without erasing history',
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
        <p className="eyebrow">Phase 5 · Durable delivery</p>
        <h1>Notification delivery you can inspect and recover.</h1>
        <p className="lede">
          ZapX is being built as a local-first delivery platform for SMTP email and signed webhooks,
          with durable execution and visible failure recovery.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" /> Delivery pipeline operational
        </div>
      </section>

      <section className="foundation" aria-labelledby="capabilities-heading">
        <div>
          <p className="eyebrow">Available now</p>
          <h2 id="capabilities-heading">From accepted request to recorded outcome</h2>
          <p>
            ZapX now relays accepted work through Redis, delivers local email or signed webhooks,
            records every attempt, and preserves failures for deliberate recovery. Operator console
            workflows begin in Phase 6.
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
