import { createFloor } from './createFloor.js';
import { createRibs } from './createRibs.js';
import { createWalkway } from './createWalkway.js';
import { createRouteLines } from './createRouteLines.js';
import { createParticles, updateParticles } from './createParticles.js';
import { createLights } from './createLights.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR } from '../utils/damp.js';

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
    this.particles = createParticles();
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

    this.scene.add(
      this.floor,
      this.ribs,
      this.walkway,
      this.routeLines,
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

    updateParticles(this.particles, time.delta / 1000);

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
}
