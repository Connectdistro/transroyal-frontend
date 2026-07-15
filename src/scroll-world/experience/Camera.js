import { PerspectiveCamera } from 'three';

/**
 * Production Handbook Section 11 (Camera Bible). Only the camera instance and
 * resize handling exist today — the scroll-driven master path is a later
 * production task, so `update()` is intentionally a no-op for now.
 */
export class Camera {
  constructor(experience) {
    this.experience = experience;
    this.sizes = experience.sizes;

    this.instance = new PerspectiveCamera(35, this.sizes.width / this.sizes.height || 1, 0.1, 1000);
    this.instance.position.set(0, 0, 5);
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height || 1;
    this.instance.updateProjectionMatrix();
  }

  update() {
    // Reserved for the Camera Bible's scroll-driven motion (Section 11) — no motion yet.
  }
}
