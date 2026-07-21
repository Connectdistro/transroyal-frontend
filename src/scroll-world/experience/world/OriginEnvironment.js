import { createFloor } from './createFloor.js';
import { createRibs } from './createRibs.js';
import { createWalkway } from './createWalkway.js';
import { createRouteLines } from './createRouteLines.js';
import { createOriginParcel } from './createOriginParcel.js';
import { createParticles, updateParticles } from './createParticles.js';
import { createLights } from './createLights.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR, LIGHT_TINT_HALF_LIFE_MS } from '../utils/damp.js';
import { LIGHT_TINTS } from '../camera/shots.js';

const PULSE_PERIOD = 5200;
const PULSE_DEPTH = 0.18;

/**
 * The Command Center (Production Handbook Section 23, Scene 01) -- the
 * journey's opening establishing shot. Builds the atrium's geometry and
 * lighting once, and advances only the ambient motion (particle drift,
 * route-line pulse) each tick. Framing is owned entirely by the Production
 * Camera (Section 11: `camera/CameraRig.js` + its `origin` shot in
 * `camera/shots.js`) -- this class carries no camera state and never
 * touches `experience.camera`.
 */
export class OriginEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.floor = createFloor();
    this.ribs = createRibs();
    this.walkway = createWalkway();
    this.routeLines = createRouteLines();
    this.parcel = createOriginParcel();
    // Cinematic Polish Phase, Commit 4: Origin is the one particle field
    // opted into the second turbulence layer -- the sparse, atmospheric
    // opening beat is where a touch of layered motion reads as ambience
    // rather than busyness. Every other chapter's createParticles() call
    // is unchanged (turbulence defaults to 0, fully inert).
    this.particles = createParticles({ turbulence: 0.4 });
    const { key, fill } = createLights();
    this.keyLight = key;
    this.fillLight = fill;

    // Cinematic Integration Phase, Commit 1: this region's own eased
    // presence weight, driven by camera-sync.js via setActivity() whenever
    // this chapter's DOM section changes lifecycle state. Base values are
    // read back from what createLights()/createParticles() already set, not
    // re-declared, so they can never drift out of sync with the authored
    // numbers. Defaulting to full weight means this region renders exactly
    // as before if setActivity() is never called.
    this.id = 'origin';
    this.baseKeyIntensity = this.keyLight.intensity;
    this.baseFillIntensity = this.fillLight.intensity;
    this.baseParticleOpacity = this.particles.material.opacity;
    this.activityWeight = 1;
    this.targetActivityWeight = 1;
    this.activityFloor = DEFAULT_ACTIVITY_FLOOR;

    // Cinematic Polish Phase, Commit 1: this region's home light tint
    // (scene-blend.js's LIGHT_TINTS, see shots.js) supersedes whatever
    // hex createLights() above was given -- set once, immediately, before
    // the first render, so it's indistinguishable from having been
    // authored that way originally. targetKeyColor/targetFillColor are
    // eased toward continuously in update(); scene-blend.js is the only
    // caller of setLightTint(), driving them either back to this region's
    // own tint (the common case) or toward a neighbor's during a
    // transition corridor.
    const tint = LIGHT_TINTS.origin;
    this.keyLight.color.set(tint.key);
    this.fillLight.color.set(tint.fill);
    this.targetKeyColor = this.keyLight.color.clone();
    this.targetFillColor = this.fillLight.color.clone();

    this.scene.add(
      this.floor,
      this.ribs,
      this.walkway,
      this.routeLines,
      this.parcel,
      this.particles,
      this.keyLight,
      this.keyLight.target,
      this.fillLight,
      this.fillLight.target
    );
  }

  update(time) {
    this.activityWeight += (this.targetActivityWeight - this.activityWeight) * dampFactor(ACTIVITY_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight;
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;
    this.particles.material.opacity = this.baseParticleOpacity * this.activityWeight;

    const tintT = dampFactor(LIGHT_TINT_HALF_LIFE_MS, time.delta);
    this.keyLight.color.lerp(this.targetKeyColor, tintT);
    this.fillLight.color.lerp(this.targetFillColor, tintT);

    updateParticles(this.particles, time.delta / 1000, time.elapsed);

    const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.routeLines.userData.pulseMaterials.forEach((material) => {
      material.opacity = material.userData.baseOpacity * pulse;
    });
  }

  /** Sets this region's target activity weight from its DOM section's
   *  lifecycle state (Cinematic Integration Phase, Commit 1) -- 'active'/
   *  'entering' read as fully present, 'leaving'/'inactive' recede to this
   *  region's own floor (its own `this.activityFloor`, independently
   *  overridable per region -- see damp.js). update() eases toward
   *  whatever this is set to; camera-sync.js never needs to know the
   *  resolved number, only the state string. */
  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  /** Sets this region's target key/fill light color (Cinematic Polish
   *  Phase, Commit 1) -- update() eases toward it every frame. Called only
   *  by scene-blend.js, either with this region's own home tint or a
   *  blend toward a neighbor's during a transition corridor. */
  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
