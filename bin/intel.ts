/**
 * Intelligence Vault CLI.
 *
 *   pnpm intel:status            vault status + record counts
 *   pnpm intel:sources           source registry
 *   pnpm intel:sync <domain>     sync one domain (news|disasters|economics|cyber|space|aviation|countries)
 *   pnpm intel:sync --all        sync every domain
 *   pnpm intel:bootstrap         populate a useful baseline
 *   pnpm intel:update            incremental refresh (skips country seed)
 *   pnpm intel:stats             record counts
 *   pnpm intel:validate          DB integrity + migration check
 *   pnpm intel:index             (re)build snapshots, indexes, _core artifacts
 *
 * Flags: --query <q> --group <g> --limit <n>
 */
import { getDb, closeDb } from "@/lib/intel/db";
import { LATEST_MIGRATION } from "@/lib/intel/migrations";
import { tableCounts } from "@/lib/intel/repositories";
import { SOURCES } from "@/lib/intel/sources";
import { INGESTORS, BOOTSTRAP_ORDER, UPDATE_ORDER, type IngestOpts } from "@/lib/intel/registry";
import { writeStatus, rollup, type IngestReport } from "@/lib/intel/ingest";
import { writeGlobalSnapshot } from "@/lib/intel/global";
import { emitCoreArtifacts, emitIndexes } from "@/lib/intel/emit";

function parseFlags(argv: string[]): { positional: string[]; opts: IngestOpts & { all?: boolean } } {
  const positional: string[] = [];
  const opts: IngestOpts & { all?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") opts.all = true;
    else if (a === "--query") opts.query = argv[++i];
    else if (a === "--group") opts.group = argv[++i];
    else if (a === "--limit") opts.limit = Number(argv[++i]);
    else positional.push(a);
  }
  return { positional, opts };
}

function fmt(n: number): string { return n.toLocaleString().padStart(9); }

async function runDomains(domains: string[], opts: IngestOpts): Promise<IngestReport[]> {
  const reports: IngestReport[] = [];
  for (const d of domains) {
    const ingestor = INGESTORS[d];
    if (!ingestor) { console.error(`  ! unknown domain: ${d}`); continue; }
    process.stdout.write(`  → ${d.padEnd(12)} `);
    const r = await ingestor(opts);
    reports.push(r);
    const tag = r.status === "success" ? "OK" : r.status.toUpperCase();
    console.log(`${tag.padEnd(8)} fetched=${r.fetched} created=${r.created} updated=${r.updated} failed=${r.failed} (${r.durationMs}ms)${r.error ? ` — ${r.error}` : ""}`);
  }
  return reports;
}

function printStats(): void {
  const c = tableCounts();
  console.log("\nGLOBAL INTELLIGENCE VAULT");
  const rows: [string, number][] = [
    ["Countries", c.countries], ["Entities", c.entities], ["Relationships", c.relationships],
    ["Events", c.events], ["News Articles", c.news_articles], ["News Stories", c.news_stories],
    ["Persons", c.persons], ["Organizations", c.organizations],
    ["Economic Obs", c.economic_observations], ["Vulnerabilities", c.vulnerabilities],
    ["Space Objects", c.space_objects], ["Aircraft (snap)", c.aircraft],
    ["Airports", c.airports], ["Ports", c.ports], ["Vessels", c.vessels],
    ["Sanctions", c.sanctions], ["Provenance", c.provenance],
  ];
  for (const [label, n] of rows) console.log(`  ${label.padEnd(18)}${fmt(n)}`);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, opts } = parseFlags(rest);

  switch (cmd) {
    case "status": {
      getDb();
      console.log(`Vault DB ready (migration v${LATEST_MIGRATION}).`);
      printStats();
      break;
    }
    case "sources": {
      console.log("SOURCE REGISTRY\n");
      for (const s of SOURCES) {
        console.log(`  ${s.id.padEnd(14)} ${s.status.padEnd(20)} ${s.domains.join(",").padEnd(24)} commercial=${s.commercialUse}`);
      }
      break;
    }
    case "sync": {
      const domains = opts.all ? Object.keys(INGESTORS) : positional;
      if (domains.length === 0) { console.error("usage: intel sync <domain> | --all"); process.exit(1); }
      console.log("Syncing:", domains.join(", "));
      const reports = await runDomains(domains, opts);
      writeStatus(reports);
      writeGlobalSnapshot();
      console.log(`\nRollup: ${rollup(reports)}`);
      break;
    }
    case "bootstrap": {
      console.log("Bootstrapping baseline intelligence vault…");
      emitCoreArtifacts();
      const reports = await runDomains(BOOTSTRAP_ORDER, opts);
      writeStatus(reports);
      emitIndexes();
      writeGlobalSnapshot();
      printStats();
      console.log(`\nBootstrap: ${rollup(reports)}`);
      break;
    }
    case "update": {
      console.log("Incremental update…");
      const reports = await runDomains(UPDATE_ORDER, opts);
      writeStatus(reports);
      emitIndexes();
      writeGlobalSnapshot();
      console.log(`\nUpdate: ${rollup(reports)}`);
      break;
    }
    case "stats": {
      getDb();
      printStats();
      break;
    }
    case "validate": {
      const db = getDb();
      const integrity = (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
      const applied = (db.prepare("SELECT COUNT(*) AS n FROM _migrations").get() as { n: number }).n;
      console.log(`integrity: ${integrity}`);
      console.log(`migrations applied: ${applied} (latest v${LATEST_MIGRATION})`);
      if (integrity !== "ok") process.exit(1);
      break;
    }
    case "index": {
      getDb();
      emitCoreArtifacts();
      emitIndexes();
      const snap = writeGlobalSnapshot();
      console.log(`Wrote _core artifacts, indexes, and global snapshot (${snap.counts.newsArticles} articles, ${snap.counts.events} events).`);
      break;
    }
    default:
      console.log("commands: status | sources | sync <domain>|--all | bootstrap | update | stats | validate | index");
  }
  closeDb();
}

main().catch((err) => { console.error("intel CLI failed:", err); process.exit(1); });
