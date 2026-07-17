import {
  BoxGeometry,
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

// Ground Chapter Cinematic Realism Pass, Commit 1: the dock/yard operation
// is the chapter's actual visual subject now, not the highway -- placed
// against the `ground` shot's own sightline (camera/shots.js:
// position {x:-26,y:6.5,z:-225} -> target {x:12,y:1.5,z:-340}), not the old
// hub-silhouette position (x:-30, effectively at the camera's own x --
// poor composition). `xCenter = -26 + ((z+225)/-115) * 38` gives the
// sightline's x at any z. z=-310 (near the target's own depth) keeps the
// whole cluster, including the dock truck backed up in front of it,
// comfortably inside frame -- an initial z=-280 placed the truck too close
// to camera and cropped it against the bottom of frame (confirmed via a
// snapshot at the `ground` shot; corrected here, not guessed). Foreground
// detail (Commit 2) sits nearer camera, around z=-260 to -275.
const DOCK_CENTER_X = 2;
const DOCK_CENTER_Z = -310;
const CONTAINER_COLORS = [0x2f5fae, 0x8a3a2a, 0x3a6b4a];

function createDockBuilding() {
  const group = new Group();
  const wallMaterial = new MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.7, metalness: 0.2 });
  varyMaterial(wallMaterial, 101);
  const roofMaterial = new MeshStandardMaterial({ color: 0x060812, roughness: 0.8, metalness: 0.1 });
  const backdropMaterial = new MeshBasicMaterial({ color: 0x02030a });
  const platformMaterial = new MeshPhysicalMaterial({ color: ASPHALT_COLOR, roughness: 0.85, metalness: 0.1, clearcoat: 0 });

  // Main warehouse block -- tall, establishes the building's real height.
  const mainWall = new Mesh(new BoxGeometry(14, 9, 1), wallMaterial);
  mainWall.position.set(0, 4.5, 0);
  mainWall.castShadow = true;
  mainWall.receiveShadow = true;
  const mainRoof = new Mesh(new BoxGeometry(14.4, 0.4, 1.4), roofMaterial);
  mainRoof.position.set(0, 9.2, 0);
  group.add(mainWall, mainRoof);

  // Loading-bay wing -- a distinctly lower massing than the main roofline
  // (Addendum-style "roofline distinct from the main block"), extending
  // toward the yard so the dock door reads as its own volume.
  const bayWing = new Mesh(new BoxGeometry(8, 5, 6), wallMaterial);
  bayWing.position.set(-3, 2.5, 4);
  bayWing.castShadow = true;
  bayWing.receiveShadow = true;
  const bayRoof = new Mesh(new BoxGeometry(8.4, 0.4, 6.4), roofMaterial);
  bayRoof.position.set(-3, 5.2, 4);
  const canopy = new Mesh(new BoxGeometry(9, 0.3, 3), roofMaterial);
  canopy.position.set(-3, 5.4, 7.5);
  group.add(bayWing, bayRoof, canopy);

  // Roll-up door + a recessed dark backdrop behind it -- Commit 3 slides
  // the door mesh up along Y to reveal the backdrop, the cheapest
  // believable "open dock door" without new geometry per frame.
  const doorBackdrop = new Mesh(new BoxGeometry(4, 5, 0.3), backdropMaterial);
  doorBackdrop.position.set(-3, 2.5, 7);
  const door = new Mesh(new BoxGeometry(4, 5, 0.2), new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.5, metalness: 0.3 }));
  door.position.set(-3, 2.5, 7.2);
  group.add(doorBackdrop, door);

  const platformPositions = [
    [-5, 0.5, 8],
    [-1, 0.5, 8],
  ];
  const platforms = platformPositions.map(([x, y, z]) => {
    const platform = new Mesh(new BoxGeometry(3, 1, 2), platformMaterial);
    platform.position.set(x, y, z);
    platform.receiveShadow = true;
    group.add(platform);
    return platform;
  });

  // Stacked containers -- background-of-midground depth beside the
  // building, distinctly colored so the stack itself reads as varied.
  const containerGeometry = new BoxGeometry(2.4, 2.6, 6);
  const containerSpecs = [
    [6, 1.3, -2, 0],
    [6, 3.95, -2, 1],
    [9.2, 1.3, 0.5, 2],
  ];
  const containers = containerSpecs.map(([x, y, z, seed]) => {
    const material = new MeshStandardMaterial({ color: CONTAINER_COLORS[seed % CONTAINER_COLORS.length], roughness: 0.55, metalness: 0.35 });
    varyMaterial(material, 200 + seed);
    const container = new Mesh(containerGeometry, material);
    container.position.set(x, y, z);
    container.castShadow = true;
    container.receiveShadow = true;
    group.add(container);
    return container;
  });

  group.position.set(DOCK_CENTER_X, 0, DOCK_CENTER_Z);
  return { group, door, platforms, containers };
}

/** Abstract, textless wayfinding -- no font/texture pipeline exists in this
 *  codebase (every material anywhere is flat-color), so "signage" and
 *  "directional arrows" are real geometric shapes rather than legible
 *  characters: chevrons built from angled boxes, and raised panel plates
 *  with an emissive edge suggesting a sign without literal text. */
function createYardSignage() {
  const group = new Group();
  const chevronMaterial = new MeshBasicMaterial({ color: OFFWHITE_100, transparent: true, opacity: 0.55 });
  const panelMaterial = new MeshStandardMaterial({ color: 0x0c1338, roughness: 0.5, metalness: 0.3 });
  const panelEdgeMaterial = new MeshBasicMaterial({ color: ELECTRIC_400 });

  [0, 3.4].forEach((offsetZ, i) => {
    const chevron = new Group();
    const bar = new BoxGeometry(1.6, 0.05, 0.35);
    const left = new Mesh(bar, chevronMaterial);
    left.rotation.y = Math.PI / 4;
    left.position.set(-0.5, 0.03, 0);
    const right = new Mesh(bar, chevronMaterial);
    right.rotation.y = -Math.PI / 4;
    right.position.set(0.5, 0.03, 0);
    chevron.add(left, right);
    chevron.position.set(DOCK_CENTER_X + 14, 0, DOCK_CENTER_Z + 22 + offsetZ * i);
    group.add(chevron);
  });

  const panel = new Mesh(new BoxGeometry(3, 1.2, 0.15), panelMaterial);
  const panelEdge = new Mesh(new BoxGeometry(3.2, 1.4, 0.08), panelEdgeMaterial);
  panel.position.set(DOCK_CENTER_X + 4, 6.5, DOCK_CENTER_Z + 0.65);
  panelEdge.position.set(DOCK_CENTER_X + 4, 6.5, DOCK_CENTER_Z + 0.6);
  group.add(panel, panelEdge);

  return group;
}

/** The staging area itself -- the two choreographed vehicles (Commit 3
 *  drives their position/the dock cycle), a pool of pre-built pallet
 *  meshes (STACK_GROW toggles visibility/scale in Commit 3, no geometry
 *  rebuild), a loading ramp, and a low boundary curb. Reuses createTruck()
 *  for both yard vehicles rather than duplicating rig geometry -- a docked/
 *  queued semi is structurally the same cab+cargo rig the highway fleet
 *  already builds, just driven by the dock cycle instead of the highway
 *  wrap logic. */
function createDockYard() {
  const group = new Group();

  const dockTruck = createTruck(0x101736, 40);
  dockTruck.position.set(DOCK_CENTER_X - 3, 0, DOCK_CENTER_Z + 14);
  dockTruck.rotation.y = Math.PI;
  const queuedTruck = createTruck(0x0d1230, 41);
  queuedTruck.position.set(DOCK_CENTER_X - 3, 0, DOCK_CENTER_Z + 30);
  queuedTruck.rotation.y = Math.PI;
  group.add(dockTruck, queuedTruck);

  const palletBaseMaterial = new MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85, metalness: 0 });
  const cargoMaterial = new MeshStandardMaterial({ color: 0x1a2148, roughness: 0.5, metalness: 0.15 });
  const palletPool = [];
  const palletGrid = [
    [0, 0],
    [1.1, 0],
    [0, 1.1],
    [1.1, 1.1],
    [0.55, 2.2],
    [0.55, 2.2 + 1.05],
  ];
  palletGrid.forEach(([offsetX, offsetZ], i) => {
    const pallet = new Group();
    const base = new Mesh(new BoxGeometry(1, 0.15, 1), palletBaseMaterial.clone());
    base.position.set(0, 0.075, 0);
    const cargoMat = cargoMaterial.clone();
    varyMaterial(cargoMat, 300 + i);
    const cargoBox = new Mesh(new BoxGeometry(0.9, 0.8, 0.9), cargoMat);
    cargoBox.position.set(0, 0.55, 0);
    cargoBox.castShadow = true;
    pallet.add(base, cargoBox);
    pallet.position.set(DOCK_CENTER_X + 2 + offsetX, 0, DOCK_CENTER_Z - 3 + offsetZ);
    group.add(pallet);
    palletPool.push(pallet);
  });

  const ramp = new Mesh(new BoxGeometry(2.6, 0.15, 2), new MeshPhysicalMaterial({ color: ASPHALT_COLOR, roughness: 0.85, metalness: 0.05, clearcoat: 0 }));
  ramp.rotation.x = -0.12;
  ramp.position.set(DOCK_CENTER_X - 3, 0.4, DOCK_CENTER_Z + 9);
  group.add(ramp);

  const curb = new Mesh(new BoxGeometry(24, 0.25, 0.4), new MeshStandardMaterial({ color: OFFWHITE_100, roughness: 0.6, metalness: 0 }));
  curb.position.set(DOCK_CENTER_X + 2, 0.12, DOCK_CENTER_Z + 34);
  group.add(curb);

  return { group, dockTruck, queuedTruck, palletPool };
}

/** Two instances stage near the pallet pool. Amber beacon follows the same
 *  small-radius practical-light precedent Pickup's scanner light already
 *  established -- never a full scene light. */
function createForklift(seed) {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: 0xd88a1a, roughness: 0.45, metalness: 0.35 });
  varyMaterial(bodyMaterial, seed);
  const darkMaterial = new MeshStandardMaterial({ color: 0x14181f, roughness: 0.6, metalness: 0.4 });

  const body = new Mesh(new BoxGeometry(1.2, 1, 2), bodyMaterial);
  body.position.set(0, 0.7, 0);
  body.castShadow = true;
  const seat = new Mesh(new BoxGeometry(0.6, 0.5, 0.6), darkMaterial);
  seat.position.set(0, 1.45, -0.5);
  const mast = new Mesh(new BoxGeometry(0.15, 2.2, 0.15), darkMaterial);
  mast.position.set(0, 1.3, 1.05);
  group.add(body, seat, mast);

  const forkGeometry = new BoxGeometry(0.7, 0.08, 0.15);
  const forkGroup = new Group();
  [-0.25, 0.25].forEach((x) => {
    const fork = new Mesh(forkGeometry, darkMaterial);
    fork.rotation.y = Math.PI / 2;
    fork.position.set(x, 0.25, 0.85);
    forkGroup.add(fork);
  });
  group.add(forkGroup);

  const wheelGeometry = new CylinderGeometry(0.32, 0.32, 0.3, 12);
  [-0.9, 0.9].forEach((z) => {
    [-0.55, 0.55].forEach((x) => {
      const wheel = new Mesh(wheelGeometry, darkMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.32, z);
      group.add(wheel);
    });
  });

  const beacon = new Mesh(new SphereGeometry(0.12, 8, 8), new MeshBasicMaterial({ color: 0xffaa33 }));
  beacon.position.set(0, 2.0, -0.5);
  const beaconLight = new PointLight(0xffaa33, 1.6, 4, 2);
  beaconLight.position.copy(beacon.position);
  group.add(beacon, beaconLight);

  group.userData.forkGroup = forkGroup;
  group.userData.beacon = beacon;
  group.userData.beaconLight = beaconLight;
  return group;
}

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

/** Ground Chapter Cinematic Realism Pass, Commit 1: hub #1 (formerly at
 *  x:-30, effectively at the camera's own x -- poor composition) is
 *  replaced by the dock building; only the two background hubs remain
 *  here, unchanged, receding past the target point exactly as before. */
function createHubSilhouettes() {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.7, metalness: 0.2 });
  const positions = [
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

    // Ground Chapter Cinematic Realism Pass, Commit 1: the dock/yard
    // operation is the chapter's actual visual subject now -- the highway
    // fleet above remains, but as supporting context. Positioned against
    // the `ground` shot's real sightline (see DOCK_CENTER_X/Z's own
    // comment). Commit 3 wires the dock door / trucks / forklifts into the
    // choreography cycle; this constructor only builds and places them.
    const dockBuilding = createDockBuilding();
    this.dockDoor = dockBuilding.door;
    this.dockPlatforms = dockBuilding.platforms;
    this.containers = dockBuilding.containers;
    this.group.add(dockBuilding.group);
    this.group.add(createYardSignage());

    const dockYard = createDockYard();
    this.dockTruck = dockYard.dockTruck;
    this.queuedTruck = dockYard.queuedTruck;
    this.palletPool = dockYard.palletPool;
    this.group.add(dockYard.group);

    this.forklifts = [createForklift(50), createForklift(51)];
    this.forklifts[0].position.set(DOCK_CENTER_X + 1, 0, DOCK_CENTER_Z + 2);
    this.forklifts[1].position.set(DOCK_CENTER_X + 4, 0, DOCK_CENTER_Z + 6);
    this.forklifts[1].rotation.y = Math.PI * 0.15;
    this.forklifts.forEach((forklift) => this.group.add(forklift));

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
