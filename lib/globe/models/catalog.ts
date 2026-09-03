/**
 * Procedural model catalog (mission §85).
 *
 * Every tracked object that deserves a real silhouette when you fly close to it
 * is authored here as a composition of primitives — no binary assets. Models are
 * built in a consistent body frame so a single orientation quaternion places any
 * of them on the globe:
 *
 *   +X = forward (heading / velocity)     +Y = left       +Z = up (zenith)
 *
 * so instrument faces on −Z point at Earth's surface once oriented. Dimensions
 * are in metres and set *proportions*; on-screen size is governed by the layer's
 * `minimumPixelSize`, so a GEO comsat and a smallsat read at a similar scale.
 */
import { box, cylinder, buildGlb, type Material, type Part } from "./gltf";

// --- shared PBR palette -----------------------------------------------------

const GOLD: Material = { color: [0.72, 0.53, 0.15, 1], metallic: 1, roughness: 0.35 }; // MLI thermal foil
const PANEL: Material = { color: [0.05, 0.11, 0.33, 1], metallic: 0.2, roughness: 0.4, emissive: [0.02, 0.05, 0.18], doubleSided: true }; // solar cells
const ALUM: Material = { color: [0.80, 0.82, 0.86, 1], metallic: 0.85, roughness: 0.35 };
const WHITE: Material = { color: [0.90, 0.92, 0.96, 1], metallic: 0.1, roughness: 0.55 };
const DARK: Material = { color: [0.18, 0.20, 0.24, 1], metallic: 0.4, roughness: 0.7 };
const DISH: Material = { color: [0.86, 0.87, 0.91, 1], metallic: 0.3, roughness: 0.45, doubleSided: true };
const ANTENNA: Material = { color: [0.70, 0.72, 0.76, 1], metallic: 0.8, roughness: 0.4 };
const HULL: Material = { color: [0.60, 0.13, 0.14, 1], metallic: 0.2, roughness: 0.55 };
const DECK: Material = { color: [0.34, 0.36, 0.40, 1], metallic: 0.2, roughness: 0.7 };

// Axis-mapping rotations for cylinders (their native axis is +Y).
const AXIS_FWD: [number, number, number] = [0, 0, -Math.PI / 2]; // +Y → +X (forward)
const AXIS_DOWN: [number, number, number] = [-Math.PI / 2, 0, 0]; // +Y → −Z (nadir)

export type ModelKey =
  | "sat-comms"
  | "sat-leo"
  | "sat-nav"
  | "sat-eo"
  | "sat-station"
  | "sat-rocket"
  | "sat-debris"
  | "sat-generic"
  | "aircraft-airliner"
  | "vessel-cargo";

export const MODEL_KEYS: ModelKey[] = [
  "sat-comms", "sat-leo", "sat-nav", "sat-eo", "sat-station",
  "sat-rocket", "sat-debris", "sat-generic", "aircraft-airliner", "vessel-cargo",
];

/** Central bus + a pair of solar wings on ±Y — the shape most satellites share. */
function busWithWings(bus: [number, number, number], wingChord: number, wingSpan: number, gap: number): Part[] {
  const halfY = bus[1] / 2;
  const wingCentre = halfY + gap + wingSpan / 2;
  return [
    { geometry: box(bus[0], bus[1], bus[2]), material: GOLD },
    // Booms out to each wing.
    { geometry: box(0.25, gap, 0.25), material: ANTENNA, translation: [0, halfY + gap / 2, 0] },
    { geometry: box(0.25, gap, 0.25), material: ANTENNA, translation: [0, -(halfY + gap / 2), 0] },
    // Flat solar arrays (broad in X/Y, thin in Z).
    { geometry: box(wingChord, wingSpan, 0.14), material: PANEL, translation: [0, wingCentre, 0] },
    { geometry: box(wingChord, wingSpan, 0.14), material: PANEL, translation: [0, -wingCentre, 0] },
  ];
}

function commsGeo(): Part[] {
  return [
    ...busWithWings([6, 5, 5], 4.5, 13, 2.5),
    // Steerable communications dish on the nadir (−Z) face.
    { geometry: cylinder(0.4, 3, 1.4, 24), material: DISH, rotation: AXIS_DOWN, translation: [0, 0, -3.4] },
    { geometry: cylinder(0.12, 0.12, 1.6, 8), material: ANTENNA, rotation: AXIS_DOWN, translation: [0, 0, -2.4] },
    // A second smaller uplink dish, offset.
    { geometry: cylinder(0.3, 1.4, 0.8, 20), material: DISH, rotation: AXIS_DOWN, translation: [1.6, 1.2, -3] },
  ];
}

function leoSmallsat(): Part[] {
  return [
    { geometry: box(2.2, 1.3, 2.8), material: GOLD },
    // Single canted array (Starlink-like) plus its boom.
    { geometry: box(0.2, 3.4, 0.2), material: ANTENNA, translation: [0, 3.1, 0] },
    { geometry: box(2.6, 7.2, 0.1), material: PANEL, translation: [0, 8.4, 0] },
    // Flat phased-array antenna panel on nadir.
    { geometry: box(2, 2, 0.18), material: DARK, translation: [0, 0, -0.85] },
    { geometry: box(1.9, 1.9, 0.06), material: ALUM, translation: [0, 0, -0.96] },
  ];
}

function navigation(): Part[] {
  const parts = busWithWings([3, 3, 3], 3, 9, 2);
  // Earth-coverage helical antenna farm on the nadir face.
  for (const [dx, dy] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]] as const) {
    parts.push({ geometry: cylinder(0.3, 0.3, 1.8, 10), material: ANTENNA, rotation: AXIS_DOWN, translation: [dx, dy, -2.4] });
  }
  return parts;
}

function earthObs(): Part[] {
  return [
    ...busWithWings([3, 2.6, 3], 2.6, 8, 1.8),
    // Nadir-staring telescope barrel with a bright aperture ring.
    { geometry: cylinder(1.25, 1.25, 4.2, 24), material: DARK, rotation: AXIS_DOWN, translation: [0, 0, -3.4] },
    { geometry: cylinder(1.35, 1.35, 0.35, 24), material: ALUM, rotation: AXIS_DOWN, translation: [0, 0, -5.4] },
    // A downlink dish offset on the anti-sun side.
    { geometry: cylinder(0.3, 1, 0.6, 18), material: DISH, rotation: AXIS_DOWN, translation: [1.4, 0, -2.2] },
  ];
}

function station(): Part[] {
  const parts: Part[] = [
    // Integrated truss running the full span (±Y).
    { geometry: box(2.6, 26, 1.1), material: ALUM },
    // Pressurised modules along the flight axis (±X).
    { geometry: cylinder(1.7, 1.7, 11, 20), material: WHITE, rotation: AXIS_FWD },
    { geometry: cylinder(1.5, 1.5, 6, 20), material: WHITE, rotation: [0, 0, 0], translation: [0, 0, 0] },
    { geometry: cylinder(1.3, 1.3, 5, 18), material: WHITE, rotation: AXIS_FWD, translation: [0, 4, 1.2] },
    { geometry: cylinder(1.3, 1.3, 5, 18), material: WHITE, rotation: AXIS_FWD, translation: [0, -4, 1.2] },
  ];
  // Four big solar-array pairs stepped out along the truss.
  for (const y of [9, 13.5]) {
    for (const s of [1, -1]) {
      parts.push({ geometry: box(8, 4.6, 0.1), material: PANEL, translation: [4.6, s * y, 0] });
      parts.push({ geometry: box(8, 4.6, 0.1), material: PANEL, translation: [-4.6, s * y, 0] });
    }
  }
  // White thermal radiators perpendicular to the arrays.
  parts.push({ geometry: box(0.12, 7, 5), material: WHITE, translation: [0, 5.5, -1.5] });
  parts.push({ geometry: box(0.12, 7, 5), material: WHITE, translation: [0, -5.5, -1.5] });
  return parts;
}

function rocketBody(): Part[] {
  return [
    // Spent stage tank.
    { geometry: cylinder(1.6, 1.6, 9, 22), material: ALUM, rotation: AXIS_FWD },
    { geometry: cylinder(1.62, 1.62, 0.5, 22), material: DARK, rotation: AXIS_FWD, translation: [2.5, 0, 0] },
    // Nozzle bell at the aft (−X) end.
    { geometry: cylinder(0.5, 1.5, 2, 22), material: DARK, rotation: [0, 0, Math.PI / 2], translation: [-5.4, 0, 0] },
    // Forward interstage ring.
    { geometry: cylinder(1.55, 1.2, 1.2, 22), material: ALUM, rotation: AXIS_FWD, translation: [5, 0, 0] },
  ];
}

function debris(): Part[] {
  // A tumbling fragment: a torn shard, a crushed box, a snapped strut.
  return [
    { geometry: box(1.4, 0.9, 1.1), material: DARK, rotation: [0.5, 0.7, 0.2] },
    { geometry: box(0.7, 0.7, 1.0), material: ALUM, rotation: [1.1, 0.3, 0.9], translation: [0.9, 0.4, -0.3] },
    { geometry: box(2.2, 0.05, 0.9), material: PANEL, rotation: [0.2, 0.4, 1.3], translation: [-0.8, -0.3, 0.5] },
    { geometry: cylinder(0.12, 0.12, 2, 8), material: ANTENNA, rotation: [0.9, 0.2, 0.4], translation: [-0.4, 0.6, 0.2] },
  ];
}

function generic(): Part[] {
  return [
    ...busWithWings([2.6, 2.2, 2.6], 2.6, 6, 1.6),
    { geometry: cylinder(0.25, 0.9, 0.5, 16), material: DISH, rotation: AXIS_DOWN, translation: [0, 0, -1.8] },
  ];
}

function airliner(): Part[] {
  const parts: Part[] = [
    // Fuselage + nose cone (forward = +X).
    { geometry: cylinder(1.2, 1.2, 22, 20), material: WHITE, rotation: AXIS_FWD },
    { geometry: cylinder(1.2, 0.1, 3, 20), material: WHITE, rotation: [0, 0, Math.PI / 2], translation: [12.4, 0, 0] },
    { geometry: cylinder(1.2, 0.9, 1.5, 20), material: DARK, rotation: AXIS_FWD, translation: [-11.6, 0, 0] },
    // Main wings (slight dihedral read via a thin, broad plate) low on the body.
    { geometry: box(4.5, 26, 0.5), material: ALUM, translation: [0.5, 0, -0.6] },
    // Horizontal + vertical tail.
    { geometry: box(2.4, 9, 0.35), material: ALUM, translation: [-9.5, 0, 0.2] },
    { geometry: box(2.6, 0.35, 3.6), material: ALUM, translation: [-9.5, 0, 1.9] },
    // Two underslung engine nacelles.
    { geometry: cylinder(0.85, 0.85, 3.6, 16), material: DARK, rotation: AXIS_FWD, translation: [1.5, 5.2, -1.4] },
    { geometry: cylinder(0.85, 0.85, 3.6, 16), material: DARK, rotation: AXIS_FWD, translation: [1.5, -5.2, -1.4] },
  ];
  return parts;
}

function cargoVessel(): Part[] {
  const parts: Part[] = [
    // Hull + bow wedge (forward = +X), deck plate on top.
    { geometry: box(30, 6.4, 3.2), material: HULL, translation: [0, 0, -0.8] },
    { geometry: cylinder(1.6, 0.2, 4, 4), material: HULL, rotation: [0, 0, Math.PI / 2], translation: [16, 0, -0.8] },
    { geometry: box(30, 6.4, 0.4), material: DECK, translation: [0, 0, 1] },
    // Bridge superstructure + funnel, aft.
    { geometry: box(3.2, 5.2, 4), material: WHITE, translation: [-11, 0, 3.2] },
    { geometry: box(1.3, 1.8, 2.4), material: DARK, translation: [-12.5, 0, 6 ] },
  ];
  // Container stacks forward, a few colours so they read as cargo.
  const colours: Material[] = [
    { color: [0.65, 0.18, 0.16, 1], metallic: 0.2, roughness: 0.6 },
    { color: [0.15, 0.34, 0.55, 1], metallic: 0.2, roughness: 0.6 },
    { color: [0.20, 0.45, 0.28, 1], metallic: 0.2, roughness: 0.6 },
  ];
  let ci = 0;
  for (const x of [7, 1.5, -4]) {
    parts.push({ geometry: box(5.4, 5.4, 2.6), material: colours[ci % colours.length], translation: [x, 0, 2.6] });
    parts.push({ geometry: box(5.4, 5.4, 2.6), material: colours[(ci + 1) % colours.length], translation: [x, 0, 5.2] });
    ci++;
  }
  return parts;
}

const BUILDERS: Record<ModelKey, () => Part[]> = {
  "sat-comms": commsGeo,
  "sat-leo": leoSmallsat,
  "sat-nav": navigation,
  "sat-eo": earthObs,
  "sat-station": station,
  "sat-rocket": rocketBody,
  "sat-debris": debris,
  "sat-generic": generic,
  "aircraft-airliner": airliner,
  "vessel-cargo": cargoVessel,
};

/** Build the raw GLB bytes for a model archetype (pure — no browser APIs). */
export function buildModel(key: ModelKey): Uint8Array {
  return buildGlb(BUILDERS[key]());
}
