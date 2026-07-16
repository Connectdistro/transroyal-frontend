import { PerspectiveCamera, Vector3 } from 'three';
import { SHOTS, DEFAULT_SHOT_ID } from './shots.js';

// How quickly the live position/target/fov ease toward their desired values
// each frame (Section 11: camera movement is "slow, continuous, and
// legible"). Every setShot() call today is instant (see below), which snaps
// desired and live values together on arrival -- so this damping only comes
// into play once a future milestone starts moving the desired values over
// time (a scroll-driven setShot(..., { instant: false }) or a GSAP tween).
// Nothing animates yet.
const DAMPING = 0.08;

/**
 * The Production Camera (Handbook Section 11) -- a single rig shared by the
 * entire seven-chapter journey. It never branches on scene id: a caller hands
 * it a shot id (Section 23's per-chapter framing, authored in shots.js) and
 * the rig eases its live position/target/fov toward that shot. No scene ever
 * reaches into `instance.position` or calls `instance.lookAt()` directly --
 * that stays entirely inside this file.
 *
 * Position and target are tracked as plain Vector3s (`desiredPosition`,
 * `desiredTarget`) separate from Three's own camera transform, specifically
 * so a future GSAP tween can drive them directly --
 * `gsap.to(rig.desiredPosition, { x, y, z, duration })` -- without reaching
 * into rig internals or Three's camera API at all.
 *
 * `setProgress()` reserves the entry point the Scroll Engine (Section 16)
 * will call once later chapters exist to map scroll position onto camera
 * motion. It stores the value today and nothing else -- no shot mapping, no
 * animation. There is no OrbitControls and no debug rig anywhere in this
 * class; the scroll engine is the only intended future authority over camera
 * position (Section 16).
 */
export class CameraRig {
  constructor(experience) {
    this.experience = experience;
    this.sizes = experience.sizes;

    this.instance = new PerspectiveCamera(35, this.sizes.width / this.sizes.height || 1, 0.1, 1000);

    // Live look-at point. Kept separate from `instance.position` (which
    // Three's camera already owns) so the two can be authored, read, and
    // interpolated independently -- see the class doc above.
    this.target = new Vector3();

    // Interpolation goals. `instant` shots (every call today) snap these to
    // match the live values immediately; update() eases live -> desired every
    // frame regardless, so the mechanism is exercised even though it never
    // has any distance to close yet.
    this.desiredPosition = new Vector3().copy(this.instance.position);
    this.desiredTarget = new Vector3();
    this.desiredFov = this.instance.fov;

    this.progress = 0;
    this.activeShotId = null;

    this.setShot(DEFAULT_SHOT_ID);
  }

  /**
   * Points the rig at a named shot from shots.js. `instant` (the only mode
   * used anywhere today) snaps the live camera straight to the shot with no
   * easing, so the rendered frame is identical to a hand-set camera --
   * interpolation only engages once a future caller passes
   * `{ instant: false }` and lets update() close the distance over
   * subsequent frames.
   */
  setShot(shotId, { instant = true } = {}) {
    const shot = SHOTS[shotId];
    if (!shot) return;

    this.activeShotId = shotId;
    this.desiredPosition.set(shot.position.x, shot.position.y, shot.position.z);
    this.desiredTarget.set(shot.target.x, shot.target.y, shot.target.z);
    this.desiredFov = shot.fov;

    // Clip planes are a technical bound, not a cinematic parameter -- they
    // apply immediately regardless of `instant`, never eased like fov.
    this.instance.near = shot.near;
    this.instance.far = shot.far;
    this.instance.updateProjectionMatrix();

    if (instant) {
      this.instance.position.copy(this.desiredPosition);
      this.target.copy(this.desiredTarget);
      this.setFov(this.desiredFov);
      this.applyLookAt();
    }
  }

  setFov(fov) {
    if (this.instance.fov === fov) return;
    this.instance.fov = fov;
    this.instance.updateProjectionMatrix();
  }

  /**
   * Reserved entry point for the Scroll Engine (Section 16): stores scroll
   * progress (0 at Origin's opening frame, 1 at Delivered's closing frame)
   * for a future milestone to map onto shot interpolation. No camera motion
   * results from this call today -- it only records the value.
   */
  setProgress(progress) {
    this.progress = Math.min(1, Math.max(0, progress));
  }

  /**
   * The single abstraction over Three's lookAt. Everything that needs the
   * camera oriented goes through here rather than calling
   * `instance.lookAt()` directly, so a future up-vector or roll change is a
   * one-file edit.
   */
  applyLookAt() {
    this.instance.lookAt(this.target);
  }

  /** Camera update loop: called once per tick, ahead of the renderer, from
   *  Experience.update(). Eases live position/target/fov toward their
   *  desired values and re-applies lookAt every frame -- always, not only
   *  when a shot changes -- so a future scroll-driven desired-value change
   *  is picked up automatically with no extra wiring. */
  update() {
    this.instance.position.lerp(this.desiredPosition, DAMPING);
    this.target.lerp(this.desiredTarget, DAMPING);
    this.setFov(this.instance.fov + (this.desiredFov - this.instance.fov) * DAMPING);
    this.applyLookAt();
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height || 1;
    this.instance.updateProjectionMatrix();
  }
}
