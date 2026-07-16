import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three';

const OFFWHITE_100 = 0xeef2ff;
const PARTICLE_COUNT = 260;
const SPREAD_X = 26;
const SPREAD_Z = 46;
const HEIGHT = 9;
const DRIFT_SPEED = 0.35;

/** Subtle ambient motes (Section 23, Scene 01 asset requirements; Addendum
 *  32.4 atmospheric motion applies world-wide). Drift is slow, low-amplitude,
 *  and independent of camera or scroll -- purely the atmospheric motion the
 *  Motion Bible calls for at low intensity.
 *
 *  Parameterized (Addendum 32.1) so every chapter can scope its own motes to
 *  its own region of the continuous world graph via `offsetX`/`offsetZ`,
 *  rather than duplicating this file. Defaults reproduce Origin's original
 *  values exactly (including the -10 z-offset), so the existing
 *  `createParticles()` call in OriginEnvironment is unchanged. */
export function createParticles({
  count = PARTICLE_COUNT,
  spreadX = SPREAD_X,
  spreadZ = SPREAD_Z,
  height = HEIGHT,
  offsetX = 0,
  offsetZ = -10,
  driftSpeed = DRIFT_SPEED,
  color = OFFWHITE_100,
  size = 0.05,
  opacity = 0.5,
} = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = offsetX + (Math.random() - 0.5) * spreadX * 2;
    positions[i * 3 + 1] = Math.random() * height;
    positions[i * 3 + 2] = offsetZ + (Math.random() - 0.5) * spreadZ * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.userData.driftSpeed = driftSpeed;
  points.userData.height = height;
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
