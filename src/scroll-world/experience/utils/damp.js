// Frame-rate-independent exponential-decay interpolation factor (the
// "damp"/half-life technique -- see Freya Holmer's "Lerp smoothing is
// broken" for the derivation). Used with three.js's own `.lerp()` /
// `Color.lerp()`, which mutate their target in place -- the project's
// existing convention (CameraRig already calls `Vector3.lerp` directly; no
// lerp wrapper class exists). A fixed per-tick lerp factor (the pre-Phase
// approach) implicitly assumes a constant frame interval; this instead
// converges at the same *rate* regardless of the delta between ticks, so a
// value blends over the same wall-clock duration on a 60Hz or a 144Hz
// display alike.
//
// `halfLifeMs`: time in milliseconds for the remaining distance to a target
// to halve. `deltaMs`: elapsed time since the last update (Time.js's
// `time.delta`).
export function dampFactor(halfLifeMs, deltaMs) {
  return 1 - 2 ** (-deltaMs / halfLifeMs);
}

// Shared defaults for Commit 1's per-region light/particle activity
// blending (World/*.js `update()` + camera-sync.js). Exported from here so
// there is exactly one canonical default even though an individual
// environment may override `this.activityFloor` with its own literal.
export const ACTIVITY_HALF_LIFE_MS = 500;
export const DEFAULT_ACTIVITY_FLOOR = 0.75;

// Cinematic Polish Phase, Commit 1: shared half-life for each region's
// key/fill light-color crossfade (scene-blend.js's LIGHT_TINTS mechanism,
// see each world/*Environment.js's setLightTint()). Same family as fog's
// own 400ms so light and fog read as one coordinated transition.
export const LIGHT_TINT_HALF_LIFE_MS = 400;
