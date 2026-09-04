import { describe, it, expect } from "vitest";
import { projectCooccurrence, type GraphEntity } from "@/lib/intel/graph";

/** Build the entity metadata map the projection resolves kinds/names from. */
function ents(...rows: [id: string, kind: string, name?: string][]): Map<string, GraphEntity> {
  const m = new Map<string, GraphEntity>();
  for (const [id, kind, name] of rows) m.set(id, { kind, name: name ?? id });
  return m;
}

describe("projectCooccurrence — bipartite entity–hub graph → entity co-occurrence", () => {
  it("connects entities that share a hub, never the hub itself", () => {
    // Two articles, each mentioning the same person+org pair → weight 2.
    const ent = ents(
      ["news:1", "news"], ["news:2", "news"],
      ["person:a", "person", "Alice"], ["org:x", "organization", "Acme"],
    );
    const rels = [
      { a: "news:1", b: "person:a" }, { a: "news:1", b: "org:x" },
      { a: "news:2", b: "person:a" }, { a: "news:2", b: "org:x" },
    ];
    const g = projectCooccurrence(rels, ent, { minWeight: 2 });
    // No news/event nodes survive — only the two entities.
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["org:x", "person:a"]);
    expect(g.nodes.every((n) => n.kind !== "news")).toBe(true);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].w).toBe(2);
    expect(g.edges[0].type).toBe("co-occurrence");
    // Edge indices reference the node array.
    const [na, nb] = [g.nodes[g.edges[0].a].id, g.nodes[g.edges[0].b].id].sort();
    expect([na, nb]).toEqual(["org:x", "person:a"]);
  });

  it("drops lone co-mentions below minWeight (noise) but keeps repeated ones", () => {
    const ent = ents(
      ["news:1", "news"], ["news:2", "news"], ["news:3", "news"],
      ["person:a", "person"], ["person:b", "person"], ["country:US", "country"],
    );
    const rels = [
      // a↔b co-occur twice (kept), a↔US once (dropped at minWeight 2).
      { a: "news:1", b: "person:a" }, { a: "news:1", b: "person:b" },
      { a: "news:2", b: "person:a" }, { a: "news:2", b: "person:b" },
      { a: "news:3", b: "person:a" }, { a: "news:3", b: "country:US" },
    ];
    const g = projectCooccurrence(rels, ent, { minWeight: 2 });
    expect(g.edges).toHaveLength(1);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["person:a", "person:b"]);
    // country:US only had a single co-mention → not a node.
    expect(g.nodes.find((n) => n.id === "country:US")).toBeUndefined();
  });

  it("infers entity/hub kind from the id prefix when metadata is absent", () => {
    const g = projectCooccurrence(
      [
        { a: "news:1", b: "person:a" }, { a: "news:1", b: "org:x" },
        { a: "news:2", b: "person:a" }, { a: "news:2", b: "org:x" },
      ],
      new Map(), // no metadata — kinds come from the id prefix
      { minWeight: 2 },
    );
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(1);
    expect(g.nodes.map((n) => n.kind).sort()).toEqual(["org", "person"]);
  });

  it("skips mega-hubs whose n² pairs would swamp the graph", () => {
    const ent = new Map<string, GraphEntity>([["news:big", { kind: "news", name: "big" }]]);
    const rels: { a: string; b: string }[] = [];
    for (let i = 0; i < 50; i++) { ent.set(`person:${i}`, { kind: "person", name: `p${i}` }); rels.push({ a: "news:big", b: `person:${i}` }); }
    // A single 50-member hub is over maxHubMembers(40) → contributes no edges.
    const g = projectCooccurrence(rels, ent, { minWeight: 1, maxHubMembers: 40 });
    expect(g.edges).toHaveLength(0);
  });

  it("caps the node set to the top maxNodes by co-occurrence strength", () => {
    const ent = new Map<string, GraphEntity>();
    const rels: { a: string; b: string }[] = [];
    // 6 persons all co-occur pairwise twice in two shared hubs → dense clique.
    for (let i = 0; i < 6; i++) ent.set(`person:${i}`, { kind: "person", name: `p${i}` });
    for (const hub of ["news:1", "news:2"]) {
      ent.set(hub, { kind: "news", name: hub });
      for (let i = 0; i < 6; i++) rels.push({ a: hub, b: `person:${i}` });
    }
    const g = projectCooccurrence(rels, ent, { minWeight: 2, maxNodes: 3 });
    expect(g.nodes).toHaveLength(3);
    // Edges only reference surviving (in-set) nodes.
    for (const e of g.edges) { expect(e.a).toBeLessThan(3); expect(e.b).toBeLessThan(3); }
  });

  it("returns an empty graph when there are no bipartite relationships", () => {
    const g = projectCooccurrence([{ a: "person:a", b: "person:b" }], ents(["person:a", "person"], ["person:b", "person"]));
    // No hub → no co-occurrence.
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });
});
