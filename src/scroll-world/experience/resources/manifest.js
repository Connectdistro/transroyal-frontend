/**
 * Single manifest describing every production asset (Production Handbook
 * Section 26, Asset Pipeline). Generic by design — Resources never branches
 * on an asset's id; adding a new scene's assets is a manifest-only change.
 *
 * Each entry: { id, type, path, group, preload }
 *   type:    'texture' | 'cubeTexture' | 'hdr' | 'gltf' | 'video' | 'generatedEnvMap'
 *   group:   'core' | 'environment' | 'scene' | 'ui' | 'video'
 *   preload: whether this asset loads as part of its group's preload pass
 *
 * `path` is `null | string | string[]` — cube textures take an ordered array
 * of six face paths; every other type takes a single path; `generatedEnvMap`
 * takes `null` (it has no source file, see loaders.js).
 *
 * The `world-environment` entry below is a fallback, not a permanent asset
 * (Cinematic Polish Phase, Commit 1): `Environment.js` has always looked up
 * this exact id, but nothing registered it until now, so `scene.environment`
 * was previously dead code. Upgrading to a real photographic HDR later is a
 * manifest-only change — flip `type` to `'hdr'` and `path` to a real file;
 * `Environment.js` and every other consumer need no change either way.
 */
export const MANIFEST = [
  { id: 'world-environment', type: 'generatedEnvMap', path: null, group: 'environment', preload: true },
];
