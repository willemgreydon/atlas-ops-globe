"use client";
import { useApp } from "@/stores/app-store";

/**
 * Intelligence Vault summary — surfaces the SQLite-backed
 * /api/intelligence/global snapshot directly on the globe. Counts come from
 * actual storage; if the vault is empty it prompts to run the bootstrap.
 */
export default function VaultPanel() {
  const app = useApp();
  const v = app.vault;

  const metrics: [string, number | undefined][] = [
    ["Countries", v?.counts.countries],
    ["Events", v?.counts.events],
    ["Vulnerabilities", v?.counts.vulnerabilities],
    ["KEV", v?.counts.kev],
    ["Satellites", v?.counts.spaceObjects],
    ["Relationships", v?.counts.relationships],
  ];

  const empty = !!v && (v.counts.countries ?? 0) === 0;

  return (
    <section className="panel vault-panel" aria-label="Intelligence vault">
      <div className="panel-head">
        <h3>Intelligence Vault</h3>
        <span className="src-chip">VAULT</span>
      </div>
      <div className="panel-body">
        {!v && <p className="muted-note">Connecting to vault…</p>}
        {empty && <p className="muted-note">Vault is empty — run <code>pnpm intel:bootstrap</code>.</p>}
        {v && !empty && (
          <>
            <div className="vault-grid">
              {metrics.map(([label, n]) => (
                <div className="vault-metric" key={label}>
                  <label>{label}</label>
                  <b>{n == null ? "—" : n.toLocaleString()}</b>
                </div>
              ))}
            </div>
            {v.majorStories.length > 0 && (
              <div className="mini-section">
                <h4>Top stories</h4>
                {v.majorStories.slice(0, 3).map((s) => (
                  <div key={s.id} className="mini-row static">
                    <span className="mini-src">{s.articleCount}×</span>{s.title}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
