import { describe, expect, it } from "vitest";
import { Cartesian3, type Viewer } from "cesium";
import { StaticLayer } from "@/lib/globe/render/static";
import type { Selection } from "@/stores/app-store";

type Row = { id: string; sev: string };

/** Minimal viewer stub — the layer only touches `dataSources.add/remove`;
 *  entities live in the layer's own CustomDataSource. */
function fakeViewer(): Viewer {
  return { dataSources: { add() {}, remove() {} } } as unknown as Viewer;
}

function makeLayer(onUpdateSpy?: (r: Row) => void) {
  const sel = new WeakMap<object, NonNullable<Selection>>();
  const layer = new StaticLayer<Row>(fakeViewer(), sel, {
    name: "test",
    position: () => Cartesian3.fromDegrees(0, 0, 0),
    build: () => ({ point: { pixelSize: 5 } }),
    selection: (r) => ({ kind: "event", id: r.id }),
    version: (r) => r.sev,
    onUpdate: (_ent, r) => onUpdateSpy?.(r),
  });
  layer.mount();
  return { layer, sel };
}

describe("StaticLayer diff/patch", () => {
  it("adds an entity per new row, preserving identity across updates", () => {
    const { layer } = makeLayer();
    layer.update([{ id: "a", sev: "warning" }, { id: "b", sev: "watch" }]);
    expect(layer.size).toBe(2);
    const entA = layer.getEntity("a");
    // A second update with the same rows must not recreate entities.
    layer.update([{ id: "a", sev: "warning" }, { id: "b", sev: "watch" }]);
    expect(layer.size).toBe(2);
    expect(layer.getEntity("a")).toBe(entA); // same object → identity preserved
  });

  it("removes entities whose rows are gone", () => {
    const { layer, sel } = makeLayer();
    layer.update([{ id: "a", sev: "warning" }, { id: "b", sev: "watch" }]);
    const entB = layer.getEntity("b")!;
    layer.update([{ id: "a", sev: "warning" }]);
    expect(layer.size).toBe(1);
    expect(layer.getEntity("b")).toBeUndefined();
    expect(sel.has(entB)).toBe(false); // selection mapping cleaned up
  });

  it("calls onUpdate only when the content version changes", () => {
    const seen: Row[] = [];
    const { layer } = makeLayer((r) => seen.push(r));
    layer.update([{ id: "a", sev: "warning" }]);
    layer.update([{ id: "a", sev: "warning" }]); // unchanged → no onUpdate
    expect(seen).toHaveLength(0);
    layer.update([{ id: "a", sev: "critical" }]); // severity changed → onUpdate
    expect(seen).toHaveLength(1);
    expect(seen[0].sev).toBe("critical");
  });

  it("maps new entities into the shared selection WeakMap", () => {
    const { layer, sel } = makeLayer();
    layer.update([{ id: "a", sev: "warning" }]);
    const ent = layer.getEntity("a")!;
    expect(sel.get(ent)).toEqual({ kind: "event", id: "a" });
  });

  it("drops all tracks on dispose", () => {
    const { layer } = makeLayer();
    layer.update([{ id: "a", sev: "warning" }, { id: "b", sev: "watch" }]);
    layer.dispose();
    expect(layer.size).toBe(0);
  });
});
