import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
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
    warnOnDuplicateIds(this.manifest);
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

  /** Returns an independent copy of a loaded asset, safe to add to more than
   *  one parent (a raw `get(id)` result is a single shared Object3D --
   *  adding it under a second parent reparents it rather than duplicating
   *  it, and two chapters both wanting five trucks from the same GLTF need
   *  five independent hierarchies). Synchronous, matching `get()`/`has()` --
   *  the asset must already be loaded (`await resources.load(id)` first);
   *  returns `null` rather than throwing if it isn't, the same
   *  fails-soft-on-missing-asset posture `load()` already takes.
   *
   *  GLTF assets (the only type this matters for) use SkeletonUtils.clone()
   *  rather than Object3D.prototype.clone() -- a plain clone breaks a
   *  SkinnedMesh's bone bindings and leaves AnimationClip target paths
   *  unresolvable against the copy; SkeletonUtils clones the full hierarchy
   *  (skeleton included) so both stay intact. Materials and geometries are
   *  NOT deep-cloned -- clones share the same material/geometry instances by
   *  design (matches this codebase's existing convention of cloning a
   *  material only when a caller actually needs to vary it, e.g.
   *  materialVariation.js's own per-instance `.clone()` calls) -- mutating a
   *  clone's shared material affects every other clone and the original.
   *
   *  Every other asset type (texture, hdr, video) is already safe to hand
   *  to multiple consumers directly -- three.js materials share texture
   *  references all the time -- so this returns the cached item as-is for
   *  anything that isn't GLTF-shaped, rather than a meaningless "clone." */
  clone(id) {
    const item = this.items.get(id);
    if (!item) return null;
    if (!item.scene) return item;

    return { ...item, scene: cloneSkeleton(item.scene) };
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

  /** Loads every group `preloadGroups()` names -- the one entry point that
   *  actually triggers automatic loading (`loadGroup()` still has to be
   *  called per-group by something; nothing did, until this). Today that's
   *  only the `environment` group (the generated env map) -- every
   *  production GLB in the manifest is `preload: false`, so this changes
   *  nothing about what downloads until a future commit flips a specific
   *  asset's flag once a chapter actually references it. Logs a load-time
   *  summary once every group has settled. */
  async preloadAll() {
    const start = performance.now();
    const groups = this.preloadGroups();
    const settled = await Promise.all(groups.map((group) => this.loadGroup(group)));
    const loadTimeMs = performance.now() - start;

    this.printManifestSummary({ loadTimeMs });
    return settled.flat();
  }

  /** Prints the manifest's own composition (registered counts per group) --
   *  purely descriptive, triggers no loading, safe to call at any time
   *  (including app startup, for visibility with zero behavioral risk).
   *  Pass `{ loadTimeMs }` (as `preloadAll()` does) to append a load-time
   *  line; omitted, the summary is composition-only. Memory is reported via
   *  `performance.memory` where the browser exposes it (Chromium-based
   *  only, non-standard) -- silently omitted elsewhere rather than guessed. */
  printManifestSummary({ loadTimeMs } = {}) {
    const counts = new Map();
    this.manifest.forEach((entry) => counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1));

    const lines = ['Production Asset Manifest', ''];
    counts.forEach((count, group) => lines.push(`${group.padEnd(20, '.')} ${count}`));
    lines.push('-'.repeat(30));
    lines.push(`${'Total Assets'.padEnd(20, '.')} ${this.manifest.length}`);
    if (loadTimeMs !== undefined) lines.push(`${'Load Time'.padEnd(20, '.')} ${loadTimeMs.toFixed(0)} ms`);
    if (typeof performance !== 'undefined' && performance.memory) {
      lines.push(`${'Memory'.padEnd(20, '.')} ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`);
    }

    const rule = '='.repeat(30);
    // eslint-disable-next-line no-console
    console.log([rule, ...lines.slice(0, 1), rule, '', ...lines.slice(2)].join('\n'));
  }
}

/** Constructor-time manifest validation -- duplicate ids would silently
 *  shadow each other in `Resources.items` (the second load overwrites the
 *  first under the same key), which is exactly the kind of authoring
 *  mistake worth catching immediately rather than debugging later. */
function warnOnDuplicateIds(manifest) {
  const seen = new Set();
  manifest.forEach((entry) => {
    if (seen.has(entry.id)) {
      // eslint-disable-next-line no-console
      console.warn(`Resources: duplicate manifest id "${entry.id}" -- the earlier entry will be shadowed.`);
    }
    seen.add(entry.id);
  });
}
