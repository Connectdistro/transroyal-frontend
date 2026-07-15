/**
 * Single manifest describing every production asset (Production Handbook
 * Section 26, Asset Pipeline). Generic by design — Resources never branches
 * on an asset's id; adding a new scene's assets is a manifest-only change.
 *
 * Each entry: { id, type, path, group, preload }
 *   type:    'texture' | 'cubeTexture' | 'hdr' | 'gltf' | 'video'
 *   group:   'core' | 'environment' | 'scene' | 'ui' | 'video'
 *   preload: whether this asset loads as part of its group's preload pass
 *
 * `path` is `null | string | string[]` — cube textures take an ordered array
 * of six face paths; every other type takes a single path. Empty today; no
 * production assets exist yet.
 */
export const MANIFEST = [];
