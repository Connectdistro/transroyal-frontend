import { CanvasTexture, SRGBColorSpace } from 'three';

const NAVY_950 = '#05081f';
const NAVY_900 = '#080f50';

/**
 * A vertical navy gradient baked once into a CanvasTexture and set as
 * `scene.background` -- the renderer's own background (Production Handbook
 * Section 10), never a CSS layer. Mirrors the brand's existing gradient
 * stops (navy-950 -> navy-900 -> navy-950) so the WebGL world and the DOM
 * interface share one background language.
 */
export function createBackgroundGradient() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;

  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, NAVY_950);
  gradient.addColorStop(0.45, NAVY_900);
  gradient.addColorStop(1, NAVY_950);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
