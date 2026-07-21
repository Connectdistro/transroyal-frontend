import { PerspectiveCamera, Vector3 } from 'three';
import { SHOTS, DEFAULT_SHOT_ID, DEFAULT_DRIFT } from './shots.js';
import { dampFactor } from '../utils/damp.js';

// How quickly the live position/target/fov ease toward their desired values
// (Section 11: camera movement is "slow, continuous, and legible"). A
// half-life, not a fixed per-tick factor (Cinematic Integration Phase,
// Commit 4) -- dampFactor() converges at the same *rate* regardless of the
// interval between frames, so easing speed no longer silently varies with
// display refresh rate. 140ms matches the feel of the original fixed 0.08
// factor at an implicit ~60fps baseline: solving `1 - 2^(-16.67/h) = 0.08`
// for h.
const POSITION_HALF_LIFE_MS = 140;

// Intra-chapter drift/parallax (Commit 4b) -- a bounded, self-canceling sway
// layered on top of the shot-easing above, activated via setProgress() (see
// its own doc below). The oscillation period a shot's own `drift.speed`
// multiplies against.
const DRIFT_PERIOD_MS = 5000;

// Cinematic Polish Phase, Commit 3: cursor-driven parallax, a third
// additive offset layered the same way drift is -- never touching
// desiredPosition/desiredTarget, so it can't alter shot composition or
// interfere with shot-to-shot easing. Amplitude deliberately at or below
// the existing drift's own (0.25) -- "subtle, never dramatic" per this
// phase's own constraint.
const CURSOR_HALF_LIFE_MS = 180;
const CURSOR_AMPLITUDE = 0.15;

// Cinematic Motion Refinement Phase, Commit 1: settle-overshoot, a fourth
// additive layer alongside drift/cursor -- armed only on a non-instant
// setShot() call to a genuinely new shot, it lets the camera slightly
// overshoot in the direction it was already moving, then swing back and
// settle, right as a new shot begins. Bounded (clamped below drift's own
// default amplitude) and self-terminating (decays via half-life, no
// persistent state once settled) -- never touches desiredPosition, so it
// can't alter a shot's authored composition, only decorate the approach
// to it.
const SETTLE_HALF_LIFE_MS = 260;
const SETTLE_PERIOD_MS = 420;
const SETTLE_MAX_AMPLITUDE = 0.22;

// Cinematic Motion Refinement Phase, Commit 1: subject lead, a small,
// generic, opt-in offset on `target` only -- same eased/clamped shape as
// cursor parallax. No region calls this by default; AirEnvironment.js
// wires it for its own aircraft (the one chapter genuinely built around
// tracking a single moving subject). Never touches desiredTarget.
const TARGET_LEAD_HALF_LIFE_MS = 220;
const TARGET_LEAD_MAX_AMPLITUDE = 1.2;

// Module-scope scratch vectors for the camera-relative right/up basis
// cursor parallax needs -- allocated once, reused every frame (zero
// per-frame allocation). Safe as module scope since CameraRig is a
// singleton (Experience.instance guards against a second instance ever
// existing).
const UNIT_X = new Vector3(1, 0, 0);
const UNIT_Y = new Vector3(0, 1, 0);
const scratchRight = new Vector3();
const scratchUp = new Vector3();
const scratchOldDesiredPosition = new Vector3();

/** Merges a shot's optional `drift` fields over DEFAULT_DRIFT (per-field,
 *  not all-or-nothing) and normalizes `axis` to a unit Vector3 once --
 *  called from setShot(), not every frame, since a shot's drift config
 *  only changes when the shot itself changes. */
function resolveDrift(drift) {
  const amplitude = drift?.amplitude ?? DEFAULT_DRIFT.amplitude;
  const speed = drift?.speed ?? DEFAULT_DRIFT.speed;
  const axis = drift?.axis ?? DEFAULT_DRIFT.axis;
  const axisVector = new Vector3(axis.x, axis.y, axis.z ?? 0);
  if (axisVector.lengthSq() > 0) axisVector.normalize();
  return { amplitude, speed, axisVector };
}

/**
 * The Production Camera (Handbook Section 11) -- a single rig shared by the
 * entire seven-chapter journey, and the ONLY class allowed to mutate the
 * camera transform (Cinematic Integration Phase architectural rule). Every
 * other module that influences the camera (camera-sync.js, scroll-progress.js)
 * only ever calls a semantic method here (`setShot`, `setProgress`) and
 * hands it data -- none of them reach into `instance.position`/`target`
 * themselves. It never branches on scene id: a caller hands it a shot id
 * (Section 23's per-chapter framing, authored in shots.js) and the rig
 * eases its live position/target/fov toward that shot, plus a small,
 * bounded, per-shot-configurable drift once mid-chapter (see update()).
 *
 * `setCursorInfluence(x, y)` (Commit 3) is pointer.js's entry point --
 * pointer.js only ever computes a 2D signal and calls this method; it never
 * touches `instance.position` itself, upholding the ownership rule above.
 * update() eases toward it and applies it as a small, camera-relative
 * screen-space nudge, a third additive offset alongside shot-easing and
 * drift.
 *
 * Position and target are tracked as plain Vector3s (`desiredPosition`,
 * `desiredTarget`) separate from Three's own camera transform, specifically
 * so a future GSAP tween can drive them directly --
 * `gsap.to(rig.desiredPosition, { x, y, z, duration })` -- without reaching
 * into rig internals or Three's camera API at all.
 *
 * `setProgress()` is the Scroll Engine's (Section 16) entry point, now live
 * (Commit 4b): scroll-progress.js calls it with a 0-1 value representing how
 * far scrolled through the *currently active* chapter, and update() uses it
 * to shape the drift envelope below -- exactly 0 at a chapter's own start/
 * end, so it never interferes with the shot-to-shot easing that owns chapter
 * boundaries. There is no OrbitControls and no debug rig anywhere in this
 * class.
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
    this.activeDrift = resolveDrift(undefined);

    // Cinematic Polish Phase, Commit 3: cursor parallax target/live offset,
    // in normalized -1..1 pointer units (not world units -- CURSOR_AMPLITUDE
    // in update() is what converts to a world-space nudge).
    this.cursorInfluence = new Vector3();
    this.cursorOffset = new Vector3();

    // Cinematic Motion Refinement Phase, Commit 1: settle-overshoot state.
    // `settleElapsed` starts at Infinity so the envelope (2 ** -elapsed/half)
    // is already 0 before any shot change ever arms it -- no separate
    // "armed" flag needed.
    this.settleImpulse = new Vector3();
    this.settleElapsed = Infinity;

    // Subject-lead state (target-only), same eased-offset shape as cursor
    // parallax above.
    this.targetLeadTarget = new Vector3();
    this.targetLeadOffset = new Vector3();

    this.setShot(DEFAULT_SHOT_ID);
  }

  /**
   * Points the rig at a named shot from shots.js. `instant` (the default,
   * used only for the constructor's very first shot, above) snaps the live
   * camera straight to the shot with no easing, so the rendered frame is
   * identical to a hand-set camera. Every real chapter transition passes
   * `{ instant: false }` (see camera-sync.js) and lets update() close the
   * distance over subsequent frames instead.
   */
  setShot(shotId, { instant = true } = {}) {
    const shot = SHOTS[shotId];
    if (!shot) return;

    // Settle-overshoot only makes sense on a genuinely new, eased shot
    // change -- re-selecting the same shot, or any instant snap (the
    // constructor's own initial shot, or any future instant re-frame), has
    // no meaningful "previous shot" to overshoot away from. Captured before
    // desiredPosition is overwritten below.
    const arm = instant === false && shotId !== this.activeShotId;
    if (arm) scratchOldDesiredPosition.copy(this.desiredPosition);

    this.activeShotId = shotId;
    this.desiredPosition.set(shot.position.x, shot.position.y, shot.position.z);
    this.desiredTarget.set(shot.target.x, shot.target.y, shot.target.z);
    this.desiredFov = shot.fov;
    // Resolved once per shot change, not per frame -- see resolveDrift().
    this.activeDrift = resolveDrift(shot.drift);

    if (arm) {
      this.settleImpulse.subVectors(this.desiredPosition, scratchOldDesiredPosition).clampLength(0, SETTLE_MAX_AMPLITUDE);
      this.settleElapsed = 0;
    }

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
   * The Scroll Engine's (Section 16) entry point, live since Commit 4b:
   * `progress` is how far scrolled through the *currently active* chapter
   * (0 at that chapter's own opening frame, 1 at its closing frame) --
   * called every tick by scroll-progress.js, which only ever computes this
   * number and hands it here; it never touches the camera transform itself
   * (the ownership rule in this file's class doc). update() shapes this
   * into the drift envelope below.
   */
  setProgress(progress) {
    this.progress = Math.min(1, Math.max(0, progress));
  }

  /** Cinematic Polish Phase, Commit 3: pointer.js's entry point. `x`/`y` are
   *  normalized -1..1 pointer coordinates -- stored as the *target* offset;
   *  update() eases the live `cursorOffset` toward it every frame. Also
   *  how a hovered CTA "eases the camera toward it": pointer.js simply
   *  passes an amplified (x, y) while hovering, and the same easing
   *  smooths both the ramp-up and the decay back down on hover-out -- no
   *  second easing pipeline needed here. */
  setCursorInfluence(x, y) {
    this.cursorInfluence.set(Math.min(1, Math.max(-1, x)), Math.min(1, Math.max(-1, y)), 0);
  }

  /**
   * Choreography Refinement Pass: scene-blend.js's own entry point for
   * camera position/target/fov during a chapter-transition corridor --
   * called every tick with already shot-to-shot blended values it computes
   * itself from SHOTS[] (public data; the blend math doesn't need to live
   * in this class), the same "declare the value, let the rig apply it"
   * shape setLightTint/setActivity already use elsewhere. Sets
   * desiredPosition/desiredTarget/desiredFov directly -- update() already
   * eases the live camera toward these every frame regardless of who set
   * them, so this needs no separate easing path of its own.
   *
   * Deliberately does NOT touch activeShotId/activeDrift/settle-overshoot --
   * those remain camera-sync.js's own discrete setShot()'s concern. Its
   * calls keep firing exactly as before on every scene-state 'active'
   * transition; they become harmless, immediately-superseded coarse
   * nudges once this runs every tick, the same "continuous always wins"
   * idiom scene-blend.js already established for fog/light-tint/activity
   * (Cinematic Polish Phase, Commit 1) -- this closes the one gap that
   * phase's own doc comment left as camera-sync.js's "later milestone":
   * camera position/target now blend continuously across the same
   * corridor those other properties already do, instead of snapping via a
   * single fast eased setShot() once a chapter crosses into 'active'.
   */
  setCorridorBlend(position, target, fov) {
    this.desiredPosition.copy(position);
    this.desiredTarget.copy(target);
    this.desiredFov = fov;
  }

  /** Cinematic Motion Refinement Phase, Commit 1: a small, generic, opt-in
   *  lead offset on `target` only, eased via its own half-life in update()
   *  exactly like setCursorInfluence's `cursorOffset` -- clamped here so a
   *  careless caller can never push the frame far off its authored
   *  composition. Takes the caller's OWN shot id (not read from rig state
   *  by the caller) and only actually applies it while that shot is the
   *  rig's active one -- every region updates every frame regardless of
   *  visibility (the persistent scene graph), so without this guard a
   *  chapter calling this while off-screen would leak its lead into
   *  whichever OTHER shot the camera is actually showing. Same
   *  declare-intent-let-the-rig-decide shape as setActivity/setLightTint
   *  elsewhere in the codebase, rather than a region reaching into rig
   *  internals to check relevance itself. */
  setTargetLead(shotId, x, y, z) {
    if (shotId !== this.activeShotId) {
      this.targetLeadTarget.set(0, 0, 0);
      return;
    }
    this.targetLeadTarget.set(x, y, z).clampLength(0, TARGET_LEAD_MAX_AMPLITUDE);
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
   *  desired values (frame-rate-independent since Commit 4a) and re-applies
   *  lookAt every frame -- always, not only when a shot changes -- so a
   *  scroll-driven desired-value change is picked up automatically with no
   *  extra wiring. Layers a small intra-chapter drift on top (Commit 4b)
   *  after the shot-easing lerp, so drift can never alter which shot the
   *  camera is easing toward or its resting composition. */
  update() {
    const dt = this.experience.time.delta;
    const t = dampFactor(POSITION_HALF_LIFE_MS, dt);
    this.instance.position.lerp(this.desiredPosition, t);
    this.target.lerp(this.desiredTarget, t);
    this.setFov(this.instance.fov + (this.desiredFov - this.instance.fov) * t);

    // Camera-relative right/up basis, from this frame's incoming
    // orientation (one-frame-stale by the time applyLookAt() runs below --
    // imperceptible for a subtle parallax nudge, and avoids computing
    // lookAt twice per frame). Reused for cursor parallax below.
    scratchRight.copy(UNIT_X).applyQuaternion(this.instance.quaternion);
    scratchUp.copy(UNIT_Y).applyQuaternion(this.instance.quaternion);

    // Exactly 0 at this chapter's own start/end (`progress` 0 or 1), so it
    // never interferes with the shot-to-shot easing above -- drift only
    // "wakes up" once settled mid-chapter and fades out before the next
    // boundary, regardless of the active shot's configured amplitude/speed/
    // axis. `target` is left undrifted, so this reads as a subtle handheld
    // sway around a stable subject, not a moving frame.
    const envelope = Math.sin(this.progress * Math.PI);
    const oscillation = Math.sin((this.experience.time.elapsed / DRIFT_PERIOD_MS) * this.activeDrift.speed * Math.PI * 2);
    const offset = this.activeDrift.amplitude * envelope * oscillation;
    this.instance.position.addScaledVector(this.activeDrift.axisVector, offset);

    // Cursor parallax (Commit 3) -- a third additive offset, same pattern
    // as drift above: never touches desiredPosition/desiredTarget, applied
    // after the shot-easing lerp so it can't alter shot composition.
    // `-cursorOffset.y` because pointer.js's y follows clientY convention
    // (positive toward the bottom of the screen); moving the pointer
    // toward the top should nudge the camera up, not down.
    const cursorT = dampFactor(CURSOR_HALF_LIFE_MS, dt);
    this.cursorOffset.lerp(this.cursorInfluence, cursorT);
    this.instance.position.addScaledVector(scratchRight, this.cursorOffset.x * CURSOR_AMPLITUDE);
    this.instance.position.addScaledVector(scratchUp, -this.cursorOffset.y * CURSOR_AMPLITUDE);

    // Settle-overshoot (Commit 1): a fourth additive offset, armed only by
    // a non-instant setShot() to a genuinely new shot (see setShot() above).
    // `settleElapsed` grows unboundedly once armed -- 2 ** (-elapsed/half)
    // simply asymptotes to 0, no reset/rearm bookkeeping needed between
    // shot changes. Guarded on the envelope BEFORE computing the
    // oscillation: settleElapsed starts at Infinity (never armed yet), and
    // Math.cos(Infinity) is NaN in JS -- multiplying by a zero envelope
    // does NOT save it (0 * NaN = NaN, not 0), which would otherwise
    // permanently corrupt `position` on the very first frame, before any
    // shot ever changes. Skipping the block entirely while the envelope is
    // already negligible avoids ever evaluating Math.cos(Infinity).
    this.settleElapsed += dt;
    const settleEnvelope = 2 ** (-this.settleElapsed / SETTLE_HALF_LIFE_MS);
    if (settleEnvelope > 0.0005) {
      const settleOscillation = Math.cos((this.settleElapsed / SETTLE_PERIOD_MS) * Math.PI * 2);
      this.instance.position.addScaledVector(this.settleImpulse, settleEnvelope * settleOscillation);
    }

    // Subject lead (Commit 1): target-only, eased the same way cursor
    // parallax is above. Zero for every chapter that never calls
    // setTargetLead() -- targetLeadTarget simply stays (0,0,0).
    const leadT = dampFactor(TARGET_LEAD_HALF_LIFE_MS, dt);
    this.targetLeadOffset.lerp(this.targetLeadTarget, leadT);
    this.target.add(this.targetLeadOffset);

    this.applyLookAt();
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height || 1;
    this.instance.updateProjectionMatrix();
  }
}
