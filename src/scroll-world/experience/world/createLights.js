import { DirectionalLight } from 'three';

const ELECTRIC_500 = 0x2f8bff;
const ROYAL_600 = 0x2540b0;

/** Two sources only, never a third (Lighting Bible, Section 12). Key carries
 *  the scene's accent from upper-right; fill carries the constant royal-blue
 *  floor from lower-left. Neither is a point/spot falloff light -- both read
 *  as broad, even washes, matching the CSS glow blobs this doctrine was
 *  derived from. */
export function createLights() {
  const key = new DirectionalLight(ELECTRIC_500, 3.8);
  key.position.set(13, 15, 9);
  key.target.position.set(0, 1, -16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0015;

  const fill = new DirectionalLight(ROYAL_600, 1.4);
  fill.position.set(-14, 8, -6);
  fill.target.position.set(0, 1, -16);

  return { key, fill };
}
