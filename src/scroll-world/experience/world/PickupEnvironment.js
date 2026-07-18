import {
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
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

const DOCK_COLOR = 0x080d33;
const STRUCTURE_COLOR = 0x0a1030;
const BAY_COLOR = 0x020410;
const VEHICLE_COLOR = 0x0c1338;
const RUBBER_COLOR = 0x05070f;
const ELECTRIC_500 = 0x2f8bff;
const ELECTRIC_400 = 0x4fa3ff;
const ROYAL_600 = 0x2540b0;
const OFFWHITE_100 = 0xeef2ff;
// The Lighting Bible's one standing exception (Section 12 / Addendum 32.5):
// natural skin tone, never tinted by the world's cool grade.
const SKIN_TONE = 0xc48a6a;

// Pickup's own region of the single continuous scene graph (Section 9),
// centered well past Origin's geometry (which ends around z = -46) so the
// two chapters never overlap.
const REGION_Z = -95;

const PULSE_PERIOD = 4200;
const PULSE_DEPTH = 0.22;
// Cinematic Polish Phase, Commit 4: a slower, calmer pulse than the route
// line's own -- a scanner practical waiting on a scan, not a busier motif.
const SCAN_PULSE_PERIOD = 2200;
const SCAN_PULSE_DEPTH = 0.15;

// Choreography Refinement Pass, Track A1: this chapter's decision moment --
// "the driver accepts the shipment and closes the cargo door." Spends most
// of a long, calm cycle OPEN (that's this chapter's own signature frame:
// "van parked, cargo door open, package entering"), then closes slowly and
// deliberately, matching this file's own documented pace ("nothing is
// rushed... everything feels deliberate") -- a much longer cycle and a much
// slower ease than Ground's dock door, which is a busy operational cycle by
// contrast.
const DOOR_CYCLE_MS = 42000;
const DOOR_OPEN_PHASE_END = 34000;
const DOOR_MOTION_HALF_LIFE_MS = 2200;
const DOOR_CLOSED_Y = 1.5;
const DOOR_OPEN_Y = 4.1;
const PARCEL_REVEAL_HALF_LIFE_MS = 400;
// The package only reads as "entering" while the door is genuinely open,
// not mid-motion -- reuses the door's own live position rather than a
// second timer, the same "one signal, two dependents" idiom the Sorting
// diverter above uses for its arm/parcel.
const PARCEL_VISIBLE_THRESHOLD = DOOR_CLOSED_Y + (DOOR_OPEN_Y - DOOR_CLOSED_Y) * 0.6;

function createDockFloor() {
  const geometry = new BoxGeometry(34, 0.4, 30);
  const material = new MeshPhysicalMaterial({
    color: DOCK_COLOR,
    metalness: 0.05,
    roughness: 0.85,
    clearcoat: 0,
  });
  const floor = new Mesh(geometry, material);
  floor.position.set(0, -0.2, REGION_Z);
  floor.receiveShadow = true;
  return floor;
}

const RIB_COUNT = 7;
const RIB_SPAN = 30;

/** A ribbed facade, not one flat wall (Addendum 32.4: "exposed structural
 *  ribs at a single repeating module... every location shows its bones" --
 *  the same module Origin's atrium is built from, Section 14's "same
 *  architectural DNA, expressed differently at each scale"). A single flat
 *  slab facing the key light head-on reads as a blown-out flat wash and
 *  fails the Cinematography Bible's three-layer depth rule (Addendum 32.3);
 *  a recessed dark panel behind bright rib edges reads as depth instead. */
function createDockWall() {
  const group = new Group();
  const structureMaterial = new MeshStandardMaterial({ color: STRUCTURE_COLOR, roughness: 0.65, metalness: 0.2 });
  const glowMaterial = new MeshBasicMaterial({ color: ELECTRIC_500 });
  const bayMaterial = new MeshStandardMaterial({ color: BAY_COLOR, roughness: 0.95, metalness: 0 });

  // Recessed panel sits well behind the ribs -- set back further into the
  // fog, and self-shadowed by the ribs in front of it, so it reads dark and
  // hazy rather than lit flat.
  const panel = new Mesh(new BoxGeometry(34, 7.5, 0.3), bayMaterial);
  panel.position.set(0, 4, REGION_Z - 18);
  panel.receiveShadow = true;
  group.add(panel);

  for (let i = 0; i < RIB_COUNT; i += 1) {
    const x = -RIB_SPAN / 2 + (i * RIB_SPAN) / (RIB_COUNT - 1);
    const rib = new Mesh(new BoxGeometry(0.4, 8, 0.6), structureMaterial);
    rib.position.set(x, 4, REGION_Z - 15);
    rib.castShadow = true;
    rib.receiveShadow = true;
    group.add(rib);

    const glow = new Mesh(new BoxGeometry(0.12, 7.4, 0.06), glowMaterial);
    glow.position.set(x, 4, REGION_Z - 14.68);
    group.add(glow);
  }

  const bay = new Mesh(new BoxGeometry(7, 5.5, 0.35), bayMaterial);
  bay.position.set(6, 2.75, REGION_Z - 15.8);
  group.add(bay);

  const canopy = new Mesh(new BoxGeometry(13, 0.4, 4), structureMaterial);
  canopy.position.set(6, 7.6, REGION_Z - 13);
  canopy.castShadow = true;
  group.add(canopy);

  return group;
}

function createVehicle() {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: VEHICLE_COLOR, roughness: 0.4, metalness: 0.4 });
  // Choreography Refinement Pass: this chapter's own vehicle previously
  // skipped the "no perfectly uniform materials" convention every other
  // populated chapter already applies (Ground's trucks, Sorting's parcels,
  // Air's fuselage) -- one instance, so a single fixed seed, not a
  // per-loop index like those files' repeated elements.
  varyMaterial(bodyMaterial, 800);
  const glassMaterial = new MeshPhysicalMaterial({
    color: ELECTRIC_500,
    transparent: true,
    opacity: 0.32,
    roughness: 0.1,
    metalness: 0.1,
  });
  const rubberMaterial = new MeshStandardMaterial({ color: RUBBER_COLOR, roughness: 0.9, metalness: 0.1 });
  const tailMaterial = new MeshBasicMaterial({ color: ELECTRIC_400 });
  const headMaterial = new MeshBasicMaterial({ color: OFFWHITE_100 });

  const cargo = new Mesh(new BoxGeometry(3.4, 3, 6.5), bodyMaterial);
  cargo.position.set(0, 1.7, 0);
  cargo.castShadow = true;
  cargo.receiveShadow = true;
  group.add(cargo);

  const cab = new Mesh(new BoxGeometry(2.6, 2.2, 2.4), bodyMaterial);
  cab.position.set(0, 1.3, 4.2);
  cab.castShadow = true;
  group.add(cab);

  const windshield = new Mesh(new BoxGeometry(2.3, 1.1, 0.1), glassMaterial);
  windshield.position.set(0, 1.7, 5.35);
  group.add(windshield);

  const wheelGeometry = new CylinderGeometry(0.55, 0.55, 0.4, 16);
  [
    [-1.75, 0.55, 2.4],
    [1.75, 0.55, 2.4],
    [-1.75, 0.55, -2.6],
    [1.75, 0.55, -2.6],
  ].forEach(([x, y, z]) => {
    const wheel = new Mesh(wheelGeometry, rubberMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
  });

  [-1.55, 1.55].forEach((x) => {
    const tail = new Mesh(new BoxGeometry(0.15, 0.25, 0.05), tailMaterial);
    tail.position.set(x, 2, -3.28);
    group.add(tail);

    const head = new Mesh(new BoxGeometry(0.15, 0.2, 0.05), headMaterial);
    head.position.set(x, 1.5, 5.42);
    group.add(head);
  });

  // Track A1: a dark interior backdrop, fixed, revealed once the door
  // above slides up -- the same recessed-dark-panel-behind-a-moving-door
  // technique Ground's own dock door already uses.
  const interior = new Mesh(new BoxGeometry(2.8, 2.4, 0.2), new MeshStandardMaterial({ color: 0x02030a, roughness: 0.9, metalness: 0 }));
  interior.position.set(0, 1.6, -3.4);
  group.add(interior);

  // The rear cargo door -- split out from the cargo box's own rear face
  // rather than fused into it, so it can slide independently. Rests at
  // DOOR_OPEN_Y (see this file's own module-scope constants) so the
  // chapter's own signature frame ("cargo door open") is the visual
  // default; update() eases it toward DOOR_CLOSED_Y only during the
  // decision-moment window.
  const doorMaterial = bodyMaterial.clone();
  const door = new Mesh(new BoxGeometry(3, 2.6, 0.15), doorMaterial);
  door.position.set(0, DOOR_OPEN_Y, -3.32);
  door.castShadow = true;
  group.add(door);

  // Track A1: the package "entering" -- CONTAINER_COLORS[0]'s own hex from
  // GroundEnvironment.js, duplicated here rather than imported (sibling
  // environment files stay independent, the same convention already
  // established between Ground/Air/FinalMile) -- "the same shipment"
  // echoed at its very first chapter. Scale-revealed only while the door
  // reads as genuinely open, the same idiom Ground's pallet stack uses.
  const parcel = new Mesh(new BoxGeometry(0.9, 0.7, 0.7), new MeshStandardMaterial({ color: 0x2f5fae, roughness: 0.5, metalness: 0.2 }));
  parcel.position.set(0, 0.55, -2.6);
  parcel.castShadow = true;
  parcel.scale.setScalar(0);
  group.add(parcel);

  group.userData.door = door;
  group.userData.parcel = parcel;

  group.position.set(9, 0, REGION_Z + 6);
  group.userData.baseY = group.position.y;
  group.rotation.y = -0.35;
  return group;
}

function createDriver() {
  const group = new Group();
  const clothingMaterial = new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.7, metalness: 0.1 });
  const skinMaterial = new MeshStandardMaterial({ color: SKIN_TONE, roughness: 0.6, metalness: 0 });
  varyMaterial(clothingMaterial, 801);
  varyMaterial(skinMaterial, 802);

  const body = new Mesh(new CapsuleGeometry(0.28, 1.05, 4, 8), clothingMaterial);
  body.position.y = 0.93;
  body.castShadow = true;
  group.add(body);

  const head = new Mesh(new SphereGeometry(0.16, 16, 16), skinMaterial);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);

  group.position.set(4, 0, REGION_Z + 8);
  return group;
}

/** The handheld scanner (Section 23: "scanner as the sharp foreground focal
 *  point"). Given real geometric presence and placed nearest the camera of
 *  any element in the scene -- the Cinematography Bible's sharp foreground
 *  layer (Addendum 32.3), with the vehicle and driver as midground and the
 *  ribbed facade receding as hazy background behind them. */
function createScanPractical() {
  const group = new Group();

  const body = new Mesh(
    new BoxGeometry(0.16, 0.26, 0.06),
    new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.4, metalness: 0.3 })
  );
  const screenGlow = new Mesh(new BoxGeometry(0.1, 0.1, 0.01), new MeshBasicMaterial({ color: OFFWHITE_100 }));
  screenGlow.position.set(0, 0.04, 0.034);
  group.add(body, screenGlow);
  group.position.set(4.5, 1.2, REGION_Z + 10.5);
  group.rotation.set(-0.3, 0.5, 0.15);

  // A practical never illuminates more than its immediate surroundings
  // (Lighting Bible Section 12) -- short distance, real decay, never a third
  // full light source.
  const light = new PointLight(OFFWHITE_100, 3.2, 3.5, 2);
  light.position.copy(group.position);

  return { group, light };
}

/** Track B2/B3: ground-wear decals and an abstract bay-number panel,
 *  reusing Ground's own established techniques exactly (createYardMarkings()'s
 *  thin painted-box decals, createYardSignage()'s flat-panel-plus-emissive-
 *  edge convention) rather than inventing a new visual language for this
 *  chapter. Pickup's own dock floor previously had zero surface detail at
 *  all -- a single flat material with nothing painted or worn into it. */
function createGroundDetail() {
  const group = new Group();

  const wearMaterial = new MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.3 });
  // Scuffed patches under the vehicle's own wheel positions and the
  // driver's own standing spot -- exactly where real repeated traffic
  // would actually wear the floor, not scattered decoratively.
  [
    [9 - 1.75, REGION_Z + 6 + 2.4, 0.9],
    [9 + 1.75, REGION_Z + 6 + 2.4, 0.9],
    [9 - 1.75, REGION_Z + 6 - 2.6, 0.9],
    [9 + 1.75, REGION_Z + 6 - 2.6, 0.9],
    [4, REGION_Z + 8, 1.3],
  ].forEach(([x, z, size]) => {
    const patch = new Mesh(new BoxGeometry(size, 0.02, size), wearMaterial);
    patch.position.set(x, 0.02, z);
    group.add(patch);
  });

  const panelMaterial = new MeshStandardMaterial({ color: 0x0c1338, roughness: 0.5, metalness: 0.3 });
  const panelEdgeMaterial = new MeshBasicMaterial({ color: ELECTRIC_400 });
  const panel = new Mesh(new BoxGeometry(2.4, 1, 0.15), panelMaterial);
  const panelEdge = new Mesh(new BoxGeometry(2.6, 1.2, 0.08), panelEdgeMaterial);
  panel.position.set(6, 4.4, REGION_Z - 15.65);
  panelEdge.position.set(6, 4.4, REGION_Z - 15.7);
  group.add(panel, panelEdge);

  return group;
}

function createRouteLine() {
  // Continues the route-line motif from roughly where Origin's own primary
  // curve ends, into Pickup's region, resolving at the scan point -- Section
  // 23's transition spec: "the scanned parcel becomes the visual
  // through-line, carried out of frame."
  const curve = new CatmullRomCurve3([
    new Vector3(9, 0.05, -34),
    new Vector3(8, 0.05, -55),
    new Vector3(6, 0.05, -75),
    new Vector3(5, 0.05, -87),
    new Vector3(4.5, 0.05, REGION_Z + 10.5),
  ]);
  const material = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.85 });
  material.userData.baseOpacity = material.opacity;
  const line = new Mesh(new TubeGeometry(curve, 100, 0.05, 8, false), material);
  return line;
}

/**
 * The Warehouse / Pickup Point (Production Handbook Section 23, Scene 02) --
 * the shipment's first human touchpoint. Occupies its own region of the
 * single continuous scene graph (Section 9: `REGION_Z`), positioned well
 * past Origin's own geometry so the two chapters never overlap. Framing
 * belongs entirely to the Production Camera's `pickup` shot
 * (camera/shots.js) -- this class carries no camera state.
 */
export class PickupEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();
    this.vehicle = createVehicle();
    this.group.add(createDockFloor(), createDockWall(), createGroundDetail(), this.vehicle, createDriver());

    const { group: scanGroup, light: scanLight } = createScanPractical();
    this.group.add(scanGroup, scanLight);
    // Cinematic Polish Phase, Commit 4: the vehicle/driver stay static
    // (mid-scan, a deliberate narrative moment -- see this file's own
    // constant-velocity motion decision), but the scanner practical itself
    // gets a subtle idle pulse so the chapter still reads as alive.
    // Light/intensity only, never `.position` -- never implies the vehicle
    // is moving.
    this.scanLight = scanLight;
    this.baseScanLightIntensity = scanLight.intensity;

    this.routeLine = createRouteLine();
    this.group.add(this.routeLine);

    this.particles = createParticles({
      count: 140,
      spreadX: 20,
      spreadZ: 30,
      height: 7,
      offsetZ: REGION_Z,
      opacity: 0.35,
      // Cinematic Motion Refinement Phase, Commit 5: opts into the existing
      // turbulence layer (createParticles.js) -- "layered cloud drift /
      // subtle wind" reusing infrastructure Origin/Ground already use, not
      // a new mechanism. Modest relative to Ground's own 0.25-0.3.
      turbulence: 0.2,
    });
    this.group.add(this.particles);

    // Section 23: "Key light in this chapter's own accent (electric blue,
    // brighter register), fill in the constant royal blue."
    const { key, fill } = createLights({
      keyIntensity: 2.6,
      keyPosition: [1, 14, REGION_Z + 22],
      fillColor: ROYAL_600,
      fillIntensity: 1.1,
      fillPosition: [-12, 7, REGION_Z + 18],
      keyTarget: [9, 1.7, REGION_Z + 6],
    });
    this.keyLight = key;
    this.fillLight = fill;
    this.group.add(key, key.target, fill, fill.target);

    // Cinematic Integration Phase, Commit 1: see OriginEnvironment.js for
    // the full rationale -- identical pattern, repeated per region rather
    // than shared via a base class (no base class exists among these 7
    // regions today).
    this.id = 'pickup';
    this.baseKeyIntensity = this.keyLight.intensity;
    this.baseFillIntensity = this.fillLight.intensity;
    this.baseParticleOpacity = this.particles.material.opacity;
    this.activityWeight = 1;
    this.targetActivityWeight = 1;
    this.activityFloor = DEFAULT_ACTIVITY_FLOOR;

    // Cinematic Polish Phase, Commit 1: see OriginEnvironment.js.
    const tint = LIGHT_TINTS.pickup;
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

    const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * pulse;

    const scanPulse = 1 - SCAN_PULSE_DEPTH + SCAN_PULSE_DEPTH * Math.sin((time.elapsed / SCAN_PULSE_PERIOD) * Math.PI * 2);
    this.scanLight.intensity = this.baseScanLightIntensity * this.activityWeight * scanPulse;

    // Track A1: the vehicle's own idle vibration -- previously completely
    // static, unlike every other populated chapter's vehicles. Position
    // only (never rotation/target), the exact idiom Ground's own truck
    // fleet already uses for "engine running, not moving."
    this.vehicle.position.y = this.vehicle.userData.baseY + Math.sin(time.elapsed / 95) * 0.004;

    const doorCycleT = time.elapsed % DOOR_CYCLE_MS;
    const doorTargetY = doorCycleT < DOOR_OPEN_PHASE_END ? DOOR_OPEN_Y : DOOR_CLOSED_Y;
    const doorMotionT = dampFactor(DOOR_MOTION_HALF_LIFE_MS, time.delta);
    const door = this.vehicle.userData.door;
    door.position.y += (doorTargetY - door.position.y) * doorMotionT;

    const parcelTargetScale = door.position.y > PARCEL_VISIBLE_THRESHOLD ? 1 : 0;
    const parcel = this.vehicle.userData.parcel;
    const parcelT = dampFactor(PARCEL_REVEAL_HALF_LIFE_MS, time.delta);
    parcel.scale.setScalar(parcel.scale.x + (parcelTargetScale - parcel.scale.x) * parcelT);
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
