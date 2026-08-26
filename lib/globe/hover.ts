/**
 * Hover channel (mission §63 — hover tooltip).
 *
 * A minimal module-level pub/sub bridging the imperative Cesium pick loop (which
 * runs outside React, in `Globe.tsx`'s `MOUSE_MOVE` handler) to the declarative
 * `GlobeTooltip` overlay. Kept out of the app store so high-frequency pointer
 * updates never trigger a context re-render of the whole tree.
 */

export interface HoverInfo {
  /** Canvas-space pointer position, in CSS pixels. */
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  /** Domain kind (aircraft/vessel/…/cluster) — drives the accent colour. */
  kind: string;
  /** Optional CSS accent colour for the swatch. */
  color?: string;
}

let current: HoverInfo | null = null;
const listeners = new Set<(h: HoverInfo | null) => void>();

export function setHover(info: HoverInfo | null): void {
  current = info;
  for (const l of listeners) l(info);
}

export function getHover(): HoverInfo | null {
  return current;
}

export function subscribeHover(fn: (h: HoverInfo | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
