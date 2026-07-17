import {
  BoxGeometry,
  CatmullRomCurve3,
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

const STRUCTURE_COLOR = 0x0a1030;
const FLOOR_COLOR = 0x080d33;
const BELT_COLOR = 0x0d1440;
// Sorting's own accent from config.js (royal-blue-leaning), reused as the key
// light color so the 3D chapter and its CSS wayfinding stay in sync.
const ROYAL_500 = 0x3654d6;
const ROYAL_600 = 0x2540b0;
const ELECTRIC_400 = 0x4fa3ff;

// Past Pickup's own region (Pickup's wall panel sits around z = -113).
const REGION_Z = -180;
const CONVEYOR_LENGTH = 46;
const CONVEYOR_X = [-8, 0, 8];
const BAY_COUNT = 6;
const BAY_SPACING = 7;

const PULSE_PERIOD = 3400;
const PULSE_DEPTH = 0.25;
const PARCEL_SPEED = 3.2;

// Cinematic Polish Phase, Commit 4: see GroundEnvironment.js's own
// identical rationale -- eased velocity instead of a constant speed that
// snaps at the loop point. Parcels are one-directional (no wrap-in-place),
// so the "taper" applies only approaching `endZ`; on reset to `startZ` the
// live speed restarts at the same floor a decelerating truck would settle
// to, so the parcel visibly accelerates back up rather than snapping to
// full speed.
const VELOCITY_HALF_LIFE_MS = 250;
const TAPER_DISTANCE = CONVEYOR_LENGTH * 0.12;
const MIN_TAPER_FACTOR = 0.2;

function createMezzanineFloor() {
  const geometry = new BoxGeometry(30, 0.4, CONVEYOR_LENGTH + 6);
  const material = new MeshPhysicalMaterial({ color: FLOOR_COLOR, metalness: 0.1, roughness: 0.8, clearcoat: 0 });
  const floor = new Mesh(geometry, material);
  floor.position.set(0, -0.4, REGION_Z);
  floor.receiveShadow = true;
  return floor;
}

/** Repeating structural bays over the sorting line (Addendum 32.4: the same
 *  rib module as Origin and Pickup, at this location's own scale) -- scan
 *  arches straddling the conveyors, receding toward a hazy vanishing point. */
function createScanArches() {
  const group = new Group();
  const structureMaterial = new MeshStandardMaterial({ color: STRUCTURE_COLOR, roughness: 0.6, metalness: 0.25 });
  const glowMaterial = new MeshBasicMaterial({ color: ROYAL_500 });

  for (let i = 0; i < BAY_COUNT; i += 1) {
    const z = REGION_Z + CONVEYOR_LENGTH / 2 - i * BAY_SPACING - 4;
    const leftPost = new Mesh(new BoxGeometry(0.4, 5.5, 0.4), structureMaterial);
    leftPost.position.set(-11, 2.75, z);
    leftPost.castShadow = true;
    const rightPost = new Mesh(new BoxGeometry(0.4, 5.5, 0.4), structureMaterial);
    rightPost.position.set(11, 2.75, z);
    rightPost.castShadow = true;
    const beam = new Mesh(new BoxGeometry(22.4, 0.4, 0.4), structureMaterial);
    beam.position.set(0, 5.5, z);
    beam.castShadow = true;
    const glow = new Mesh(new BoxGeometry(21, 0.06, 0.1), glowMaterial);
    glow.position.set(0, 5.2, z + 0.25);
    group.add(leftPost, rightPost, beam, glow);
  }

  group.userData.glowMeshes = group.children.filter((child) => child.material === glowMaterial);
  return group;
}

function createConveyors() {
  const group = new Group();
  const beltMaterial = new MeshStandardMaterial({ color: BELT_COLOR, roughness: 0.4, metalness: 0.5 });
  const railMaterial = new MeshStandardMaterial({ color: STRUCTURE_COLOR, roughness: 0.55, metalness: 0.3 });
  const parcelMaterial = new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.5, metalness: 0.2 });

  const parcels = [];

  CONVEYOR_X.forEach((x, lineIndex) => {
    const belt = new Mesh(new BoxGeometry(2.4, 0.3, CONVEYOR_LENGTH), beltMaterial);
    belt.position.set(x, 0.15, REGION_Z);
    belt.receiveShadow = true;
    group.add(belt);

    [-1.3, 1.3].forEach((railX) => {
      const rail = new Mesh(new BoxGeometry(0.15, 0.5, CONVEYOR_LENGTH), railMaterial);
      rail.position.set(x + railX, 0.4, REGION_Z);
      group.add(rail);
    });

    for (let p = 0; p < 4; p += 1) {
      // Cinematic Polish Phase, Commit 5: parcels previously shared one
      // material instance across all 12 -- per-instance variation needs
      // its own clone first (a small, deliberate, construction-time-only
      // allocation increase: 1 -> 12 material instances, never touched
      // again per frame).
      const parcelInstanceMaterial = parcelMaterial.clone();
      varyMaterial(parcelInstanceMaterial, lineIndex * 4 + p);
      const parcel = new Mesh(new BoxGeometry(0.9, 0.6, 0.9), parcelInstanceMaterial);
      const z = REGION_Z - CONVEYOR_LENGTH / 2 + p * (CONVEYOR_LENGTH / 4) + lineIndex * 3;
      parcel.position.set(x, 0.55, z);
      parcel.castShadow = true;
      parcel.userData.startZ = REGION_Z - CONVEYOR_LENGTH / 2;
      parcel.userData.endZ = REGION_Z + CONVEYOR_LENGTH / 2;
      parcel.userData.speed = PARCEL_SPEED;
      group.add(parcel);
      parcels.push(parcel);
    }
  });

  group.userData.parcels = parcels;
  return group;
}

function createRouteLine() {
  // Continues from Pickup's own end point (see PickupEnvironment.js) through
  // Sorting's region -- Section 23: the parcel rejoins the flow of the
  // conveyor line on arrival.
  const curve = new CatmullRomCurve3([
    new Vector3(4.5, 0.05, -105),
    new Vector3(2, 0.05, -130),
    new Vector3(0, 0.05, -155),
    new Vector3(0, 0.65, REGION_Z),
  ]);
  const material = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.85 });
  material.userData.baseOpacity = material.opacity;
  return new Mesh(new TubeGeometry(curve, 100, 0.05, 8, false), material);
}

/**
 * The Sorting Hub (Production Handbook Section 23, Scene 03) -- the
 * network's operational precision at industrial scale. Own region of the
 * continuous scene graph (Section 9: `REGION_Z`), past Pickup's geometry.
 * Framing belongs to the Production Camera's `sorting` shot
 * (camera/shots.js) -- this class carries no camera state.
 */
export class SortingEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();
    this.arches = createScanArches();
    this.conveyors = createConveyors();
    this.routeLine = createRouteLine();
    this.group.add(createMezzanineFloor(), this.arches, this.conveyors, this.routeLine);

    this.particles = createParticles({
      count: 160,
      spreadX: 16,
      spreadZ: CONVEYOR_LENGTH,
      height: 6,
      offsetZ: REGION_Z,
      opacity: 0.3,
    });
    this.group.add(this.particles);

    // Section 23: "Key light in this chapter's own accent (royal-blue-
    // leaning), fill in the constant royal blue."
    const { key, fill } = createLights({
      keyColor: ROYAL_500,
      keyIntensity: 3.4,
      keyPosition: [14, 16, REGION_Z + 10],
      fillColor: ROYAL_600,
      fillIntensity: 1.3,
      fillPosition: [-13, 8, REGION_Z - 10],
      keyTarget: [0, 2, REGION_Z],
    });
    this.keyLight = key;
    this.fillLight = fill;
    this.group.add(key, key.target, fill, fill.target);

    // Cinematic Integration Phase, Commit 1: see OriginEnvironment.js.
    this.id = 'sorting';
    this.baseKeyIntensity = this.keyLight.intensity;
    this.baseFillIntensity = this.fillLight.intensity;
    this.baseParticleOpacity = this.particles.material.opacity;
    this.activityWeight = 1;
    this.targetActivityWeight = 1;
    this.activityFloor = DEFAULT_ACTIVITY_FLOOR;

    // Cinematic Polish Phase, Commit 1: see OriginEnvironment.js.
    const tint = LIGHT_TINTS.sorting;
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
    const velocityT = dampFactor(VELOCITY_HALF_LIFE_MS, time.delta);
    this.conveyors.userData.parcels.forEach((parcel) => {
      const distanceToEnd = parcel.userData.endZ - parcel.position.z;
      const taper = Math.max(MIN_TAPER_FACTOR, Math.min(1, distanceToEnd / TAPER_DISTANCE));
      const desiredSpeed = PARCEL_SPEED * taper;
      parcel.userData.speed += (desiredSpeed - parcel.userData.speed) * velocityT;

      parcel.position.z += parcel.userData.speed * deltaSeconds;
      if (parcel.position.z > parcel.userData.endZ) {
        parcel.position.z = parcel.userData.startZ;
        // Restarts at the same floor a decelerating parcel settles to, so
        // it accelerates back up from the belt's start rather than
        // snapping straight to full speed.
        parcel.userData.speed = PARCEL_SPEED * MIN_TAPER_FACTOR;
      }
    });

    const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * pulse;
    this.arches.userData.glowMeshes.forEach((glow, i) => {
      glow.scale.y = 0.7 + 0.3 * Math.sin(time.elapsed / PULSE_PERIOD + i);
    });
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
