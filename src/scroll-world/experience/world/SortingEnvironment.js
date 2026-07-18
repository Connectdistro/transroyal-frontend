import {
  BoxGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
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

// Choreography Refinement Pass, Track A2: the chapter's decision moment --
// "the network makes the right routing decision," not just moves boxes.
// One parcel on the middle lane (CONVEYOR_X[1] = 0) diverts onto a short
// spur every lap; every other parcel on every other lane is untouched.
// Picking a fixed lane/parcel (rather than randomizing) gives the eye a
// repeatable pattern to follow, matching this chapter's own already-
// deterministic (seeded, not Math.random()) motion conventions.
const DIVERTER_LINE_INDEX = 1;
const DIVERTER_PARCEL_LOCAL_INDEX = 0;
// A junction past the belt's own midpoint (REGION_Z), so the diverted
// parcel has real travel distance on the spur before it reaches endZ and
// resets -- verified against createConveyors()'s own parcel z range
// (REGION_Z +/- CONVEYOR_LENGTH/2).
const DIVERTER_Z = REGION_Z + 8;
// How close (world Z) the target parcel needs to be to the junction before
// the arm swings out / the parcel starts diverting -- reused as BOTH
// triggers (Ground's own precedent: reuse one computed proximity value
// rather than a second timer), so the arm is physically swinging exactly
// while the parcel is crossing it, not decoupled from what it's gating.
const DIVERTER_TRIGGER_WINDOW = 3;
const DIVERTER_OFFSET_X = 2.3;
const DIVERTER_MOTION_HALF_LIFE_MS = 260;
// The paddle's two resting rotations, not a small flex angle -- retracted
// points it along Z (parallel to travel, tucked outside the belt's own
// x-span so it never occludes an undiverted parcel), deployed swings it a
// full quarter-turn to lie across the belt.
const DIVERTER_ARM_RETRACTED_Y = Math.PI / 2;
const DIVERTER_ARM_DEPLOYED_Y = 0;

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

  // Cinematic Motion Refinement Phase, Commit 5: one small ambient beacon
  // -- Sorting was the one chapter with zero practical-light beacons
  // (Ground's dock beacon, FinalMile's porch light, Pickup's scanner all
  // have one). Same small-radius glow-mesh-plus-PointLight precedent,
  // placed at the nearest bay's beam.
  const beacon = new Mesh(new SphereGeometry(0.1, 8, 8), new MeshBasicMaterial({ color: ELECTRIC_400 }));
  beacon.position.set(0, 5.9, REGION_Z + CONVEYOR_LENGTH / 2 - 4);
  const beaconLight = new PointLight(ELECTRIC_400, 1.2, 5, 2);
  beaconLight.position.copy(beacon.position);
  group.add(beacon, beaconLight);
  group.userData.beacon = beacon;
  group.userData.beaconLight = beaconLight;

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

/** The diverter -- a pivoting paddle at the junction (hinged so rotating
 *  the group swings the panel across the belt rather than spinning around
 *  its own center, the same technique AirEnvironment.js's flap groups
 *  already use) plus a short spur belt the diverted parcel actually
 *  travels along, so the divert reads as "onto a real path" rather than a
 *  parcel floating sideways over bare floor. */
function createDiverter() {
  const group = new Group();
  const laneX = CONVEYOR_X[DIVERTER_LINE_INDEX];

  const armMaterial = new MeshStandardMaterial({ color: ROYAL_500, roughness: 0.4, metalness: 0.5 });
  const armPivot = new Group();
  armPivot.position.set(laneX - 1.3, 0.55, DIVERTER_Z);
  // Retracted at rest -- Math.PI/2 points the arm along Z (parallel to
  // travel, tucked outside the belt's own x-span), so undiverted parcels
  // pass it freely. update() swings this toward 0 (across the belt) only
  // while the target parcel is actually crossing the junction.
  armPivot.rotation.y = DIVERTER_ARM_RETRACTED_Y;
  const arm = new Mesh(new BoxGeometry(1.9, 0.12, 0.25), armMaterial);
  arm.position.set(0.95, 0, 0);
  arm.castShadow = true;
  armPivot.add(arm);
  group.add(armPivot);

  const spurMaterial = new MeshStandardMaterial({ color: BELT_COLOR, roughness: 0.4, metalness: 0.5 });
  const spurLength = 5;
  const spur = new Mesh(new BoxGeometry(spurLength, 0.3, 2.2), spurMaterial);
  spur.rotation.y = -Math.PI / 5;
  spur.position.set(laneX + DIVERTER_OFFSET_X * 0.55, 0.15, DIVERTER_Z + 2.8);
  spur.receiveShadow = true;
  group.add(spur);

  group.userData.armPivot = armPivot;
  return group;
}

/** Track B2/B3: belt-boundary wear decals and abstract lane-marker panels,
 *  reusing Ground's own createYardMarkings()/createYardSignage() techniques
 *  (thin painted-box decals; flat panel + emissive edge) rather than a new
 *  visual language. This mezzanine floor previously had zero surface detail
 *  despite three parallel high-traffic conveyor lanes running its length. */
function createFloorDetail() {
  const group = new Group();

  const wearMaterial = new MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.22 });
  CONVEYOR_X.forEach((x) => {
    [-1.7, 1.7].forEach((offset) => {
      const strip = new Mesh(new BoxGeometry(0.6, 0.02, CONVEYOR_LENGTH * 0.7), wearMaterial);
      strip.position.set(x + offset, 0.02, REGION_Z);
      group.add(strip);
    });
  });

  const panelMaterial = new MeshStandardMaterial({ color: 0x0c1338, roughness: 0.5, metalness: 0.3 });
  const panelEdgeMaterial = new MeshBasicMaterial({ color: ROYAL_500 });
  CONVEYOR_X.forEach((x) => {
    const panel = new Mesh(new BoxGeometry(1.6, 0.7, 0.1), panelMaterial);
    const panelEdge = new Mesh(new BoxGeometry(1.76, 0.86, 0.05), panelEdgeMaterial);
    const z = REGION_Z - CONVEYOR_LENGTH / 2 - 1.2;
    panel.position.set(x, 1.1, z);
    panelEdge.position.set(x, 1.1, z - 0.03);
    group.add(panel, panelEdge);
  });

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
    this.diverter = createDiverter();
    this.routeLine = createRouteLine();
    this.group.add(createMezzanineFloor(), createFloorDetail(), this.arches, this.conveyors, this.diverter, this.routeLine);

    // Track A2's own decision-moment target: the one parcel that diverts
    // every lap (see DIVERTER_LINE_INDEX/DIVERTER_PARCEL_LOCAL_INDEX above).
    // Indexed directly rather than searched for every frame -- parcels are
    // pushed in createConveyors() in (line, then p) order, matching this
    // same arithmetic.
    this.diverterParcel =
      this.conveyors.userData.parcels[DIVERTER_LINE_INDEX * 4 + DIVERTER_PARCEL_LOCAL_INDEX];
    this.diverterParcel.userData.baseX = this.diverterParcel.position.x;
    this.diverterParcel.userData.diverted = false;
    this.diverterArmDeploy = 0;

    this.particles = createParticles({
      count: 160,
      spreadX: 16,
      spreadZ: CONVEYOR_LENGTH,
      height: 6,
      offsetZ: REGION_Z,
      opacity: 0.3,
      // Cinematic Motion Refinement Phase, Commit 5: see PickupEnvironment
      // for the same reused-turbulence-layer rationale.
      turbulence: 0.2,
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

    updateParticles(this.particles, time.delta / 1000, time.elapsed);

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
        // Track A2: the diverted parcel un-diverts exactly at its own lap
        // reset, the same "explicit reset at the boundary" shape the
        // pallet-settle bounce elsewhere in this codebase already uses.
        if (parcel === this.diverterParcel) parcel.userData.diverted = false;
      }
    });

    // Track A2: the diverter's decision moment. The paddle only swings
    // out for a brief symmetric window AROUND the junction (a real sorter
    // arm redirects a box, then retracts -- it doesn't stay deployed for
    // the box's whole remaining trip); the parcel's own sideways offset
    // LATCHES on once it enters that window and stays diverted for the
    // rest of the lap, reset only at the wrap above. Two different
    // lifetimes sharing one proximity computation, not two independent
    // signals.
    const diverterMotionT = dampFactor(DIVERTER_MOTION_HALF_LIFE_MS, time.delta);
    const distanceToJunction = this.diverterParcel.position.z - DIVERTER_Z;
    const armActive = Math.abs(distanceToJunction) < DIVERTER_TRIGGER_WINDOW;
    if (distanceToJunction > -DIVERTER_TRIGGER_WINDOW) this.diverterParcel.userData.diverted = true;

    this.diverterArmDeploy += ((armActive ? 1 : 0) - this.diverterArmDeploy) * diverterMotionT;
    this.diverter.userData.armPivot.rotation.y =
      DIVERTER_ARM_RETRACTED_Y + (DIVERTER_ARM_DEPLOYED_Y - DIVERTER_ARM_RETRACTED_Y) * this.diverterArmDeploy;

    const targetOffsetX = this.diverterParcel.userData.diverted ? DIVERTER_OFFSET_X : 0;
    const baseX = this.diverterParcel.userData.baseX;
    this.diverterParcel.position.x += (baseX + targetOffsetX - this.diverterParcel.position.x) * diverterMotionT;

    const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * pulse;
    this.arches.userData.glowMeshes.forEach((glow, i) => {
      glow.scale.y = 0.7 + 0.3 * Math.sin(time.elapsed / PULSE_PERIOD + i);
    });

    // Cinematic Motion Refinement Phase, Commit 5: the new ambient beacon's
    // own pulse -- a distinct period from PULSE_PERIOD above (arch glow /
    // route line) so nothing pulses in lockstep, tied to activityWeight
    // like every other light in this chapter.
    const beaconPulse = 0.8 + 0.2 * Math.sin(time.elapsed / 2000);
    this.arches.userData.beaconLight.intensity = 1.2 * beaconPulse * this.activityWeight;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
