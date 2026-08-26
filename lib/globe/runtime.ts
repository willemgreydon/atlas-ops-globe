/**
 * Globe runtime registry.
 *
 * A tiny module-level holder that lets React UI (command palette, perf panel,
 * quality selector) reach the imperative globe managers without prop-drilling
 * through the render tree. The Globe component publishes into it on mount and
 * clears it on unmount. There is exactly one viewer (mission §113).
 */
import type { Viewer } from "cesium";
import type { GlobePerformanceManager } from "./performance";
import type { GlobeCameraController } from "./camera";
import type { LodController } from "./lod";

export interface GlobeRuntime {
  viewer: Viewer;
  performance: GlobePerformanceManager;
  camera: GlobeCameraController;
  lod: LodController;
}

let current: GlobeRuntime | null = null;
const listeners = new Set<(r: GlobeRuntime | null) => void>();

export function setGlobeRuntime(r: GlobeRuntime | null): void {
  current = r;
  // Dev-only handle for diagnostics / e2e probes (mission §117). Never in prod.
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    (window as unknown as { __globe?: GlobeRuntime | null }).__globe = r;
  }
  for (const fn of listeners) fn(r);
}

export function getGlobeRuntime(): GlobeRuntime | null {
  return current;
}

/** Subscribe to runtime availability (fires immediately with the current value). */
export function onGlobeRuntime(fn: (r: GlobeRuntime | null) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
