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
import { box, cylinder, extrude, buildGlb, type Material, type Part } from "./gltf";

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
const FUSELAGE: Material = { color: [0.93, 0.94, 0.97, 1], metallic: 0.15, roughness: 0.35 }; // painted airframe
const WING: Material = { color: [0.82, 0.84, 0.88, 1], metallic: 0.6, roughness: 0.35, doubleSided: true };
const LIVERY: Material = { color: [0.13, 0.42, 0.75, 1], metallic: 0.3, roughness: 0.4, doubleSided: true }; // tail/cheatline accent
const GLASS: Material = { color: [0.08, 0.12, 0.18, 1], metallic: 0.5, roughness: 0.15 }; // cockpit windows
const ENGINE: Material = { color: [0.22, 0.24, 0.28, 1], metallic: 0.7, roughness: 0.4 };
const INLET: Material = { color: [0.05, 0.06, 0.08, 1], metallic: 0.3, roughness: 0.6 }; // dark fan face
const ROTOR: Material = { color: [0.10, 0.11, 0.13, 1], metallic: 0.2, roughness: 0.7, doubleSided: true };

// Axis-mapping rotations for cylinders (their native axis is +Y).
const AXIS_FWD: [number, number, number] = [0, 0, -Math.PI / 2]; // +Y → +X (forward)
const AXIS_DOWN: [number, number, number] = [-Math.PI / 2, 0, 0]; // +Y → −Z (nadir)
const AXIS_UP: [number, number, number] = [Math.PI / 2, 0, 0]; // +Y → +Z (zenith)
const STAND_UP: [number, number, number] = [Math.PI / 2, 0, 0]; // rotate a Z-extruded planform upright (Y-height → Z)

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
  | "aircraft-light"
  | "aircraft-heli"
  | "vessel-cargo";

export const MODEL_KEYS: ModelKey[] = [
  "sat-comms", "sat-leo", "sat-nav", "sat-eo", "sat-station",
  "sat-rocket", "sat-debris", "sat-generic",
  "aircraft-airliner", "aircraft-light", "aircraft-heli", "vessel-cargo",
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

/**
 * A swept, tapered flat lifting surface (wing / stabiliser) extending from the
 * root at Y=0 out to `ySign·span`, leading edge forward (+X) and swept back by
 * `sweep`. Real wing shapes a box can't make — this is what fixes the "plank".
 */
function liftingSurface(rootChord: number, tipChord: number, span: number, sweep: number, ySign: 1 | -1, thickness = 0.3) {
  const yTip = ySign * span;
  const leRoot = rootChord * 0.55; // leading edge sits ahead of the mount point
  const teRoot = -rootChord * 0.45;
  const leTip = leRoot - sweep;
  const teTip = leTip - tipChord;
  return extrude([[leRoot, 0], [leTip, yTip], [teTip, yTip], [teRoot, 0]], thickness);
}

/** Twin-engine narrowbody airliner — the workhorse silhouette (A320/737 scale). */
function airliner(): Part[] {
  const parts: Part[] = [];
  // Fuselage: main tube, tapered nose, upswept tail cone.
  parts.push({ geometry: cylinder(1.95, 1.95, 28, 24), material: FUSELAGE, rotation: AXIS_FWD });
  parts.push({ geometry: cylinder(1.95, 0.4, 6, 24), material: FUSELAGE, rotation: AXIS_FWD, translation: [17, 0, 0] });
  parts.push({ geometry: cylinder(1.95, 0.55, 8, 24), material: FUSELAGE, rotation: AXIS_FWD, translation: [-18, 0, 0.7] });
  // Wraparound cockpit glass near the nose.
  parts.push({ geometry: box(2.6, 3.0, 0.75), material: GLASS, translation: [13.2, 0, 0.9] });

  const wingX = -2.0, wingZ = -1.0, span = 17, sweep = 8;
  for (const s of [1, -1] as const) {
    // Low-mounted swept wing.
    parts.push({ geometry: liftingSurface(6.2, 1.6, span, sweep, s, 0.34), material: WING, translation: [wingX, 0, wingZ] });
    // Upturned winglet at the tip.
    parts.push({ geometry: box(1.6, 0.16, 1.8), material: WING, translation: [wingX - sweep, s * span, wingZ + 0.85], rotation: [s * 0.22, 0, 0] });
    // Underslung engine nacelle (forward of & below the wing) with a dark fan face.
    parts.push({ geometry: cylinder(1.05, 1.05, 4.2, 20), material: ENGINE, rotation: AXIS_FWD, translation: [wingX + 2.6, s * 6.2, wingZ - 1.7] });
    parts.push({ geometry: cylinder(1.12, 0.95, 0.5, 20), material: INLET, rotation: AXIS_FWD, translation: [wingX + 4.85, s * 6.2, wingZ - 1.7] });
    // Swept horizontal stabiliser.
    parts.push({ geometry: liftingSurface(3.2, 1.0, 6, 3, s, 0.28), material: WING, translation: [-16.5, 0, 0.6] });
  }
  // Swept vertical fin, stood upright, in the livery colour.
  parts.push({ geometry: extrude([[-13.5, 0], [-16.2, 6], [-18.4, 6], [-18.5, 0]], 0.36), material: LIVERY, rotation: STAND_UP, translation: [0, 0, 1.6] });
  return parts;
}

/** Light single-engine prop (high-wing, Cessna-ish) — slow, low-altitude traffic. */
function lightAircraft(): Part[] {
  const parts: Part[] = [];
  parts.push({ geometry: cylinder(0.7, 0.7, 5.2, 18), material: WHITE, rotation: AXIS_FWD });
  parts.push({ geometry: cylinder(0.7, 0.35, 1.6, 18), material: WHITE, rotation: AXIS_FWD, translation: [3.4, 0, 0] });
  parts.push({ geometry: cylinder(0.7, 0.28, 3.2, 18), material: WHITE, rotation: AXIS_FWD, translation: [-4.1, 0, 0.25] });
  parts.push({ geometry: box(1.5, 1.34, 0.7), material: GLASS, translation: [1.3, 0, 0.55] });
  for (const s of [1, -1] as const) {
    // High straight wing (barely tapered, no sweep) + a bracing strut.
    parts.push({ geometry: liftingSurface(1.6, 1.15, 5.6, 0.4, s, 0.22), material: WING, translation: [0.2, 0, 0.95] });
    parts.push({ geometry: box(0.14, 0.14, 1.15), material: ALUM, translation: [0.2, s * 2.6, 0.4], rotation: [s * 0.5, 0, 0] });
  }
  // Spinner + a crossed two-blade prop at the nose.
  parts.push({ geometry: cylinder(0.26, 0.05, 0.5, 12), material: DARK, rotation: AXIS_FWD, translation: [5.2, 0, 0] });
  parts.push({ geometry: box(0.06, 0.22, 2.6), material: DARK, translation: [5.1, 0, 0] });
  parts.push({ geometry: box(0.06, 2.6, 0.22), material: DARK, translation: [5.1, 0, 0] });
  for (const s of [1, -1] as const) parts.push({ geometry: liftingSurface(1.1, 0.6, 1.9, 0.3, s, 0.2), material: WING, translation: [-5.2, 0, 0.35] });
  parts.push({ geometry: extrude([[-4.4, 0], [-5.4, 1.7], [-6.4, 1.7], [-6.3, 0]], 0.2), material: WING, rotation: STAND_UP, translation: [0, 0, 0.4] });
  return parts;
}

/** Helicopter — slow, low & hovering traffic gets a rotorcraft, not a jet. */
function helicopter(): Part[] {
  const parts: Part[] = [];
  // Cabin pod + glass nose bubble.
  parts.push({ geometry: cylinder(1.15, 1.15, 3.4, 18), material: WHITE, rotation: AXIS_FWD });
  parts.push({ geometry: cylinder(1.15, 0.45, 1.9, 18), material: GLASS, rotation: AXIS_FWD, translation: [2.5, 0, -0.1] });
  // Tapering tail boom + upright tail fin.
  parts.push({ geometry: cylinder(0.34, 0.2, 5.6, 12), material: WHITE, rotation: AXIS_FWD, translation: [-4.4, 0, 0.4] });
  parts.push({ geometry: extrude([[-6.7, 0], [-7.1, 1.5], [-7.7, 1.5], [-7.5, 0]], 0.16), material: WHITE, rotation: STAND_UP, translation: [0, 0, 0.5] });
  // Mast + hub + three main-rotor blades.
  parts.push({ geometry: cylinder(0.16, 0.16, 1.0, 10), material: DARK, rotation: AXIS_UP, translation: [0.2, 0, 2.1] });
  parts.push({ geometry: cylinder(0.3, 0.3, 0.3, 10), material: DARK, rotation: AXIS_UP, translation: [0.2, 0, 2.6] });
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    parts.push({ geometry: box(7.2, 0.34, 0.06), material: ROTOR, translation: [0.2, 0, 2.62], rotation: [0, 0, a] });
  }
  // Tail rotor (two blades, in the vertical plane at the boom tip).
  parts.push({ geometry: box(0.06, 0.18, 2.4), material: ROTOR, translation: [-7.5, 0.3, 0.7] });
  // Landing skids.
  for (const s of [1, -1] as const) {
    parts.push({ geometry: box(3.8, 0.14, 0.14), material: DARK, translation: [0.2, s * 1.05, -1.6] });
    parts.push({ geometry: box(0.12, 0.12, 1.2), material: DARK, translation: [1.1, s * 1.05, -1.0] });
    parts.push({ geometry: box(0.12, 0.12, 1.2), material: DARK, translation: [-0.7, s * 1.05, -1.0] });
  }
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
  "aircraft-light": lightAircraft,
  "aircraft-heli": helicopter,
  "vessel-cargo": cargoVessel,
};

/** Build the raw GLB bytes for a model archetype (pure — no browser APIs). */
export function buildModel(key: ModelKey): Uint8Array {
  return buildGlb(BUILDERS[key]());
}
