import { DirectionalLight } from 'three';

// Every caller gets its own real value from shots.js's LIGHT_TINTS
// immediately at construction (see each EnvironmentJs file's own
// "Cinematic Polish Phase, Commit 1" comment) -- these two are only the
// function's own defaults.
const WARM_GOLD_500 = 0xffb347;
const WARM_UMBER_600 = 0x3d2f24;

/** Two sources only, never a third (Lighting Bible, Section 12). Key carries
 *  the scene's accent from upper-right; fill carries the constant warm-umber
 *  floor from lower-left. Neither is a point/spot falloff light -- both read
 *  as broad, even washes, matching the CSS glow blobs this doctrine was
 *  derived from.
 *
 *  Parameterized (Addendum 32.1) so every chapter's environment reuses this
 *  one rig rather than reimplementing it -- only position/color/intensity
 *  differ per chapter's own Section 23 spec; the two-source doctrine itself
 *  never does. Defaults reproduce Origin's original, unparameterized values
 *  exactly, so the existing `createLights()` call in OriginEnvironment is
 *  unchanged. */
export function createLights({
  keyColor = WARM_GOLD_500,
  keyIntensity = 3.8,
  keyPosition = [13, 15, 9],
  keyTarget = [0, 1, -16],
  fillColor = WARM_UMBER_600,
  fillIntensity = 1.4,
  fillPosition = [-14, 8, -6],
  fillTarget = keyTarget,
} = {}) {
  const key = new DirectionalLight(keyColor, keyIntensity);
  key.position.set(...keyPosition);
  key.target.position.set(...keyTarget);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0015;

  const fill = new DirectionalLight(fillColor, fillIntensity);
  fill.position.set(...fillPosition);
  fill.target.position.set(...fillTarget);

  return { key, fill };
}
