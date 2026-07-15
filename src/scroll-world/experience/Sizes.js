/**
 * Owns viewport measurement for the Three.js world (Production Handbook
 * Section 9). Reads its dimensions from the world canvas's fixed-position
 * container rather than the window directly, and re-measures on every
 * window resize, dispatching `resize` for the Camera and Renderer to react to.
 */
export class Sizes extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    this.resize();

    window.addEventListener('resize', () => {
      this.resize();
      this.dispatchEvent(new Event('resize'));
    });
  }

  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
  }
}
