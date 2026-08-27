/**
 * Stub for `@spz-loader/core` (Cesium 1.144+ Gaussian-Splat loader).
 *
 * The real package inlines its WASM decoder as a template literal full of raw
 * NUL/control bytes. Turbopack re-encodes those bytes as octal escapes inside
 * the template literal (`\0`, `\00`) — illegal in template strings — so the
 * whole globe chunk fails to parse in the browser and the 3D view hangs on
 * "INITIALIZING GLOBAL VIEW". We don't render Gaussian splats, so aliasing the
 * package to this stub (see next.config.ts turbopack.resolveAlias) drops the
 * broken WASM entirely. If splats are ever needed, remove the alias and solve
 * the Turbopack octal-escape issue at its root instead.
 */
function unsupported(): never {
  throw new Error("@spz-loader/core is stubbed out (Gaussian Splatting not enabled)");
}

export function loadSpz(): never {
  return unsupported();
}

export function loadSpzFromUrl(): never {
  return unsupported();
}
