import { EventEmitter } from './utils/EventEmitter.js';
import { MANIFEST } from './resources/manifest.js';
import { LOADERS } from './resources/loaders.js';

/**
 * Single gateway for every runtime asset (Production Handbook Section 26/27).
 * No other runtime system creates a loader directly — everything downstream
 * asks Resources for an asset by id and receives the cached instance on every
 * subsequent request. Emits `progress`, `ready`, and `error` through the
 * shared EventEmitter; never throws past a failed optional asset.
 */
export class Resources extends EventEmitter {
  constructor(experience) {
    super();
    this.experience = experience;
    this.manifest = MANIFEST;
    this.items = new Map();
    this.pending = new Map();
  }

  find(id) {
    return this.manifest.find((entry) => entry.id === id);
  }

  get(id) {
    return this.items.get(id);
  }

  has(id) {
    return this.items.has(id);
  }

  /** Loads one asset by manifest id. Cached after the first successful load;
   *  a second call for the same id, in flight or already resolved, never
   *  triggers a second network request. */
  load(id) {
    if (this.items.has(id)) return Promise.resolve(this.items.get(id));
    if (this.pending.has(id)) return this.pending.get(id);

    const entry = this.find(id);
    if (!entry) return Promise.reject(new Error(`Unknown asset id: ${id}`));

    const loader = LOADERS[entry.type];
    if (!loader) return Promise.reject(new Error(`Unknown asset type: ${entry.type}`));

    // Cinematic Polish Phase: a second, optional context argument every
    // existing loader (texture/cubeTexture/hdr/gltf/video) simply ignores
    // -- only the `generatedEnvMap` loader reads it (it needs a live
    // renderer, unlike the others' module-scope loader instances).
    // Resources still dispatches purely on `entry.type`; no id-branching.
    const promise = loader(entry.path, { renderer: this.experience.renderer, scene: this.experience.scene })
      .then((asset) => {
        this.items.set(id, asset);
        this.pending.delete(id);
        return asset;
      })
      .catch((error) => {
        this.pending.delete(id);
        this.emit('error', { id, error });
        return null;
      });

    this.pending.set(id, promise);
    return promise;
  }

  /** Loads every manifest entry belonging to `group`. A failed asset is
   *  reported via `error` and counted toward progress, but never blocks the
   *  rest of the group — the application keeps running with that one asset
   *  missing. Resolves once every entry in the group has settled. */
  loadGroup(group) {
    const entries = this.manifest.filter((entry) => entry.group === group);
    const total = entries.length;

    if (total === 0) {
      this.emit('ready', { group });
      return Promise.resolve([]);
    }

    let loaded = 0;
    const settled = entries.map((entry) =>
      this.load(entry.id).then((asset) => {
        loaded += 1;
        this.emit('progress', { group, loaded, total, ratio: loaded / total });
        return asset;
      })
    );

    return Promise.all(settled).then((assets) => {
      this.emit('ready', { group });
      return assets;
    });
  }

  /** Distinct groups carrying at least one `preload: true` entry — the
   *  grouping system only; nothing here triggers a load automatically. */
  preloadGroups() {
    return [...new Set(this.manifest.filter((entry) => entry.preload).map((entry) => entry.group))];
  }
}
