/**
 * Zero-dependency glTF 2.0 / GLB authoring engine (mission §85).
 *
 * The globe has no binary model assets and no asset pipeline — so instead of
 * shipping `.glb` files we *generate* them, in code, at runtime. This module is
 * the foundation: it composes simple primitives (boxes, cylinders, cones) with
 * PBR metallic-roughness materials into a single self-contained GLB binary that
 * Cesium's `Model` can load from a blob URL.
 *
 * It is deliberately pure and browser-free (no `Blob`/`URL` here) so the whole
 * geometry pipeline is unit-testable: `buildGlb(parts)` returns the raw bytes,
 * the registry (browser side) wraps them in a blob URL.
 *
 * glTF conventions honoured: right-handed, +Y up, metre units, column-major
 * node TRS, little-endian buffers, POSITION accessors carry min/max, and every
 * bufferView is 4-byte aligned (spec §3.6.2.4).
 */

// --- geometry ---------------------------------------------------------------

export interface Geometry {
  /** Flat [x,y,z, …] vertex positions. */
  positions: number[];
  /** Flat [x,y,z, …] vertex normals (one per position). */
  normals: number[];
  /** Triangle indices into the vertex arrays. */
  indices: number[];
}

/** Axis-aligned box centred at the origin, with correct per-face normals. */
export function box(width: number, height: number, depth: number): Geometry {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Six faces, each 4 unique vertices so normals stay flat per face.
  const faces: Array<{ n: [number, number, number]; v: Array<[number, number, number]> }> = [
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] }, // +Z
    { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] }, // -Z
    { n: [1, 0, 0], v: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] }, // +X
    { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] }, // -X
    { n: [0, 1, 0], v: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] }, // +Y
    { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] }, // -Y
  ];
  for (const f of faces) {
    const base = positions.length / 3;
    for (const p of f.v) {
      positions.push(p[0], p[1], p[2]);
      normals.push(f.n[0], f.n[1], f.n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

/**
 * Cylinder / cone / frustum along the +Y axis, centred at the origin. Set
 * `radiusTop = 0` for a cone (apex up), `radiusBottom = 0` for one pointing
 * down. Caps are added only for non-zero radii.
 */
export function cylinder(
  radiusBottom: number,
  radiusTop: number,
  height: number,
  segments = 20,
): Geometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const hy = height / 2;
  // Slope of the side, so side normals tilt correctly on cones.
  const slope = (radiusBottom - radiusTop) / height;
  const ny = slope / Math.hypot(1, slope);
  const nr = 1 / Math.hypot(1, slope);

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const base = positions.length / 3;
    // Quad (or triangle when a radius collapses) for this side segment.
    positions.push(
      c0 * radiusBottom, -hy, s0 * radiusBottom,
      c1 * radiusBottom, -hy, s1 * radiusBottom,
      c1 * radiusTop, hy, s1 * radiusTop,
      c0 * radiusTop, hy, s0 * radiusTop,
    );
    normals.push(
      c0 * nr, ny, s0 * nr,
      c1 * nr, ny, s1 * nr,
      c1 * nr, ny, s1 * nr,
      c0 * nr, ny, s0 * nr,
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const addCap = (radius: number, y: number, up: boolean) => {
    if (radius <= 0) return;
    const centre = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, up ? 1 : -1, 0);
    const ring = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      normals.push(0, up ? 1 : -1, 0);
    }
    for (let i = 0; i < segments; i++) {
      if (up) indices.push(centre, ring + i, ring + i + 1);
      else indices.push(centre, ring + i + 1, ring + i);
    }
  };
  addCap(radiusTop, hy, true);
  addCap(radiusBottom, -hy, false);
  return { positions, normals, indices };
}

/**
 * Extrude a flat 2D planform (points in the XY plane) by `thickness` along Z,
 * giving a thin slab with correct per-face normals. Points should be a convex
 * polygon in order (a fan triangulation is used). This is what makes real wings,
 * tailplanes and fins possible — swept, tapered surfaces a box can't express.
 */
export function extrude(profile: Array<[number, number]>, thickness: number): Geometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const hz = thickness / 2;
  const n = profile.length;

  // Top cap (+Z) — fan from vertex 0.
  let base = positions.length / 3;
  for (const [x, y] of profile) { positions.push(x, y, hz); normals.push(0, 0, 1); }
  for (let i = 1; i < n - 1; i++) indices.push(base, base + i, base + i + 1);

  // Bottom cap (−Z) — reversed winding.
  base = positions.length / 3;
  for (const [x, y] of profile) { positions.push(x, y, -hz); normals.push(0, 0, -1); }
  for (let i = 1; i < n - 1; i++) indices.push(base, base + i + 1, base + i);

  // Side walls — one quad per edge, outward normal (perpendicular to the edge).
  for (let i = 0; i < n; i++) {
    const [ax, ay] = profile[i];
    const [bx, by] = profile[(i + 1) % n];
    let nx = by - ay;
    let ny = -(bx - ax);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    base = positions.length / 3;
    positions.push(ax, ay, -hz, bx, by, -hz, bx, by, hz, ax, ay, hz);
    for (let k = 0; k < 4; k++) normals.push(nx, ny, 0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

// --- materials & parts ------------------------------------------------------

export interface Material {
  /** Linear RGBA base colour, each channel 0..1. */
  color: [number, number, number, number];
  metallic?: number;
  roughness?: number;
  /** Linear RGB emissive; makes a part self-lit (solar cells, beacons). */
  emissive?: [number, number, number];
  /** Render both faces — needed for thin, single-quad panels. */
  doubleSided?: boolean;
}

export interface Part {
  geometry: Geometry;
  material: Material;
  /** Metres, glTF axes (+Y up). */
  translation?: [number, number, number];
  /** Euler radians, applied X→Y→Z. */
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
}

/** Euler (XYZ) → quaternion [x,y,z,w], the form glTF nodes expect. */
function eulerToQuat(x: number, y: number, z: number): [number, number, number, number] {
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

function align4(n: number): number {
  return (n + 3) & ~3;
}

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942; // "BIN\0"

/**
 * Assemble a list of parts into a single GLB binary (glTF 2.0). Each part
 * becomes a node → mesh → primitive; materials are de-duplicated by identity.
 * Returns the raw bytes; the caller wraps them in a blob URL for Cesium.
 */
export function buildGlb(parts: Part[]): Uint8Array {
  const bin: number[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const meshes: object[] = [];
  const nodes: object[] = [];
  const materials: object[] = [];
  const materialIndex = new Map<Material, number>();

  const pushView = (bytes: Uint8Array, target: number): number => {
    while (bin.length % 4 !== 0) bin.push(0); // 4-byte align this view's start
    const byteOffset = bin.length;
    for (const b of bytes) bin.push(b);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
    return bufferViews.length - 1;
  };

  const materialFor = (m: Material): number => {
    const existing = materialIndex.get(m);
    if (existing !== undefined) return existing;
    const def: Record<string, unknown> = {
      pbrMetallicRoughness: {
        baseColorFactor: m.color,
        metallicFactor: m.metallic ?? 0.5,
        roughnessFactor: m.roughness ?? 0.6,
      },
      doubleSided: m.doubleSided ?? false,
    };
    if (m.emissive) def.emissiveFactor = m.emissive;
    materials.push(def);
    const idx = materials.length - 1;
    materialIndex.set(m, idx);
    return idx;
  };

  for (const part of parts) {
    const g = part.geometry;
    // POSITION (VEC3 float) with required min/max bounds.
    const posBytes = new Uint8Array(new Float32Array(g.positions).buffer);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = g.positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    const posView = pushView(posBytes, 34962);
    const posAccessor = accessors.length;
    accessors.push({ bufferView: posView, componentType: 5126, count: g.positions.length / 3, type: "VEC3", min, max });

    // NORMAL (VEC3 float).
    const normBytes = new Uint8Array(new Float32Array(g.normals).buffer);
    const normView = pushView(normBytes, 34962);
    const normAccessor = accessors.length;
    accessors.push({ bufferView: normView, componentType: 5126, count: g.normals.length / 3, type: "VEC3" });

    // Indices (unsigned short scalar).
    const idxBytes = new Uint8Array(new Uint16Array(g.indices).buffer);
    const idxView = pushView(idxBytes, 34963);
    const idxAccessor = accessors.length;
    accessors.push({ bufferView: idxView, componentType: 5123, count: g.indices.length, type: "SCALAR" });

    meshes.push({
      primitives: [{ attributes: { POSITION: posAccessor, NORMAL: normAccessor }, indices: idxAccessor, material: materialFor(part.material), mode: 4 }],
    });

    const node: Record<string, unknown> = { mesh: meshes.length - 1 };
    if (part.translation) node.translation = part.translation;
    if (part.rotation) node.rotation = eulerToQuat(part.rotation[0], part.rotation[1], part.rotation[2]);
    if (part.scale !== undefined) node.scale = typeof part.scale === "number" ? [part.scale, part.scale, part.scale] : part.scale;
    nodes.push(node);
  }

  const gltf = {
    asset: { version: "2.0", generator: "atlas-ops-globe/procedural" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };

  return packGlb(gltf, Uint8Array.from(bin));
}

/** Pack a glTF JSON object + binary buffer into the GLB container format. */
function packGlb(gltf: object, binary: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLen = align4(json.length);
  const binLen = align4(binary.length);
  const total = 12 + 8 + jsonLen + 8 + binLen;

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  let o = 0;
  // Header.
  dv.setUint32(o, MAGIC, true); o += 4;
  dv.setUint32(o, 2, true); o += 4;
  dv.setUint32(o, total, true); o += 4;
  // JSON chunk (pad with spaces).
  dv.setUint32(o, jsonLen, true); o += 4;
  dv.setUint32(o, JSON_CHUNK, true); o += 4;
  out.set(json, o);
  for (let i = json.length; i < jsonLen; i++) out[o + i] = 0x20;
  o += jsonLen;
  // BIN chunk (pad with zeros).
  dv.setUint32(o, binLen, true); o += 4;
  dv.setUint32(o, BIN_CHUNK, true); o += 4;
  out.set(binary, o);
  o += binLen;
  return out;
}
