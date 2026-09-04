/**
 * Entity relationship-graph projection.
 *
 * The vault stores relationships as a BIPARTITE web — persons/orgs/countries link
 * only to a `news` or `event` hub (MENTIONS / OCCURRED_IN), never to each other.
 * Rendering that raw leaves every entity dangling off a news node with no
 * person↔org↔country structure. So we PROJECT the bipartite graph onto the
 * entities: two entities that share a hub (co-mentioned in the same article, or
 * co-located in the same event) get a direct edge weighted by the number of
 * shared hubs. Hubs/events themselves are dropped. Pure + deterministic so the
 * dashboard route stays thin and the projection is unit-tested.
 */

export interface GraphEntity {
  name: string;
  kind: string;
  country?: string;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  degree: number;
  country?: string;
}

export interface GraphEdge {
  a: number;
  b: number;
  type: string;
  w: number;
}

export interface CooccurrenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ProjectOptions {
  /** Cap on rendered nodes (top by co-occurrence strength). */
  maxNodes?: number;
  /** Minimum shared-hub count for an edge — a lone co-mention is noise. */
  minWeight?: number;
  /** Skip pathological mega-hubs whose n² pairs would swamp the graph. */
  maxHubMembers?: number;
}

const ENTITY_KINDS = new Set(["person", "organization", "org", "country"]);
const HUB_KINDS = new Set(["news", "event", "story", "news_story"]);

const shortName = (id: string) => id.replace(/^.*[:/]/, "");

/**
 * Project bipartite (entity–hub) relationships onto an entity co-occurrence
 * graph. `rels` is the raw relationship edge list; `ent` maps entity id → metadata
 * (kind falls back to the id prefix, e.g. `person:…`, when absent).
 */
export function projectCooccurrence(
  rels: { a: string; b: string }[],
  ent: Map<string, GraphEntity>,
  opts: ProjectOptions = {},
): CooccurrenceGraph {
  const maxNodes = opts.maxNodes ?? 200;
  const minWeight = opts.minWeight ?? 2;
  const maxHubMembers = opts.maxHubMembers ?? 40;

  const kindOf = (id: string) => (ent.get(id)?.kind || id.split(":")[0] || "").toLowerCase();
  const nameOf = (id: string) => ent.get(id)?.name || shortName(id);

  // Group entity members by their shared hub.
  const hubMembers = new Map<string, Set<string>>();
  for (const r of rels) {
    const a = r.a, b = r.b, ka = kindOf(a), kb = kindOf(b);
    let hub: string | null = null, member: string | null = null;
    if (HUB_KINDS.has(ka) && ENTITY_KINDS.has(kb)) { hub = a; member = b; }
    else if (HUB_KINDS.has(kb) && ENTITY_KINDS.has(ka)) { hub = b; member = a; }
    if (!hub || !member) continue;
    (hubMembers.get(hub) ?? hubMembers.set(hub, new Set()).get(hub)!).add(member);
  }

  // Co-occurrence weight per entity pair (undirected, keyed lexicographically).
  const coWeight = new Map<string, number>();
  for (const members of hubMembers.values()) {
    const arr = [...members];
    if (arr.length < 2 || arr.length > maxHubMembers) continue;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const key = arr[i] < arr[j] ? `${arr[i]}|${arr[j]}` : `${arr[j]}|${arr[i]}`;
      coWeight.set(key, (coWeight.get(key) ?? 0) + 1);
    }
  }

  // Rank entities by summed co-occurrence weight over the surviving edges.
  const coDegree = new Map<string, number>();
  for (const [key, w] of coWeight) {
    if (w < minWeight) continue;
    const [a, b] = key.split("|");
    coDegree.set(a, (coDegree.get(a) ?? 0) + w);
    coDegree.set(b, (coDegree.get(b) ?? 0) + w);
  }
  const topIds = [...coDegree.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxNodes).map(([id]) => id);
  const gIndex = new Map(topIds.map((id, i) => [id, i]));
  const nodes: GraphNode[] = topIds.map((id) => {
    const meta = ent.get(id);
    return { id, name: nameOf(id), kind: meta?.kind || id.split(":")[0] || "entity", degree: coDegree.get(id) ?? 0, country: meta?.country };
  });

  const edges: GraphEdge[] = [];
  for (const [key, w] of coWeight) {
    if (w < minWeight) continue;
    const [ida, idb] = key.split("|");
    const a = gIndex.get(ida), b = gIndex.get(idb);
    if (a == null || b == null || a === b) continue;
    edges.push({ a, b, type: "co-occurrence", w });
  }

  return { nodes, edges };
}
