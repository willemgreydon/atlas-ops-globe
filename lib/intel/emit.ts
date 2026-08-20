import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ontology } from "./ontology";
import { SOURCES } from "./sources";
import { getDb } from "./db";

/**
 * Emit machine-readable _core artifacts (ontology, source registry) and a few
 * lightweight JSON indexes derived from the DB. Large indexes belong in SQLite,
 * not giant JSON — these are small summaries for humans and quick tooling.
 */
const core = (...p: string[]) => resolve(process.cwd(), "intelligence", "_core", ...p);

export function emitCoreArtifacts(): void {
  mkdirSync(core("ontology"), { recursive: true });
  mkdirSync(core("sources"), { recursive: true });
  writeFileSync(core("ontology", "ontology.json"), JSON.stringify(ontology, null, 2));
  writeFileSync(core("sources", "registry.json"), JSON.stringify({ generatedAt: new Date().toISOString(), sources: SOURCES }, null, 2));
}

export function emitIndexes(): void {
  const db = getDb();
  mkdirSync(core("indexes"), { recursive: true });

  const eventsByCountry = db.prepare(
    "SELECT country_code AS country, COUNT(*) AS n FROM events WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY n DESC",
  ).all();
  const articlesByCountry = db.prepare(
    "SELECT country_code AS country, COUNT(*) AS n FROM news_articles WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY n DESC",
  ).all();
  const eventsByDate = db.prepare(
    "SELECT substr(occurred_at,1,10) AS date, COUNT(*) AS n FROM events GROUP BY date ORDER BY date DESC LIMIT 60",
  ).all();

  writeFileSync(core("indexes", "events-by-country.json"), JSON.stringify(eventsByCountry, null, 2));
  writeFileSync(core("indexes", "articles-by-country.json"), JSON.stringify(articlesByCountry, null, 2));
  writeFileSync(core("indexes", "events-by-date.json"), JSON.stringify(eventsByDate, null, 2));
}
