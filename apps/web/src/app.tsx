const foundations = [
  'Typed API and worker runtimes',
  'Shared contracts and validated configuration',
  'Structured logs with sensitive-field redaction',
  'PostgreSQL, Redis, and Mailpit local infrastructure',
  'Automated tests, linting, builds, and file-size checks',
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
        <p className="eyebrow">Phase 3 · Engineering foundation</p>
        <h1>Notification delivery you can inspect and recover.</h1>
        <p className="lede">
          ZapX is being built as a local-first delivery platform for SMTP email and signed webhooks,
          with durable execution and visible failure recovery.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" /> Foundation operational
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-heading">
        <div>
          <p className="eyebrow">Available now</p>
          <h2 id="foundation-heading">A tested base for product work</h2>
          <p>
            This phase establishes runtime boundaries and quality controls. Product workflows and
            notification delivery begin in Phase 4.
          </p>
        </div>
        <ul>
          {foundations.map((foundation) => (
            <li key={foundation}>{foundation}</li>
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
