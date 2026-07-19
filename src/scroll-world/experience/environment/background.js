import { CanvasTexture, SRGBColorSpace } from 'three';

// Dark and desaturated enough to stay recessive behind every chapter's own
// lit foreground, matching the world's warm gold/amber lighting doctrine
// (shots.js's LIGHT_TINTS).
const UMBER_950 = '#120d08';
const UMBER_900 = '#2e1f10';

/**
 * A vertical warm gradient baked once into a CanvasTexture and set as
 * `scene.background` -- the renderer's own background (Production Handbook
 * Section 10), never a CSS layer.
 */
export function createBackgroundGradient() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;

  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, UMBER_950);
  gradient.addColorStop(0.45, UMBER_900);
  gradient.addColorStop(1, UMBER_950);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
