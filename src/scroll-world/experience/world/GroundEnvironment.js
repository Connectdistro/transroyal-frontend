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

// Ground Chapter Cinematic Realism Pass, Commit 3: one operational cycle --
// arrive -> queue -> dock-open -> unload -> dock-close -> depart -- rather
// than several independent loops. Every phase boundary below is a target
// change, not a hand-computed trajectory: the same damped-easing technique
// already used everywhere else in this codebase (dampFactor toward a
// target) naturally produces a smooth transition whenever a target
// changes, so the choreography only needs to say *what* changes at each
// boundary, not *how* to interpolate there.
const DOCK_CYCLE_MS = 24000;
// Phase boundaries, in ms into the cycle -- named constants rather than an
// object/array literal so `phaseFor()` below (called every frame from
// update()) does zero allocation, just numeric comparisons.
const PHASE_ARRIVE_END = 4000;
const PHASE_QUEUE_END = 6000;
const PHASE_DOCK_OPEN_END = 8000;
const PHASE_UNLOAD_END = 16000;
const PHASE_DOCK_CLOSE_END = 18000;
const PHASE_DEPART_END = 22000;
// PHASE_DEPART_END..DOCK_CYCLE_MS is the closing "gap" beat.

const DOCK_TRUCK_WAYPOINT_Z = DOCK_CENTER_Z + 14; // the existing dock spot
const QUEUE_WAYPOINT_Z = DOCK_CENTER_Z + 30; // the existing queue spot
const SPAWN_WAYPOINT_Z = DOCK_CENTER_Z + 55; // off-yard -- arrives from/departs to here
const DOOR_CLOSED_Y = 2.5;
const DOOR_OPEN_Y = 2.5 + 4.6;
const DOCK_MOTION_HALF_LIFE_MS = 900;
const PALLET_REVEAL_HALF_LIFE_MS = 350;

// Forklift trip waypoints/periods -- module-scope constants (not built
// inside update(), which would allocate every frame). Staggered periods
// (2600ms / 3100ms) mean the two forklifts are never in lockstep.
const FORKLIFT_DROP = { x: DOCK_CENTER_X + 2, z: DOCK_CENTER_Z - 3 };
const FORKLIFT_PICKUP = { x: DOCK_CENTER_X - 3, z: DOCK_TRUCK_WAYPOINT_Z - 3 };
const FORKLIFT_IDLE = [
  { x: DOCK_CENTER_X + 1, z: DOCK_CENTER_Z + 2 },
  { x: DOCK_CENTER_X + 4, z: DOCK_CENTER_Z + 6 },
];
const FORKLIFT_TRIP_PERIOD_MS = [2600, 3100];

/** Zero-allocation phase lookup -- named numeric comparisons, not an
 *  object/array iterated every frame. */
function phaseFor(cycleT) {
  if (cycleT < PHASE_ARRIVE_END) return 'arrive';
  if (cycleT < PHASE_QUEUE_END) return 'queue';
  if (cycleT < PHASE_DOCK_OPEN_END) return 'dockOpen';
  if (cycleT < PHASE_UNLOAD_END) return 'unload';
  if (cycleT < PHASE_DOCK_CLOSE_END) return 'dockClose';
  if (cycleT < PHASE_DEPART_END) return 'depart';
  return 'gap';
}

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

// Ground Chapter Cinematic Realism Pass, Commit 2: the yard-approach
// foreground band, nearer camera than the dock cluster itself (DOCK_CENTER
// above) -- the visitor "arrives" through a supervised industrial space
// before reaching the operation. Placed along the same sightline formula,
// roughly z=-260 to -280.
const YARD_APPROACH_X = -10;
const YARD_APPROACH_Z = -270;

/** Painted surface detail -- reuses the exact technique the highway's own
 *  dashed lane lines already use (thin, flat MeshBasicMaterial boxes laid
 *  on the asphalt), never a texture/decal. */
function createYardMarkings() {
  const group = new Group();
  const paintMaterial = new MeshBasicMaterial({ color: OFFWHITE_100, transparent: true, opacity: 0.4 });
  const hazardMaterial = new MeshBasicMaterial({ color: 0xd8a021, transparent: true, opacity: 0.5 });

  // Parking-bay markings -- a small row of painted rectangles outlining
  // where a trailer stages.
  for (let i = 0; i < 3; i += 1) {
    const bay = new Group();
    const left = new Mesh(new BoxGeometry(0.08, 0.02, 5), paintMaterial);
    left.position.set(-1.3, 0.01, 0);
    const right = new Mesh(new BoxGeometry(0.08, 0.02, 5), paintMaterial);
    right.position.set(1.3, 0.01, 0);
    bay.add(left, right);
    bay.position.set(YARD_APPROACH_X + i * 3.2, 0, YARD_APPROACH_Z - 6);
    group.add(bay);
  }

  // Hazard striping -- alternating diagonal bars, the same visual language
  // real dock aprons use to mark a no-linger zone.
  for (let i = 0; i < 6; i += 1) {
    const stripe = new Mesh(new BoxGeometry(0.6, 0.02, 0.18), hazardMaterial);
    stripe.rotation.y = Math.PI / 5;
    stripe.position.set(YARD_APPROACH_X + 6 + i * 0.55, 0.01, YARD_APPROACH_Z + 4);
    group.add(stripe);
  }

  // Wheel stops at each trailer position (dock truck + queued truck).
  const stopMaterial = new MeshStandardMaterial({ color: OFFWHITE_100, roughness: 0.7, metalness: 0 });
  [DOCK_CENTER_Z + 14 + 4.5, DOCK_CENTER_Z + 30 + 4.5].forEach((z) => {
    const stop = new Mesh(new BoxGeometry(1.8, 0.2, 0.3), stopMaterial);
    stop.rotation.x = 0.2;
    stop.position.set(DOCK_CENTER_X - 3, 0.1, z);
    group.add(stop);
  });

  // Dock bumpers at the dock face itself.
  const bumperMaterial = new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.6, metalness: 0.2 });
  [-4.3, -1.7].forEach((x) => {
    const bumper = new Mesh(new CylinderGeometry(0.15, 0.15, 0.8, 8), bumperMaterial);
    bumper.rotation.z = Math.PI / 2;
    bumper.position.set(DOCK_CENTER_X + x, 0.6, DOCK_CENTER_Z + 7.4);
    group.add(bumper);
  });

  return group;
}

/** Safety/security props -- cheap, repeated, individually varied so a row
 *  never reads as copy-pasted (per-instance jitter + varyMaterial). */
function createYardSafety() {
  const group = new Group();
  const coneMaterial = new MeshStandardMaterial({ color: 0xd8621a, roughness: 0.55, metalness: 0 });
  const bollardMaterial = new MeshStandardMaterial({ color: 0x0c1338, roughness: 0.5, metalness: 0.3 });
  const bollardBandMaterial = new MeshBasicMaterial({ color: OFFWHITE_100 });
  const fenceMaterial = new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.6, metalness: 0.35 });
  const fireBoxMaterial = new MeshStandardMaterial({ color: 0x8a1c1c, roughness: 0.5, metalness: 0.2 });
  const fireBoxEdge = new MeshBasicMaterial({ color: OFFWHITE_100 });

  for (let i = 0; i < 5; i += 1) {
    const material = coneMaterial.clone();
    varyMaterial(material, 400 + i);
    const cone = new Mesh(new CylinderGeometry(0.02, 0.22, 0.55, 8), material);
    cone.position.set(YARD_APPROACH_X + 3 + i * 2.1 + (i % 2) * 0.3, 0.275, YARD_APPROACH_Z - 1 - (i % 2) * 0.6);
    group.add(cone);
  }

  for (let i = 0; i < 6; i += 1) {
    const bollardMat = bollardMaterial.clone();
    varyMaterial(bollardMat, 420 + i);
    const bollard = new Mesh(new CylinderGeometry(0.14, 0.14, 0.9, 10), bollardMat);
    const band = new Mesh(new CylinderGeometry(0.15, 0.15, 0.15, 10), bollardBandMaterial);
    band.position.y = 0.15;
    bollard.add(band);
    bollard.position.set(YARD_APPROACH_X - 6 + i * 3.4, 0.45, YARD_APPROACH_Z + 8);
    group.add(bollard);
  }

  // Low security fencing along the yard's far edge (background band).
  const postGeometry = new CylinderGeometry(0.08, 0.08, 1.1, 8);
  const railGeometry = new BoxGeometry(18, 0.06, 0.06);
  for (let i = 0; i < 2; i += 1) {
    const post = new Mesh(postGeometry, fenceMaterial);
    post.position.set(DOCK_CENTER_X - 14 + i * 18, 0.55, DOCK_CENTER_Z - 18);
    group.add(post);
  }
  [0.4, 0.9].forEach((y) => {
    const rail = new Mesh(railGeometry, fenceMaterial);
    rail.position.set(DOCK_CENTER_X - 5, y, DOCK_CENTER_Z - 18);
    group.add(rail);
  });

  const fireBox = new Mesh(new BoxGeometry(0.5, 0.7, 0.35), fireBoxMaterial);
  const fireBoxTrim = new Mesh(new BoxGeometry(0.54, 0.1, 0.39), fireBoxEdge);
  fireBoxTrim.position.y = 0.3;
  fireBox.add(fireBoxTrim);
  fireBox.position.set(DOCK_CENTER_X - 7.5, 0.35, DOCK_CENTER_Z + 0.8);
  group.add(fireBox);

  return group;
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

    // Ground Chapter Cinematic Realism Pass, Commit 2: static industrial
    // detail -- markings/safety props around the dock/yard built above.
    this.group.add(createYardMarkings(), createYardSafety());

    // Ground Chapter Cinematic Realism Pass, Commit 3: the choreography
    // cycle's state (see update() for the full state machine). `dockTruck`/
    // `queuedTruck` (built in Commit 1) swap roles once per cycle rather
    // than being instantiated fresh -- "recycled from a small pool."
    this.dockCyclePhase = 'gap';
    this.dockTruck.userData.targetZ = this.dockTruck.position.z;
    this.queuedTruck.userData.targetZ = this.queuedTruck.position.z;

    // A third small vehicle for an independent reverse/return loop near the
    // dock, deliberately never synced to the main cycle ("staggered
    // timing"). Reuses createTruck() (the same rig the highway fleet and
    // dock trucks already build) rather than a bespoke shape -- this
    // chapter's existing vocabulary is already the right scale/silhouette
    // for a yard service vehicle.
    this.serviceVehicle = createTruck(0x1a2440, 60);
    this.serviceVehicle.position.set(DOCK_CENTER_X + 9, 0, DOCK_CENTER_Z + 4);
    this.serviceVehicle.rotation.y = Math.PI / 2;
    this.serviceVehicle.userData.baseX = this.serviceVehicle.position.x;
    this.group.add(this.serviceVehicle);

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
    this.fleet.userData.trucks.forEach((truck, truckIndex) => {
      const distanceToWrap =
        truck.userData.direction > 0 ? REGION_Z + halfLength - truck.position.z : truck.position.z - (REGION_Z - halfLength);
      const taper = Math.max(MIN_TAPER_FACTOR, Math.min(1, distanceToWrap / WRAP_TAPER_DISTANCE));
      const desiredSpeed = truck.userData.targetSpeed * taper;
      truck.userData.speed += (desiredSpeed - truck.userData.speed) * velocityT;

      truck.position.z += truck.userData.speed * truck.userData.direction * deltaSeconds;
      if (truck.position.z > REGION_Z + halfLength) truck.position.z = REGION_Z - halfLength;
      if (truck.position.z < REGION_Z - halfLength) truck.position.z = REGION_Z + halfLength;

      // Ground Chapter Cinematic Realism Pass, Commit 3: additive refinement
      // only -- the wrap/taper system above is untouched. A sub-millimeter,
      // high-frequency sine reads as idle engine vibration; a brief pitch
      // that grows as `taper` shrinks (i.e. exactly while the truck is
      // decelerating into its wrap) reads as braking, then releases once
      // taper recovers past the wrap.
      truck.position.y = Math.sin(time.elapsed / 90 + truckIndex * 1.7) * 0.004;
      truck.rotation.x = (1 - taper) * 0.05 * truck.userData.direction;
    });

    const pulse = 1 - 0.2 + 0.2 * Math.sin(time.elapsed / 3800);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * pulse;

    this.updateDockCycle(time);
  }

  /** Ground Chapter Cinematic Realism Pass, Commit 3: the dock's single
   *  operational cycle (arrive -> queue -> dock-open -> unload -> dock-
   *  close -> depart -> gap), replacing what would otherwise be several
   *  unrelated animation loops. Every moving part here is a target-plus-
   *  damped-ease, the same convention already used throughout this
   *  codebase -- no per-frame allocation, no new update loop (called from
   *  update() above, which World.update() already calls once per frame). */
  updateDockCycle(time) {
    const cycleT = time.elapsed % DOCK_CYCLE_MS;
    const phase = phaseFor(cycleT);
    const motionT = dampFactor(DOCK_MOTION_HALF_LIFE_MS, time.delta);

    // Role swap -- once, exactly on entering 'arrive' (not 'depart': the
    // departing truck needs the whole depart+gap window to actually reach
    // SPAWN_WAYPOINT_Z under its own unswapped label first, or swapping
    // earlier would immediately reverse it mid-departure). By the time
    // 'arrive' begins, the truck that was docked has already reached
    // SPAWN -- swapping here means it picks up the *existing* "ease toward
    // QUEUE unless phase is gap" target under its new queuedTruck label,
    // which is exactly the arriving motion; the truck that was queued
    // picks up "ease toward DOCK unless phase is depart/gap" under its new
    // dockTruck label, which is exactly it pulling up to the dock. Not a
    // new instantiation -- the same two rigs alternate roles every cycle
    // ("recycled from a small pool").
    if (phase === 'arrive' && this.dockCyclePhase !== 'arrive') {
      const previousDock = this.dockTruck;
      this.dockTruck = this.queuedTruck;
      this.queuedTruck = previousDock;
    }
    this.dockCyclePhase = phase;

    this.queuedTruck.userData.targetZ = phase === 'gap' ? SPAWN_WAYPOINT_Z : QUEUE_WAYPOINT_Z;
    this.dockTruck.userData.targetZ = phase === 'depart' || phase === 'gap' ? SPAWN_WAYPOINT_Z : DOCK_TRUCK_WAYPOINT_Z;
    this.dockTruck.position.z += (this.dockTruck.userData.targetZ - this.dockTruck.position.z) * motionT;
    this.queuedTruck.position.z += (this.queuedTruck.userData.targetZ - this.queuedTruck.position.z) * motionT;

    // Dock door: this is what its open/close easing is *for* -- not a
    // standalone decorative loop.
    const doorTargetY = phase === 'dockOpen' || phase === 'unload' ? DOOR_OPEN_Y : DOOR_CLOSED_Y;
    this.dockDoor.position.y += (doorTargetY - this.dockDoor.position.y) * motionT;

    // Pallet stack: each pallet reveals at its own threshold within the
    // unload window -- a visibly growing stack, not an instant swap -- and
    // resets once the cycle moves past it.
    const unloadDuration = PHASE_UNLOAD_END - PHASE_DOCK_OPEN_END;
    const isStacking = phase === 'unload' || phase === 'dockClose';
    const palletT = dampFactor(PALLET_REVEAL_HALF_LIFE_MS, time.delta);
    this.palletPool.forEach((pallet, i) => {
      const revealAt = PHASE_DOCK_OPEN_END + (i / this.palletPool.length) * unloadDuration;
      const targetScale = isStacking && cycleT >= revealAt ? 1 : 0;
      pallet.scale.setScalar(pallet.scale.x + (targetScale - pallet.scale.x) * palletT);
    });

    // Forklifts: active only during 'unload', ferrying between the dock
    // truck and the pallet stack on their own staggered trip periods (never
    // synced to each other or to the main cycle) with a natural pause at
    // each end -- the ease simply catches up before the trip phase moves
    // past the hold window, no explicit "wait" state needed.
    const unloadElapsed = cycleT - PHASE_DOCK_OPEN_END;
    this.forklifts.forEach((forklift, i) => {
      const idle = FORKLIFT_IDLE[i];
      let targetX = idle.x;
      let targetZ = idle.z;
      if (phase === 'unload') {
        const period = FORKLIFT_TRIP_PERIOD_MS[i];
        const tripPhase = ((unloadElapsed + i * 900) % period) / period;
        const atDrop = tripPhase < 0.5;
        targetX = atDrop ? FORKLIFT_DROP.x : FORKLIFT_PICKUP.x;
        targetZ = atDrop ? FORKLIFT_DROP.z : FORKLIFT_PICKUP.z;
      }
      const dz = targetZ - forklift.position.z;
      forklift.position.x += (targetX - forklift.position.x) * motionT;
      forklift.position.z += dz * motionT;
      // A brief pitch proportional to remaining distance -- "leans while
      // moving, levels out as it settles."
      forklift.rotation.x = Math.max(-0.15, Math.min(0.15, dz * 0.02));
      const forkGroup = forklift.userData.forkGroup;
      forkGroup.rotation.x =
        phase === 'unload' ? Math.sin(time.elapsed / 480 + i * 2) * 0.12 : forkGroup.rotation.x * (1 - motionT);
    });

    // Reversing service vehicle -- a short, continuous reverse/return loop
    // on its own period, deliberately independent of the dock cycle above
    // ("staggered timing," never one metronomic machine).
    this.serviceVehicle.position.x = this.serviceVehicle.userData.baseX + Math.sin(time.elapsed / 3300) * 4;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
