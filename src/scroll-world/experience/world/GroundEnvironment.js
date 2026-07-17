import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { createLights } from './createLights.js';
import { createParticles, updateParticles } from './createParticles.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR, LIGHT_TINT_HALF_LIFE_MS } from '../utils/damp.js';
import { LIGHT_TINTS } from '../camera/shots.js';
import { varyMaterial } from './materialVariation.js';

const ASPHALT_COLOR = 0x070a24;
const HUB_COLOR = 0x0a1030;
const RUBBER_COLOR = 0x05070f;
// Ground's own accent from config.js.
const ELECTRIC_500 = 0x2f8bff;
const ELECTRIC_400 = 0x4fa3ff;
const ROYAL_600 = 0x2540b0;
const OFFWHITE_100 = 0xeef2ff;

// Past Sorting's own region (Sorting's mezzanine floor ends around z = -206)
// -- spaced further than Pickup->Sorting's gap since Ground's own camera
// sits much further back from its subject (Section 23: "expansive... widest
// copy column"), and an earlier, closer REGION_Z put that pulled-back camera
// inside Sorting's floor geometry.
const REGION_Z = -330;
const HIGHWAY_LENGTH = 100;
const LANE_X = [-16, -5.5, 6, 17];
const FLEET_SPEED = 6.5;

// Cinematic Polish Phase, Commit 4: "accelerate -> move -> settle," never an
// instant speed. `speed` (userData) is the live, eased value; `targetSpeed`
// is the authored constant it chases via dampFactor(). Tapering targetSpeed
// down as a truck nears its own wrap point (rather than snapping speed to
// zero at the boundary) means the eased live speed genuinely decelerates
// into the wrap and re-accelerates back out of it, instead of popping.
const VELOCITY_HALF_LIFE_MS = 300;
const WRAP_TAPER_DISTANCE = HIGHWAY_LENGTH * 0.12;
const MIN_TAPER_FACTOR = 0.15;

function createHighway() {
  const group = new Group();
  const asphalt = new Mesh(
    new BoxGeometry(48, 0.3, HIGHWAY_LENGTH),
    new MeshPhysicalMaterial({ color: ASPHALT_COLOR, metalness: 0.1, roughness: 0.9, clearcoat: 0 })
  );
  asphalt.position.set(0, -0.15, REGION_Z);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  // Lane dividers -- dashed strips, reusing the electric route-line color so
  // the highway itself reads as part of the same light-trail motif.
  const dashMaterial = new MeshBasicMaterial({ color: OFFWHITE_100, transparent: true, opacity: 0.35 });
  [-11, 0.5, 12].forEach((x) => {
    for (let i = 0; i < 16; i += 1) {
      const dash = new Mesh(new BoxGeometry(0.25, 0.05, 2), dashMaterial);
      dash.position.set(x, 0.02, REGION_Z - HIGHWAY_LENGTH / 2 + i * 6.4);
      group.add(dash);
    }
  });

  return group;
}

function createHubSilhouettes() {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.7, metalness: 0.2 });
  const positions = [
    [-30, 5, REGION_Z - 55, 14, 10, 20],
    [26, 7, REGION_Z - 62, 18, 14, 16],
    [-8, 4, REGION_Z - 70, 10, 8, 14],
  ];
  positions.forEach(([x, y, z, w, h, d]) => {
    const hub = new Mesh(new BoxGeometry(w, h, d), material);
    hub.position.set(x, y / 2, z);
    group.add(hub);
  });
  return group;
}

function createTruck(color, seed = 0) {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 });
  // Cinematic Polish Phase, Commit 5: a small, deterministic per-truck wear
  // variation so the fleet doesn't read as four identical, bit-for-bit
  // copies -- construction time only, zero per-frame cost.
  varyMaterial(bodyMaterial, seed);
  const rubberMaterial = new MeshStandardMaterial({ color: RUBBER_COLOR, roughness: 0.9, metalness: 0.1 });
  const lightMaterial = new MeshBasicMaterial({ color: ELECTRIC_400 });

  const cargo = new Mesh(new BoxGeometry(3, 3, 8), bodyMaterial);
  cargo.position.set(0, 1.6, 0);
  cargo.castShadow = true;
  group.add(cargo);

  const cab = new Mesh(new BoxGeometry(2.6, 2.4, 2.2), bodyMaterial);
  cab.position.set(0, 1.4, 5);
  cab.castShadow = true;
  group.add(cab);

  const wheelGeometry = new CylinderGeometry(0.5, 0.5, 0.4, 14);
  [-4.5, -1.5, 1.5, 4.5].forEach((z) => {
    [-1.6, 1.6].forEach((x) => {
      const wheel = new Mesh(wheelGeometry, rubberMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      group.add(wheel);
    });
  });

  [-1.4, 1.4].forEach((x) => {
    const tail = new Mesh(new BoxGeometry(0.15, 0.25, 0.05), lightMaterial);
    tail.position.set(x, 1.9, -4.1);
    group.add(tail);
  });

  return group;
}

/** A fleet in constant, layered motion (Section 23: "the busiest midground
 *  of the entire journey"). Each truck holds its lane and speed, wrapping
 *  from the far end back to the near end -- purposeful motion, not
 *  decoration (Motion Bible, Section 15). */
function createFleet() {
  const group = new Group();
  const trucks = [];
  const colors = [0x0c1338, 0x0e1642, 0x0a102e];

  LANE_X.forEach((x, i) => {
    const truck = createTruck(colors[i % colors.length], i);
    const z = REGION_Z - HIGHWAY_LENGTH / 2 + ((i * HIGHWAY_LENGTH) / LANE_X.length);
    truck.position.set(x, 0, z);
    truck.rotation.y = i % 2 === 0 ? 0 : Math.PI;
    truck.userData.direction = i % 2 === 0 ? 1 : -1;
    truck.userData.targetSpeed = FLEET_SPEED * (0.7 + (0.3 * (i % 3)) / 2);
    // Live value starts equal to the target -- no pop at load.
    truck.userData.speed = truck.userData.targetSpeed;
    group.add(truck);
    trucks.push(truck);
  });

  group.userData.trucks = trucks;
  return group;
}

function createRouteLine() {
  // Continues from Sorting's own end point through Ground's region.
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0.65, -195),
    new Vector3(2, 0.4, -240),
    new Vector3(4, 0.1, -285),
    new Vector3(6, 0.05, REGION_Z),
  ]);
  const material = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.8 });
  material.userData.baseOpacity = material.opacity;
  return new Mesh(new TubeGeometry(curve, 100, 0.05, 8, false), material);
}

/**
 * The Container Port / Road Network (Production Handbook Section 23, Scene
 * 04) -- domestic scale and reach, a fleet in constant physical motion. Own
 * region of the continuous scene graph (Section 9: `REGION_Z`), past
 * Sorting's geometry. Framing belongs to the Production Camera's `ground`
 * shot (camera/shots.js) -- this class carries no camera state.
 */
export class GroundEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();
    this.fleet = createFleet();
    this.routeLine = createRouteLine();
    this.group.add(createHighway(), createHubSilhouettes(), this.fleet, this.routeLine);

    // Heaviest ground-level haze in the journey (Section 23) -- the densest
    // particle field of any chapter so far.
    this.particles = createParticles({
      count: 220,
      spreadX: 28,
      spreadZ: HIGHWAY_LENGTH,
      height: 5,
      offsetZ: REGION_Z,
      opacity: 0.4,
    });
    this.group.add(this.particles);

    // Section 23: "Key light in electric blue, fill in the constant royal
    // blue."
    const { key, fill } = createLights({
      keyColor: ELECTRIC_500,
      keyIntensity: 3.6,
      keyPosition: [18, 20, REGION_Z + 20],
      fillColor: ROYAL_600,
      fillIntensity: 1.3,
      fillPosition: [-20, 10, REGION_Z - 15],
      keyTarget: [0, 1.5, REGION_Z],
    });
    this.keyLight = key;
    this.fillLight = fill;
    this.group.add(key, key.target, fill, fill.target);

    // Cinematic Integration Phase, Commit 1: see OriginEnvironment.js.
    this.id = 'ground';
    this.baseKeyIntensity = this.keyLight.intensity;
    this.baseFillIntensity = this.fillLight.intensity;
    this.baseParticleOpacity = this.particles.material.opacity;
    this.activityWeight = 1;
    this.targetActivityWeight = 1;
    this.activityFloor = DEFAULT_ACTIVITY_FLOOR;

    // Cinematic Polish Phase, Commit 1: see OriginEnvironment.js.
    const tint = LIGHT_TINTS.ground;
    this.keyLight.color.set(tint.key);
    this.fillLight.color.set(tint.fill);
    this.targetKeyColor = this.keyLight.color.clone();
    this.targetFillColor = this.fillLight.color.clone();

    this.scene.add(this.group);
  }

  update(time) {
    this.activityWeight += (this.targetActivityWeight - this.activityWeight) * dampFactor(ACTIVITY_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight;
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;
    this.particles.material.opacity = this.baseParticleOpacity * this.activityWeight;

    const tintT = dampFactor(LIGHT_TINT_HALF_LIFE_MS, time.delta);
    this.keyLight.color.lerp(this.targetKeyColor, tintT);
    this.fillLight.color.lerp(this.targetFillColor, tintT);

    updateParticles(this.particles, time.delta / 1000);

    const deltaSeconds = time.delta / 1000;
    const halfLength = HIGHWAY_LENGTH / 2;
    const velocityT = dampFactor(VELOCITY_HALF_LIFE_MS, time.delta);
    this.fleet.userData.trucks.forEach((truck) => {
      const distanceToWrap =
        truck.userData.direction > 0 ? REGION_Z + halfLength - truck.position.z : truck.position.z - (REGION_Z - halfLength);
      const taper = Math.max(MIN_TAPER_FACTOR, Math.min(1, distanceToWrap / WRAP_TAPER_DISTANCE));
      const desiredSpeed = truck.userData.targetSpeed * taper;
      truck.userData.speed += (desiredSpeed - truck.userData.speed) * velocityT;

      truck.position.z += truck.userData.speed * truck.userData.direction * deltaSeconds;
      if (truck.position.z > REGION_Z + halfLength) truck.position.z = REGION_Z - halfLength;
      if (truck.position.z < REGION_Z - halfLength) truck.position.z = REGION_Z + halfLength;
    });

    const pulse = 1 - 0.2 + 0.2 * Math.sin(time.elapsed / 3800);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * pulse;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
