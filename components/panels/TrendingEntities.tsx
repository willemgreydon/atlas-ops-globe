"use client";
import { useEffect, useState } from "react";
import { safeHttpUrl } from "@/lib/safe-url";

/**
 * Trending Entities — the persons and organizations most mentioned across the
 * ingested news, from the Event Registry entity graph (Wikipedia-linked). Reads
 * /api/intelligence/{persons,organizations}. Empty until `intel:sync news` runs.
 */
interface Entity {
  id: string;
  name: string;
  mentions: number;
  wikipediaUrl?: string;
  countryCode?: string;
}

function useEntities(url: string): Entity[] {
  const [rows, setRows] = useState<Entity[]>([]);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (live) setRows(j.data ?? []); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { live = false; clearInterval(t); };
  }, [url]);
  return rows;
}

function Row({ e }: { e: Entity }) {
  const inner = (
    <>
      <span className="ent-name">{e.name}</span>
      <span className="ent-count">{e.mentions}</span>
    </>
  );
  const wiki = safeHttpUrl(e.wikipediaUrl);
  return wiki ? (
    <a className="ent-row" href={wiki} target="_blank" rel="noreferrer noopener" title="Open Wikipedia">{inner}</a>
  ) : (
    <div className="ent-row static">{inner}</div>
  );
}

export default function TrendingEntities() {
  const persons = useEntities("/api/intelligence/persons?limit=6");
  const orgs = useEntities("/api/intelligence/organizations?limit=6");
  const empty = persons.length === 0 && orgs.length === 0;

  return (
    <section className="panel trending" aria-label="Trending entities">
      <div className="panel-head">
        <h3>Trending Entities</h3>
        <span className="src-chip">VAULT</span>
      </div>
      <div className="panel-body">
        {empty && <p className="muted-note">No entities yet — run <code>pnpm intel:sync news</code>.</p>}
        {persons.length > 0 && (
          <div className="mini-section">
            <h4>People</h4>
            {persons.map((e) => <Row key={e.id} e={e} />)}
          </div>
        )}
        {orgs.length > 0 && (
          <div className="mini-section">
            <h4>Organizations</h4>
            {orgs.map((e) => <Row key={e.id} e={e} />)}
          </div>
        )}
      </div>
    </section>
  );
}
