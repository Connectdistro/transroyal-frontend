/**
 * Cinematic Polish Phase, Commit 5: small, deterministic per-instance
 * material variation ("no perfectly uniform materials") -- construction
 * time only, never called from any `update()`, so it costs nothing per
 * frame. Deterministic from `seed` (a simple mulberry32-style PRNG, no new
 * dependency) rather than `Math.random()`, so a given instance's variation
 * is reproducible across builds/reloads, not a new roll every page load.
 *
 * Bounds are deliberately narrow -- this nudges the existing flat-color
 * authored materials, it doesn't repaint them. No textures, no UV changes,
 * no per-vertex color: every material touched here stays exactly the same
 * `MeshStandardMaterial`/`MeshPhysicalMaterial` type it already was, just
 * with slightly different roughness/metalness/hue per instance.
 */

const ROUGHNESS_JITTER = 0.08;
const METALNESS_JITTER = 0.06;
const HUE_JITTER = 0.015;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mutates `material` in place -- no return value, matching this file's
 *  construction-time-only contract. `seed` is typically an instance index
 *  (a truck's lane index, a parcel's loop index), not anything randomized
 *  per page load. */
export function varyMaterial(material, seed) {
  const random = mulberry32(seed);

  if (typeof material.roughness === 'number') {
    material.roughness = Math.min(1, Math.max(0, material.roughness + (random() - 0.5) * ROUGHNESS_JITTER * 2));
  }
  if (typeof material.metalness === 'number') {
    material.metalness = Math.min(1, Math.max(0, material.metalness + (random() - 0.5) * METALNESS_JITTER * 2));
  }
  if (material.color) {
    material.color.offsetHSL(0, 0, (random() - 0.5) * HUE_JITTER * 2);
    material.color.offsetHSL((random() - 0.5) * HUE_JITTER, 0, 0);
  }
}
