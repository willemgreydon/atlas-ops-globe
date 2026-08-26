/**
 * Static-entity render layer (mission §13 §74 · closes audit W1 for the
 * non-moving layers).
 *
 * Events, news and weather are fixed points, but the globe used to tear down and
 * rebuild their entire `CustomDataSource` on every feed poll (and every filter
 * toggle) — destroying and recreating every entity, churning GC and blinking the
 * layer. This is the static-data sibling of `MovingLayer`: it keeps a persistent
 * datasource and **diffs** incoming rows against live entities by id — adding
 * new, removing gone, updating changed ones in place. Identity is preserved
 * across polls, so selection, hover, camera-follow and the LOD registration all
 * survive a refresh.
 *
 * There is no motion model here: position is set once at add. A `version(row)`
 * signature detects content changes (an event's severity, a weather reading) and
 * applies them in place via `onUpdate`, so unchanged rows cost nothing on a poll.
 */
import { CustomDataSource, type Entity, type Cartesian3, type Viewer } from "cesium";
import type { Selection } from "@/stores/app-store";

export interface StaticLayerOptions<T extends { id: string }> {
  name: string;
  /** Fixed world position for a row (evaluated once, at add). */
  position: (row: T) => Cartesian3;
  /** Graphics for a new entity (point/label/…), without the position. */
  build: (row: T) => Entity.ConstructorOptions;
  /** Domain selection for click picking + hover. */
  selection: (row: T) => NonNullable<Selection>;
  /** Content signature; when it changes across a poll, `onUpdate` is applied. */
  version?: (row: T) => string;
  /** Apply changed content to a live entity in place (e.g. new severity colour). */
  onUpdate?: (entity: Entity, row: T) => void;
}

interface Track {
  entity: Entity;
  version: string;
}

export class StaticLayer<T extends { id: string }> {
  readonly ds: CustomDataSource;
  private viewer: Viewer;
  private opts: StaticLayerOptions<T>;
  private tracks = new Map<string, Track>();
  private selectionMap: WeakMap<Entity, NonNullable<Selection>>;
  private mounted = false;

  constructor(viewer: Viewer, selectionMap: WeakMap<Entity, NonNullable<Selection>>, opts: StaticLayerOptions<T>) {
    this.viewer = viewer;
    this.selectionMap = selectionMap;
    this.opts = opts;
    this.ds = new CustomDataSource(opts.name);
  }

  mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
  }

  /** Diff incoming rows against live entities by id. Never rebuilds the datasource. */
  update(rows: T[]): void {
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.id);
      const version = this.opts.version?.(row) ?? "";
      const existing = this.tracks.get(row.id);
      if (existing) {
        if (existing.version !== version) {
          this.opts.onUpdate?.(existing.entity, row);
          existing.version = version;
        }
      } else {
        this.add(row, version);
      }
    }
    for (const [id, track] of this.tracks) {
      if (!seen.has(id)) {
        this.ds.entities.remove(track.entity);
        this.selectionMap.delete(track.entity);
        this.tracks.delete(id);
      }
    }
  }

  private add(row: T, version: string): void {
    const entity = this.ds.entities.add({ ...this.opts.build(row), position: this.opts.position(row) });
    this.selectionMap.set(entity, this.opts.selection(row));
    this.tracks.set(row.id, { entity, version });
  }

  get size(): number {
    return this.tracks.size;
  }

  getEntity(id: string): Entity | undefined {
    return this.tracks.get(id)?.entity;
  }

  dispose(): void {
    if (this.mounted) this.viewer.dataSources.remove(this.ds, true);
    for (const [, track] of this.tracks) this.selectionMap.delete(track.entity);
    this.tracks.clear();
    this.mounted = false;
  }
}
