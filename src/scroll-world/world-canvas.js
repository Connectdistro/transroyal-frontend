import { Experience } from './experience/Experience.js';

/**
 * Mounts the persistent Three.js world (Production Handbook Section 9). The
 * Experience class owns the renderer, scene, camera, and render loop — this
 * function only creates the canvas element and hands it off.
 */
export function mountWorldCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  container.appendChild(canvas);
  return new Experience(canvas);
}
