/**
 * Lazy model registry (browser side · mission §85).
 *
 * Turns a `ModelKey` into a blob-URL Cesium's `Model` can load. Each archetype's
 * GLB is generated on first request and cached, so thousands of entities sharing
 * an archetype cost one build and one URL. Cesium in turn caches the loaded model
 * by URL, so the GPU upload is shared too.
 */
import { buildModel, type ModelKey } from "./catalog";

const urls = new Map<ModelKey, string>();

/** Blob URL for an archetype's GLB, built and cached on first use. */
export function modelUrl(key: ModelKey): string {
  const cached = urls.get(key);
  if (cached) return cached;
  const blob = new Blob([buildModel(key).buffer as ArrayBuffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  return url;
}

/** Revoke every cached blob URL (call on globe teardown to free memory). */
export function disposeModels(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
