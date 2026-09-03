import { describe, expect, it } from "vitest";
import { Cartesian3, Cartesian3 as C3, Ellipsoid, Matrix3, Quaternion } from "cesium";
import { box, cylinder, buildGlb } from "@/lib/globe/models/gltf";
import { buildModel, MODEL_KEYS } from "@/lib/globe/models/catalog";
import { classifySatellite, classifyAircraft } from "@/lib/globe/models/classify";
import type { AircraftState } from "@/types/domain";
import { surfaceQuaternion } from "@/lib/globe/render/orient";
import type { SatelliteRow } from "@/stores/app-store";

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

interface ParsedGlb {
  magic: number;
  version: number;
  length: number;
  jsonType: number;
  binType: number;
  binLen: number;
  json: any;
}

function parseGlb(bytes: Uint8Array): ParsedGlb {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dv.getUint32(0, true);
  const version = dv.getUint32(4, true);
  const length = dv.getUint32(8, true);
  let o = 12;
  const jsonLen = dv.getUint32(o, true);
  const jsonType = dv.getUint32(o + 4, true);
  o += 8;
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(o, o + jsonLen)));
  o += jsonLen;
  const binLen = dv.getUint32(o, true);
  const binType = dv.getUint32(o + 4, true);
  return { magic, version, length, jsonType, binType, binLen, json };
}

describe("gltf builder", () => {
  it("emits a spec-valid GLB container", () => {
    const bytes = buildGlb([{ geometry: box(1, 1, 1), material: { color: [1, 0, 0, 1] } }]);
    const g = parseGlb(bytes);
    expect(g.magic).toBe(MAGIC);
    expect(g.version).toBe(2);
    expect(g.length).toBe(bytes.length); // header length matches the real buffer
    expect(bytes.length % 4).toBe(0); // chunks stay 4-byte aligned
    expect(g.jsonType).toBe(JSON_CHUNK);
    expect(g.binType).toBe(BIN_CHUNK);
    expect(g.json.asset.version).toBe("2.0");
    expect(g.json.buffers[0].byteLength).toBe(g.binLen - paddingTo4(g.json.buffers[0].byteLength));
  });

  it("gives every POSITION accessor min/max bounds (spec §3.6.2.4)", () => {
    const bytes = buildGlb([
      { geometry: box(2, 3, 4), material: { color: [1, 1, 1, 1] } },
      { geometry: cylinder(1, 0, 2, 12), material: { color: [0.5, 0.5, 0.5, 1] } },
    ]);
    const { json } = parseGlb(bytes);
    const positionAccessors = json.meshes.flatMap((m: { primitives: { attributes: { POSITION: number } }[] }) =>
      m.primitives.map((p) => json.accessors[p.attributes.POSITION]),
    );
    expect(positionAccessors.length).toBe(2);
    for (const a of positionAccessors) {
      expect(a.type).toBe("VEC3");
      expect(a.min).toHaveLength(3);
      expect(a.max).toHaveLength(3);
      for (let k = 0; k < 3; k++) expect(a.max[k]).toBeGreaterThanOrEqual(a.min[k]);
    }
  });

  it("de-duplicates shared materials", () => {
    const shared = { color: [0, 1, 0, 1] as [number, number, number, number] };
    const bytes = buildGlb([
      { geometry: box(1, 1, 1), material: shared },
      { geometry: box(1, 1, 1), material: shared },
    ]);
    const { json } = parseGlb(bytes);
    expect(json.materials).toHaveLength(1);
    expect(json.meshes).toHaveLength(2);
  });
});

describe("model catalog", () => {
  it("builds a valid, non-trivial GLB for every archetype", () => {
    for (const key of MODEL_KEYS) {
      const bytes = buildModel(key);
      const g = parseGlb(bytes);
      expect(g.magic, key).toBe(MAGIC);
      expect(g.json.nodes.length, key).toBeGreaterThan(0);
      expect(g.json.meshes.length, key).toBe(g.json.nodes.length);
      expect(g.json.accessors.length, key).toBe(g.json.meshes.length * 3); // POSITION+NORMAL+indices
    }
  });
});

describe("satellite classifier", () => {
  const row = (over: Partial<SatelliteRow>): SatelliteRow => ({ id: "1", norad: "1", name: "", ...over });

  it("routes objects to sensible archetypes", () => {
    expect(classifySatellite(row({ name: "STARLINK-1234" }))).toBe("sat-leo");
    expect(classifySatellite(row({ name: "GPS BIIF-3 (NAVSTAR 68)" }))).toBe("sat-nav");
    expect(classifySatellite(row({ name: "SENTINEL-2B" }))).toBe("sat-eo");
    expect(classifySatellite(row({ name: "INTELSAT 39", periodMin: 1436 }))).toBe("sat-comms");
    expect(classifySatellite(row({ name: "ISS (ZARYA)" }))).toBe("sat-station");
    expect(classifySatellite(row({ name: "SL-4 R/B" }))).toBe("sat-rocket");
    expect(classifySatellite(row({ name: "FENGYUN 1C DEB" }))).toBe("sat-debris");
  });

  it("falls back to the orbit regime when the name is unknown", () => {
    expect(classifySatellite(row({ name: "OBJECT A", periodMin: 95 }))).toBe("sat-leo");
    expect(classifySatellite(row({ name: "OBJECT B", periodMin: 718 }))).toBe("sat-nav");
    expect(classifySatellite(row({ name: "OBJECT C", periodMin: 1436 }))).toBe("sat-comms");
    expect(classifySatellite(row({ name: "MYSTERY" }))).toBe("sat-generic");
  });
});

describe("aircraft classifier", () => {
  const ac = (over: Partial<AircraftState>): AircraftState => ({
    id: "1", position: { lat: 0, lon: 0, alt: 10_000 }, lastContact: "2026-09-03T00:00:00Z", ...over,
  });

  it("routes by speed + altitude", () => {
    expect(classifyAircraft(ac({ velocityMs: 240, position: { lat: 0, lon: 0, alt: 11_000 } }))).toBe("aircraft-airliner");
    expect(classifyAircraft(ac({ velocityMs: 70, position: { lat: 0, lon: 0, alt: 1_200 } }))).toBe("aircraft-light");
    expect(classifyAircraft(ac({ velocityMs: 20, position: { lat: 0, lon: 0, alt: 300 } }))).toBe("aircraft-heli");
  });

  it("keeps ground contacts and unknown-speed as airliners", () => {
    expect(classifyAircraft(ac({ velocityMs: 5, onGround: true, position: { lat: 0, lon: 0, alt: 0 } }))).toBe("aircraft-airliner");
    expect(classifyAircraft(ac({ velocityMs: undefined }))).toBe("aircraft-airliner");
  });
});

describe("surface orientation", () => {
  it("returns a unit quaternion that puts model +Z at local zenith", () => {
    const pos = Cartesian3.fromDegrees(12.5, 41.9, 500_000); // over Rome, LEO altitude
    const q = surfaceQuaternion(pos, 90, new Quaternion());
    expect(Quaternion.magnitude(q)).toBeCloseTo(1, 6);

    // Rotate the model's +Z axis and confirm it aligns with the surface normal.
    const rot = Matrix3.fromQuaternion(q, new Matrix3());
    const modelUp = Matrix3.multiplyByVector(rot, C3.UNIT_Z, new C3());
    const zenith = Ellipsoid.WGS84.geodeticSurfaceNormal(pos, new C3());
    expect(C3.dot(modelUp, zenith)).toBeCloseTo(1, 4);
  });
});

function paddingTo4(n: number): number {
  return ((n + 3) & ~3) - n;
}
