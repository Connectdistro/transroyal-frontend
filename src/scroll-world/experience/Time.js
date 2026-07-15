/**
 * Owns animation timing for the Three.js world (Production Handbook Section
 * 9). Computes delta/elapsed each frame and dispatches `tick`; it does not
 * drive its own requestAnimationFrame loop — the Experience class owns the
 * render loop and calls `tick()` once per frame.
 */
export class Time extends EventTarget {
  constructor() {
    super();
    this.start = Date.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 16;
  }

  tick() {
    const currentTime = Date.now();
    this.delta = currentTime - this.current;
    this.current = currentTime;
    this.elapsed = this.current - this.start;
    this.dispatchEvent(new Event('tick'));
  }
}
