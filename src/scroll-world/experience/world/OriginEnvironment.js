import { Vector3 } from 'three';
import { createFloor } from './createFloor.js';
import { createRibs } from './createRibs.js';
import { createWalkway } from './createWalkway.js';
import { createRouteLines } from './createRouteLines.js';
import { createParticles, updateParticles } from './createParticles.js';
import { createLights } from './createLights.js';

const CAMERA_POSITION = new Vector3(4.2, 4, 19);
const CAMERA_TARGET = new Vector3(-6, 0.6, -14);

const PULSE_PERIOD = 5200;
const PULSE_DEPTH = 0.18;

/**
 * The Command Center (Production Handbook Section 23, Scene 01) -- the
 * journey's opening establishing shot. Builds the atrium's geometry and
 * lighting once, frames the shared camera on it, and advances only the
 * ambient motion (particle drift, route-line pulse) each tick. No camera
 * movement and no scroll coupling live here -- this is a single held frame.
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

    this.frameCamera();
  }

  frameCamera() {
    const camera = this.experience.camera.instance;
    camera.position.copy(CAMERA_POSITION);
    camera.lookAt(CAMERA_TARGET);
  }

  update(time) {
    updateParticles(this.particles, time.delta / 1000);

    const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.routeLines.userData.pulseMaterials.forEach((material) => {
      material.opacity = material.userData.baseOpacity * pulse;
    });
  }
}
