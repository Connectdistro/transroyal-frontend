import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
} from 'three';
import { createLights } from './createLights.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR, LIGHT_TINT_HALF_LIFE_MS } from '../utils/damp.js';
import { LIGHT_TINTS } from '../camera/shots.js';
import { varyMaterial } from './materialVariation.js';

// Ground Chapter Full Rebuild, Step 1: bare class shell only -- every
// piece of visual content (highway, fleet, dock building/yard, forklifts,
// service vehicle, signage/markings/safety, route line, particles) has
// been removed per the approved rebuild plan and is rebuilt fresh, step
// by step, against the real reference (reference/ground/ground
// reference.mp4) rather than the previous incrementally-accreted layout.
// What's KEPT here is the class's own integration contract -- the thing
// World.js/scene-blend.js/camera-sync.js actually call into -- per
// implementation-notes.md's own "preserve Chapter Manager/CameraRig/
// Animation framework/Lighting" rule: constructor shape, update(time),
// setActivity(state), setLightTint(key, fill), this.id, the
// activityWeight/light-tint system, and REGION_Z's role positioning this
// chapter in the shared scene graph between Sorting and Air.
const REGION_Z = -330;
const ELECTRIC_500 = 0x2f8bff;
const ROYAL_600 = 0x2540b0;
const OFFWHITE_100 = 0xeef2ff;
const ASPHALT_COLOR = 0x232428;
const HUB_COLOR = 0x565b66;
const RUBBER_COLOR = 0x05070f;
const HIGHWAY_LENGTH = 100;
// Ground Chapter Full Rebuild, Step 3 fix: re-checked live against the
// new angled warehouse's own MEASURED bounds (world x -10.2 to 22.4,
// read via a per-mesh traversal, not estimated) -- the original Step 2
// values (carried over from the old, smaller footprint) overlapped 3 of
// 4 lanes once actually checked. Widened west/east spread with real
// clearance margin on both sides.
const LANE_X = [-19, -15, 23, 29];
const FLEET_SPEED = 6.5;
const VELOCITY_HALF_LIFE_MS = 300;
const WRAP_TAPER_DISTANCE = HIGHWAY_LENGTH * 0.12;
const MIN_TAPER_FACTOR = 0.15;
const BRAKE_DIVE_AMPLITUDE = 0.035;
const TRUCK_WHEEL_RADIUS = 0.5;

/** Zero-allocation wheel roll -- reused by every wheeled vehicle this
 *  chapter builds (Logistics Choreography Phase convention). */
function rollWheels(wheels, deltaDistance, radius) {
  const deltaAngle = deltaDistance / radius;
  wheels.forEach((wheel) => {
    wheel.rotation.x += deltaAngle;
  });
}

/** The shared truck rig -- highway fleet, dock/queue trucks, and any
 *  static dressing all build from this one function (Ground Chapter
 *  Cinematic Realism Pass convention: one rig, many roles). `hullMeshes`
 *  is what a real-GLB swap (see a later step) hides; headlights/
 *  tailLights/indicators stay visible as small practical-light
 *  attachments since the static GLB has no emissive rig of its own. */
function createTruck(color, seed = 0, { livery = false } = {}) {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 });
  varyMaterial(bodyMaterial, seed);
  const rubberMaterial = new MeshStandardMaterial({ color: RUBBER_COLOR, roughness: 0.9, metalness: 0.1 });
  // Physical vehicle function -- real-world red, not the brand's blue
  // (Material Language Guide: taillights are Physical, real-world
  // convention wins). Matches Air's own anti-collision beacon red.
  const tailLightMaterial = new MeshBasicMaterial({ color: 0xff3b30 });

  const cargo = new Mesh(new BoxGeometry(3, 3, 8), bodyMaterial);
  cargo.position.set(0, 1.6, 0);
  cargo.castShadow = true;
  group.add(cargo);

  const cab = new Mesh(new BoxGeometry(2.6, 2.4, 2.2), bodyMaterial);
  cab.position.set(0, 1.4, 5);
  cab.castShadow = true;
  group.add(cab);

  const wheelGeometry = new CylinderGeometry(0.5, 0.5, 0.4, 14);
  const wheels = [];
  const frontWheels = [];
  [-4.5, -1.5, 1.5, 4.5].forEach((z) => {
    [-1.6, 1.6].forEach((x) => {
      const wheel = new Mesh(wheelGeometry, rubberMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      group.add(wheel);
      wheels.push(wheel);
      if (z === 4.5) frontWheels.push(wheel);
    });
  });
  group.userData.wheels = wheels;
  group.userData.frontWheels = frontWheels;

  [-1.4, 1.4].forEach((x) => {
    const tail = new Mesh(new BoxGeometry(0.15, 0.25, 0.05), tailLightMaterial);
    tail.position.set(x, 1.9, -4.1);
    group.add(tail);
  });

  const headlightMaterial = new MeshBasicMaterial({ color: OFFWHITE_100 });
  const headlights = [];
  [-1.4, 1.4].forEach((x) => {
    const headlight = new Mesh(new BoxGeometry(0.2, 0.2, 0.05), headlightMaterial);
    headlight.position.set(x, 1.9, 6.15);
    group.add(headlight);
    headlights.push(headlight);
  });
  group.userData.headlights = headlights;

  const indicatorMaterial = new MeshBasicMaterial({ color: 0xffaa33 });
  const indicators = [];
  [-1.4, 1.4].forEach((x) => {
    const indicator = new Mesh(new BoxGeometry(0.12, 0.12, 0.05), indicatorMaterial);
    indicator.position.set(x, 1.6, 6.15);
    indicator.visible = false;
    group.add(indicator);
    indicators.push(indicator);
  });
  group.userData.indicators = indicators;

  // Blue Brand Accent Phase: opt-in livery stripe -- lit MeshStandardMaterial
  // (Brand is free to "blend warm and blue," unlike Digital's "stays blue
  // regardless of lighting" rule), same canonical ELECTRIC_500 hex every
  // Digital material in this codebase already uses.
  if (livery) {
    const stripeMaterial = new MeshStandardMaterial({ color: ELECTRIC_500, roughness: 0.35, metalness: 0.25 });
    const stripeGeometry = new BoxGeometry(0.04, 0.35, 7.2);
    const stripes = [-1, 1].map((side) => {
      const stripe = new Mesh(stripeGeometry, stripeMaterial);
      stripe.position.set(side * 1.54, 1.35, -0.2);
      stripe.castShadow = true;
      group.add(stripe);
      return stripe;
    });
    group.userData.liveryStripes = stripes;
  }

  group.userData.hullMeshes = [cargo, cab, ...wheels];

  return group;
}

function createHighway() {
  const group = new Group();
  const asphaltMaterial = new MeshPhysicalMaterial({ color: ASPHALT_COLOR, metalness: 0.1, roughness: 0.9, clearcoat: 0 });
  varyMaterial(asphaltMaterial, 600);
  // Widened from 48 (centered x=0) to actually cover LANE_X's own new
  // east lane (29, truck body out to 30.6) with real margin, since the
  // wider warehouse pushed that lane further out this step.
  const asphalt = new Mesh(new BoxGeometry(60, 0.3, HIGHWAY_LENGTH), asphaltMaterial);
  asphalt.position.set(4, -0.15, REGION_Z);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  // Lane dividers -- dashed strips, reusing the electric route-line color
  // so the highway itself reads as part of the same light-trail motif.
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

/** A fleet in constant, layered motion (Section 23: "the busiest midground
 *  of the entire journey"). Each truck holds its lane and speed, wrapping
 *  from the far end back to the near end -- purposeful motion, not
 *  decoration. */
function createFleet() {
  const group = new Group();
  const trucks = [];
  const colors = [0xd2d6dc, 0xdde1e6, 0xc4c8d0];

  LANE_X.forEach((x, i) => {
    const truck = createTruck(colors[i % colors.length], i, { livery: true });
    const z = REGION_Z - HIGHWAY_LENGTH / 2 + ((i * HIGHWAY_LENGTH) / LANE_X.length);
    truck.position.set(x, 0, z);
    truck.rotation.y = i % 2 === 0 ? 0 : Math.PI;
    truck.userData.direction = i % 2 === 0 ? 1 : -1;
    truck.userData.targetSpeed = FLEET_SPEED * (0.7 + (0.3 * (i % 3)) / 2);
    truck.userData.speed = truck.userData.targetSpeed;
    group.add(truck);
    trucks.push(truck);
  });

  group.userData.trucks = trucks;
  return group;
}

/** Distant background massing, receding past the target point -- reads as
 *  a wider industrial park beyond this chapter's own operational cluster. */
function createHubSilhouettes() {
  const group = new Group();
  const baseMaterial = new MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.7, metalness: 0.2 });
  const positions = [
    [26, 7, REGION_Z - 62, 18, 14, 16],
    [-8, 4, REGION_Z - 70, 10, 8, 14],
  ];
  positions.forEach(([x, y, z, w, h, d], i) => {
    const material = baseMaterial.clone();
    varyMaterial(material, 500 + i);
    const hub = new Mesh(new BoxGeometry(w, h, d), material);
    hub.position.set(x, y / 2, z);
    group.add(hub);
  });
  return group;
}

// Ground Chapter Full Rebuild, Step 3: same sightline-tuned anchor point
// this chapter has used all session (DOCK_CENTER_X/Z) -- the camera itself
// hasn't changed, so the composition math that already worked still
// applies to the new, larger structure built against it.
const DOCK_CENTER_X = 2;
const DOCK_CENTER_Z = -310;
const CONTAINER_COLORS = [0x2f5fae, 0x8a3a2a, 0x3a6b4a];

/** Ground Chapter Full Rebuild, Step 3: an angled, two-wing warehouse --
 *  the defining shape in the real reference footage (reference/ground/
 *  ground reference.mp4), replacing the old single-facade-plus-small-bay-
 *  wing massing. Wing A runs east-west; Wing B meets it at Wing A's own
 *  east end and runs north-south into the yard, forming an L whose
 *  concave corner faces the operational cluster -- the same "roofline
 *  distinct from the main block" convention this chapter already used
 *  (Wing B's roof sits lower than Wing A's) carries over to the new
 *  shape. A dense dock row lines Wing A's own inner face (the reference's
 *  own defining read: many bays, tightly spaced, not one or two), with
 *  two more static bays along Wing B's own inner face continuing the
 *  row around the corner. Only one bay (the center of Wing A's row)
 *  returns a live door/platform pair for later choreography wiring --
 *  matching "two or three well-choreographed trucks, not ten vehicles"
 *  from this session's own established scoping instinct, the rest are
 *  static dressing (closed doors, no animation), the same technique
 *  already proven for queue-dressing trucks. */
function createWarehouse() {
  const group = new Group();
  const wallMaterial = new MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.7, metalness: 0.2 });
  varyMaterial(wallMaterial, 101);
  const roofMaterial = new MeshStandardMaterial({ color: 0x121316, roughness: 0.8, metalness: 0.1 });
  const backdropMaterial = new MeshBasicMaterial({ color: 0x0a0a0c });
  const doorMaterial = new MeshStandardMaterial({ color: 0x121316, roughness: 0.5, metalness: 0.3 });
  const platformMaterial = new MeshPhysicalMaterial({ color: ASPHALT_COLOR, roughness: 0.85, metalness: 0.1, clearcoat: 0 });

  // Wing A -- the long east-west face, widened from the old single 14-unit
  // wall to 24 units to actually hold a dense dock row.
  const wingA = new Mesh(new BoxGeometry(24, 9, 1), wallMaterial);
  wingA.position.set(0, 4.5, 0);
  wingA.castShadow = true;
  wingA.receiveShadow = true;
  const wingARoof = new Mesh(new BoxGeometry(24.4, 0.4, 1.4), roofMaterial);
  wingARoof.position.set(0, 9.2, 0);
  group.add(wingA, wingARoof);

  // Wing B -- meets Wing A at its own east end (x=12), extends south into
  // the yard. Distinctly lower roofline than Wing A's own 9-unit height.
  const wingB = new Mesh(new BoxGeometry(1, 7, 16), wallMaterial);
  wingB.position.set(12, 3.5, 8);
  wingB.castShadow = true;
  wingB.receiveShadow = true;
  const wingBRoof = new Mesh(new BoxGeometry(1.4, 0.4, 16.4), roofMaterial);
  wingBRoof.position.set(12, 7.2, 8);
  group.add(wingB, wingBRoof);

  // Canopy over Wing A's own dock row, same "cheapest believable roll-up
  // door" idiom this chapter already used -- the door mesh itself slides
  // up in a later step to reveal the dark backdrop behind it.
  const canopy = new Mesh(new BoxGeometry(24, 0.3, 5), roofMaterial);
  canopy.position.set(0, 6.5, 3);
  group.add(canopy);

  let liveDoor = null;
  let liveWarningLight = null;
  const platforms = [];

  // Dense dock row along Wing A's inner (+z) face -- 5 bays, evenly
  // spaced, matching the reference footage's own dense-row read. Only
  // the center bay (i===2) gets the live door/platform pair a later step
  // wires choreography onto; the rest are static closed doors.
  [-10, -5, 0, 5, 10].forEach((x, i) => {
    const isLive = i === 2;
    const doorBackdrop = new Mesh(new BoxGeometry(3, 4.5, 0.3), backdropMaterial);
    doorBackdrop.position.set(x, 2.4, 1);
    const door = new Mesh(new BoxGeometry(3, 4.5, 0.2), doorMaterial);
    door.position.set(x, 2.4, 1.2);
    group.add(doorBackdrop, door);

    const platform = new Mesh(new BoxGeometry(2.6, 1, 1.8), platformMaterial);
    platform.position.set(x, 0.5, 2.2);
    platform.receiveShadow = true;
    group.add(platform);

    if (isLive) {
      liveDoor = door;
      const warningLight = new PointLight(0xffaa33, 0, 3, 2);
      warningLight.position.set(x, 5.3, 1.3);
      group.add(warningLight);
      liveWarningLight = warningLight;
    } else {
      platforms.push(platform);
    }
  });

  // Two more static bays continuing the row around the corner along Wing
  // B's own inner (-x) face.
  [4, 11].forEach((z) => {
    const doorBackdrop = new Mesh(new BoxGeometry(0.3, 4, 2.6), backdropMaterial);
    doorBackdrop.position.set(11, 2.2, z);
    const door = new Mesh(new BoxGeometry(0.2, 4, 2.6), doorMaterial);
    door.position.set(10.8, 2.2, z);
    group.add(doorBackdrop, door);

    const platform = new Mesh(new BoxGeometry(1.8, 1, 2.6), platformMaterial);
    platform.position.set(9.7, 0.5, z);
    platform.receiveShadow = true;
    group.add(platform);
    platforms.push(platform);
  });

  // Stacked containers -- background-of-midground depth beyond Wing B's
  // own outer corner, distinctly colored so the stack itself reads as
  // varied.
  // Ground Chapter Full Rebuild, Step 3 fix: tucked closer to Wing B (was
  // x=16/16/19.2, measured live to extend to world x=22.4 -- overlapped 3
  // of 4 highway lanes once actually checked, not assumed clear from the
  // design sketch alone) so the highway lanes need less clearance.
  const containerGeometry = new BoxGeometry(2.4, 2.6, 6);
  const containerSpecs = [
    [13.5, 1.3, 4, 0],
    [13.5, 3.95, 4, 1],
    [16, 1.3, 6.5, 2],
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
  return { group, liveDoor, liveWarningLight, platforms, containers };
}

// Ground Chapter Full Rebuild, Step 4: forklift corridor + pallet staging,
// positioned in the L's own interior corner (between Wing A's dock row and
// Wing B), the natural staging space this angled shape creates. Two
// forklift waypoint sets (not one shared pair) -- Logistics Choreography
// Phase's own established fix for the near-collision a single shared
// DROP/PICKUP pair caused last time this was built; offsetting from the
// start avoids reintroducing it.
const FORKLIFT_DROP = [
  { x: DOCK_CENTER_X + 5, z: DOCK_CENTER_Z + 5 },
  { x: DOCK_CENTER_X + 6.1, z: DOCK_CENTER_Z + 5 },
];
const FORKLIFT_PICKUP = [
  { x: DOCK_CENTER_X, z: DOCK_CENTER_Z + 6 },
  { x: DOCK_CENTER_X + 1.4, z: DOCK_CENTER_Z + 6 },
];
const FORKLIFT_IDLE = [
  { x: DOCK_CENTER_X + 3, z: DOCK_CENTER_Z + 3 },
  { x: DOCK_CENTER_X + 6, z: DOCK_CENTER_Z + 2 },
];
const FORKLIFT_WHEEL_RADIUS = 0.32;

/** Two instances stage near the pallet pool. Amber beacon follows the same
 *  small-radius practical-light precedent every other maneuvering vehicle
 *  in this chapter already uses. */
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

  // The operator -- almost no chapter in this experience has visible
  // human presence; this is the one place in Ground's own yard a person
  // is already, structurally, standing.
  const operatorClothingMaterial = new MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.7, metalness: 0.1 });
  const operatorSkinMaterial = new MeshStandardMaterial({ color: 0xc48a6a, roughness: 0.6, metalness: 0 });
  varyMaterial(operatorClothingMaterial, seed + 10);
  varyMaterial(operatorSkinMaterial, seed + 11);
  const operatorBody = new Mesh(new CapsuleGeometry(0.22, 0.55, 4, 8), operatorClothingMaterial);
  operatorBody.position.set(0, 1.95, -0.5);
  operatorBody.castShadow = true;
  const operatorHead = new Mesh(new SphereGeometry(0.14, 16, 16), operatorSkinMaterial);
  operatorHead.position.set(0, 2.4, -0.5);
  operatorHead.castShadow = true;
  group.add(operatorBody, operatorHead);

  const forkGeometry = new BoxGeometry(0.7, 0.08, 0.15);
  const forkGroup = new Group();
  [-0.25, 0.25].forEach((x) => {
    const fork = new Mesh(forkGeometry, darkMaterial);
    fork.rotation.y = Math.PI / 2;
    fork.position.set(x, 0.25, 0.85);
    forkGroup.add(fork);
  });
  group.add(forkGroup);

  // A cargo box carried on the forks, visible only while loaded --
  // CONTAINER_COLORS[0], the same blue this chapter's own hero shipment
  // (and Pickup/Air's) already uses.
  const cargoBox = new Mesh(
    new BoxGeometry(0.8, 0.6, 0.8),
    new MeshStandardMaterial({ color: CONTAINER_COLORS[0], roughness: 0.5, metalness: 0.2 })
  );
  cargoBox.position.set(0, 0.55, 0.85);
  cargoBox.scale.setScalar(0);
  forkGroup.add(cargoBox);
  group.userData.cargoBox = cargoBox;

  const wheelGeometry = new CylinderGeometry(0.32, 0.32, 0.3, 12);
  const wheels = [];
  [-0.9, 0.9].forEach((z) => {
    [-0.55, 0.55].forEach((x) => {
      const wheel = new Mesh(wheelGeometry, darkMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.32, z);
      group.add(wheel);
      wheels.push(wheel);
    });
  });
  group.userData.wheels = wheels;

  const beacon = new Mesh(new SphereGeometry(0.12, 8, 8), new MeshBasicMaterial({ color: 0xffaa33 }));
  beacon.position.set(0, 2.0, -0.5);
  const beaconLight = new PointLight(0xffaa33, 1.6, 4, 2);
  beaconLight.position.copy(beacon.position);
  group.add(beacon, beaconLight);

  group.userData.forkGroup = forkGroup;
  group.userData.mast = mast;
  group.userData.beacon = beacon;
  group.userData.beaconLight = beaconLight;
  return group;
}

/** The pallet pool staged near FORKLIFT_DROP -- visibility/scale toggled
 *  by a later choreography step, no geometry rebuild. */
function createPalletStack() {
  const group = new Group();
  const palletBaseMaterial = new MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85, metalness: 0 });
  const cargoMaterial = new MeshStandardMaterial({ color: 0x1a2148, roughness: 0.5, metalness: 0.15 });
  const palletPool = [];
  const palletGrid = [
    [0, 0],
    [1.1, 0],
    [0, 1.1],
    [1.1, 1.1],
    [0.55, 2.2],
    [0.55, 3.25],
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
    pallet.position.set(FORKLIFT_DROP[0].x + offsetX - 0.55, 0, FORKLIFT_DROP[0].z + offsetZ - 1.6);
    group.add(pallet);
    palletPool.push(pallet);
  });
  return { group, palletPool };
}

/** Painted corridor lines marking the forklift path between the pallet
 *  stack and the dock row as its own dedicated lane -- same flat-decal
 *  idiom every other yard marking in this chapter already uses, not a new
 *  visual language. */
function createForkliftCorridorMarkings() {
  const group = new Group();
  const paintMaterial = new MeshBasicMaterial({ color: OFFWHITE_100, transparent: true, opacity: 0.35 });
  const corridorStart = { x: FORKLIFT_PICKUP[0].x - 1.8, z: FORKLIFT_PICKUP[0].z - 0.5 };
  const corridorEnd = { x: FORKLIFT_DROP[1].x + 1.8, z: FORKLIFT_DROP[1].z + 0.5 };
  [-1, 1].forEach((side) => {
    const line = new Mesh(new BoxGeometry(0.1, 0.02, 6.5), paintMaterial);
    line.rotation.y = Math.PI / 5;
    line.position.set((corridorStart.x + corridorEnd.x) / 2 + side * 2.2, 0.01, (corridorStart.z + corridorEnd.z) / 2);
    group.add(line);
  });
  return group;
}

// Ground Chapter Full Rebuild, Step 5: waypoints for the dock/queue lane,
// recalibrated for the new warehouse's own dock-face position (the live
// bay's door/platform sit around world z=-308.8/-307.8, closer to
// DOCK_CENTER_Z than the old building's own bay wing was) but keeping the
// same relative spacing the proven dock cycle already used (16 units
// dock-to-queue, 10 units queue-to-spawn). DOCK_LANE_X matches the live
// bay's own x exactly (both equal DOCK_CENTER_X) so a docked truck lines
// up with the door dead-on.
const DOCK_LANE_X = DOCK_CENTER_X;
const QUEUE_LANE_X = DOCK_LANE_X - 4;
const DOCK_TRUCK_WAYPOINT_Z = DOCK_CENTER_Z + 6;
const QUEUE_WAYPOINT_Z = DOCK_CENTER_Z + 22;
const SPAWN_WAYPOINT_Z = DOCK_CENTER_Z + 32;

/** Sells "a queue," not just one waiting truck -- static dressing further
 *  back along the queue lane's own line, past where the live queued
 *  truck (wired in a later step) will sit. Same technique proven earlier
 *  this session: idle micro-motion only, no dock-cycle participation. */
function createQueueDressing() {
  const trucks = [];
  [SPAWN_WAYPOINT_Z + 4, SPAWN_WAYPOINT_Z + 10].forEach((z, i) => {
    const truck = createTruck(i === 0 ? 0xcfd3da : 0xc4c8d0, 42 + i, { livery: true });
    truck.position.set(QUEUE_LANE_X, 0, z);
    truck.rotation.y = Math.PI;
    trucks.push(truck);
  });
  return trucks;
}

/**
 * The Container Port / Road Network (Production Handbook Section 23, Scene
 * 04). Own region of the continuous scene graph (Section 9: `REGION_Z`),
 * past Sorting's geometry. Framing belongs to the Production Camera's
 * `ground` shot (camera/shots.js) -- this class carries no camera state.
 */
export class GroundEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();

    // Ground Chapter Full Rebuild, Step 2: highway + background hub
    // silhouettes -- the lowest-risk piece, establishes the far end of
    // this chapter's own camera sightline before anything else is built
    // against it.
    this.fleet = createFleet();
    this.group.add(createHighway(), createHubSilhouettes(), this.fleet);

    // Ground Chapter Full Rebuild, Step 3: the angled two-wing warehouse +
    // dense dock row -- the defining shape from the real reference
    // footage. liveDoor/liveWarningLight/platforms/containers are exposed
    // for a later choreography-wiring step; this step only builds and
    // places the structure.
    const warehouse = createWarehouse();
    this.dockDoor = warehouse.liveDoor;
    this.dockDoorWarningLight = warehouse.liveWarningLight;
    this.dockPlatforms = warehouse.platforms;
    this.containers = warehouse.containers;
    this.group.add(warehouse.group);

    // Ground Chapter Full Rebuild, Step 4: forklift corridor + pallet
    // staging in the L's own interior corner. Forklifts sit at their idle
    // positions with ambient motion only (mast sway, beacon) for now --
    // the DROP/PICKUP cycle itself is coupled to the dock cycle's own
    // 'unload' phase, wired alongside it in a later step.
    const palletStack = createPalletStack();
    this.palletPool = palletStack.palletPool;
    this.group.add(palletStack.group, createForkliftCorridorMarkings());

    this.forklifts = [createForklift(50), createForklift(51)];
    this.forklifts.forEach((forklift, i) => {
      forklift.position.set(FORKLIFT_IDLE[i].x, 0, FORKLIFT_IDLE[i].z);
      this.group.add(forklift);
    });

    // Ground Chapter Full Rebuild, Step 5: queue-dressing trucks, same
    // proven technique from the vehicle-organization pass.
    this.queueDressingTrucks = createQueueDressing();
    this.queueDressingTrucks.forEach((truck) => this.group.add(truck));

    // These two params are only this light's initial value -- shots.js's
    // LIGHT_TINTS.ground overrides both immediately below.
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

    // Ground Chapter Cinematic Realism Pass, Commit 5: a self-contained
    // hover micro-interaction, deliberately not routed through pointer.js/
    // main.js's global CTA-hover mechanism -- Ground has no `cta` in
    // config.js (only proofPoints), so that mechanism has nothing to
    // attach to here, and widening it would ripple to every other
    // chapter's proof-points. On hover, a small, capped, one-time nudge to
    // targetActivityWeight (identical to the existing CTA-hover technique).
    this.proofPointsEl = document.querySelector('#scene-ground .scene__proof-points');
    if (this.proofPointsEl) {
      this.proofPointsEl.addEventListener(
        'pointerenter',
        (event) => {
          if (!event.target.closest?.('li')) return;
          this.targetActivityWeight = Math.min(1, this.targetActivityWeight * 1.05);
        },
        true
      );
    }

    // Ground Chapter Cinematic Realism Pass, Commit 5: inert audio hook
    // points -- no listener exists yet; a future audio layer would attach
    // to these without any change to this file. Matches the codebase's
    // existing CustomEvent convention (scene-state.js's own
    // `scene:state-change`, nav.js's `transroyal:track-open`).
    this.sectionEl = document.getElementById('scene-ground');
  }

  dispatchGroundEvent(name) {
    this.sectionEl?.dispatchEvent(new CustomEvent(name));
  }

  update(time) {
    this.activityWeight += (this.targetActivityWeight - this.activityWeight) * dampFactor(ACTIVITY_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight;
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;

    const tintT = dampFactor(LIGHT_TINT_HALF_LIFE_MS, time.delta);
    this.keyLight.color.lerp(this.targetKeyColor, tintT);
    this.fillLight.color.lerp(this.targetFillColor, tintT);

    const deltaSeconds = time.delta / 1000;
    const halfLength = HIGHWAY_LENGTH / 2;
    const velocityT = dampFactor(VELOCITY_HALF_LIFE_MS, time.delta);
    this.fleet.userData.trucks.forEach((truck, truckIndex) => {
      const distanceToWrap =
        truck.userData.direction > 0 ? REGION_Z + halfLength - truck.position.z : truck.position.z - (REGION_Z - halfLength);
      const taper = Math.max(MIN_TAPER_FACTOR, Math.min(1, distanceToWrap / WRAP_TAPER_DISTANCE));
      const desiredSpeed = truck.userData.targetSpeed * taper;
      truck.userData.speed += (desiredSpeed - truck.userData.speed) * velocityT;

      const truckDeltaZ = truck.userData.speed * truck.userData.direction * deltaSeconds;
      truck.position.z += truckDeltaZ;
      if (truck.position.z > REGION_Z + halfLength) truck.position.z = REGION_Z - halfLength;
      if (truck.position.z < REGION_Z - halfLength) truck.position.z = REGION_Z + halfLength;

      rollWheels(truck.userData.wheels, truckDeltaZ, TRUCK_WHEEL_RADIUS);

      const brakeDive = (1 - taper) ** 2 * BRAKE_DIVE_AMPLITUDE;
      truck.position.y = Math.sin(time.elapsed / 90 + truckIndex * 1.7) * 0.004 - brakeDive;
      truck.rotation.x = (1 - taper) * 0.05 * truck.userData.direction;

      truck.rotation.z = Math.sin(time.elapsed / 1750 + truckIndex * 2.3) * 0.012;
    });

    // Ground Chapter Full Rebuild, Step 4: forklifts sit at their idle
    // positions for now (the DROP/PICKUP cycle is coupled to the dock
    // cycle's own 'unload' phase, wired in a later step) -- ambient mast
    // sway and beacon rotation/blink only, so they don't read as frozen
    // props next to the genuinely animated fleet.
    this.forklifts.forEach((forklift, i) => {
      const mast = forklift.userData.mast;
      if (mast) mast.rotation.z = Math.sin(time.elapsed / 580 + i * 2.3) * 0.01;
      forklift.userData.beacon.rotation.y = time.elapsed / 260 + i * 3;
      const blink = Math.sin(time.elapsed / 340 + i * 5) > 0.6 ? 1 : 0.25;
      forklift.userData.beaconLight.intensity = 1.6 * blink * this.activityWeight;
    });

    // Ground Chapter Full Rebuild, Step 5: queue-dressing trucks never
    // move (no dock-cycle participation), but sitting perfectly rigid
    // next to genuinely animated vehicles reads as frozen -- same idle-
    // vibration bounce and body-roll formulas the highway fleet already
    // uses, without the wrap-taper/braking terms that don't apply to a
    // parked truck.
    this.queueDressingTrucks.forEach((truck, i) => {
      truck.position.y = Math.sin(time.elapsed / 90 + i * 1.7) * 0.004;
      truck.rotation.z = Math.sin(time.elapsed / 1750 + i * 2.3) * 0.012;
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
