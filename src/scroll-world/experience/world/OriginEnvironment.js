import { createFloor } from './createFloor.js';
import { createRibs } from './createRibs.js';
import { createWalkway } from './createWalkway.js';
import { createRouteLines } from './createRouteLines.js';
import { createParticles, updateParticles } from './createParticles.js';
import { createLights } from './createLights.js';

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
    updateParticles(this.particles, time.delta / 1000);

    const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.routeLines.userData.pulseMaterials.forEach((material) => {
      material.opacity = material.userData.baseOpacity * pulse;
    });
  }
}
