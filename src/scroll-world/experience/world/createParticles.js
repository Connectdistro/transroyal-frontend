import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three';

const OFFWHITE_100 = 0xeef2ff;
const PARTICLE_COUNT = 260;
const SPREAD_X = 26;
const SPREAD_Z = 46;
const HEIGHT = 9;
const DRIFT_SPEED = 0.35;

/** Subtle ambient motes (Section 23, Scene 01 asset requirements). Drift is
 *  slow, low-amplitude, and independent of camera or scroll -- purely the
 *  atmospheric motion the Motion Bible calls for at low intensity. */
export function createParticles() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
    positions[i * 3 + 1] = Math.random() * HEIGHT;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2 - 10;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color: OFFWHITE_100,
    size: 0.05,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.userData.driftSpeed = DRIFT_SPEED;
  points.userData.height = HEIGHT;
  return points;
}

export function updateParticles(points, deltaSeconds) {
  const position = points.geometry.attributes.position;
  const drift = points.userData.driftSpeed * deltaSeconds;

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i) + drift;
    position.setY(i, y > points.userData.height ? 0 : y);
  }

  position.needsUpdate = true;
}
