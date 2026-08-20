import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "./db";
import { count } from "./repositories";

/**
 * Global intelligence product: an aggregated snapshot across domains. Metrics
 * come from actual storage — anything not yet ingested is `null` (explicitly
 * unavailable), never fabricated.
 */
export interface GlobalSnapshot {
  generatedAt: string;
  activeDisasters: number;
  earthquakes24h: number;
  majorStories: { id: string; title: string; articleCount: number }[];
  criticalAlerts: { id: string; title: string; severity: string; occurredAt: string }[];
  counts: {
    countries: number;
    newsArticles: number;
    newsStories: number;
    events: number;
    vulnerabilities: number;
    kev: number;
    spaceObjects: number;
    aircraftSnapshot: number;
    relationships: number;
  };
  markets: null;
  maritime: null;
  sources: string[];
}

export function buildGlobalSnapshot(): GlobalSnapshot {
  const db = getDb();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  const majorStories = (
    db.prepare(
      "SELECT id, title, article_count AS articleCount FROM news_stories ORDER BY article_count DESC, last_seen DESC LIMIT 8",
    ).all() as { id: string; title: string; articleCount: number }[]
  ).filter((s) => s.articleCount > 1);

  const criticalAlerts = db.prepare(
    "SELECT id, title, severity, occurred_at AS occurredAt FROM events WHERE severity IN ('critical','warning') ORDER BY occurred_at DESC LIMIT 8",
  ).all() as { id: string; title: string; severity: string; occurredAt: string }[];

  return {
    generatedAt: new Date().toISOString(),
    activeDisasters: count("events", "kind = 'disaster'"),
    earthquakes24h: count("events", "tags LIKE '%earthquake%' AND occurred_at >= ?", [dayAgo]),
    majorStories,
    criticalAlerts,
    counts: {
      countries: count("countries"),
      newsArticles: count("news_articles"),
      newsStories: count("news_stories"),
      events: count("events"),
      vulnerabilities: count("vulnerabilities"),
      kev: count("vulnerabilities", "kev = 1"),
      spaceObjects: count("space_objects"),
      aircraftSnapshot: count("aircraft"),
      relationships: count("relationships"),
    },
    markets: null, // no market feed wired yet — explicitly unavailable
    maritime: null, // no AIS provider wired yet
    sources: ["naturalearth", "gdelt", "usgs", "eonet", "worldbank", "cisa-kev", "nvd", "celestrak", "opensky"],
  };
}

export function writeGlobalSnapshot(): GlobalSnapshot {
  const snap = buildGlobalSnapshot();
  const dir = resolve(process.cwd(), "intelligence", "global", "snapshots");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "latest.json"), JSON.stringify(snap, null, 2));
  const stamp = snap.generatedAt.replace(/[:.]/g, "").slice(0, 15) + "Z";
  writeFileSync(resolve(dir, `${stamp}.json`), JSON.stringify(snap, null, 2));
  return snap;
}
