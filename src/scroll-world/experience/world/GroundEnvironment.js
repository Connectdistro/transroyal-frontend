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

// Choreography Refinement Pass, Commit 2: a small nose-down settle stacked
// on top of the existing braking pitch (rotation.x, below) -- reuses the
// same `taper` signal (already 0 while decelerating into a wrap, 1 at
// cruise) rather than a new deceleration tracker. Squared so the dip stays
// negligible until taper is genuinely low, not a straight-line ramp across
// the whole taper window.
const BRAKE_DIVE_AMPLITUDE = 0.035;

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
// Ground Chapter Cinematic Realism Pass, Commit 5 (composition review): a
// live-camera snapshot caught a transiting truck looming uncomfortably
// large -- the original +55 offset put SPAWN only 30 units from the
// camera (z=-225). Pulled to +40 (50 units out) so a truck reads as
// "just entered the yard," not oversized, throughout its whole transit.
const SPAWN_WAYPOINT_Z = DOCK_CENTER_Z + 40; // off-yard -- arrives from/departs to here
const DOOR_CLOSED_Y = 2.5;
const DOOR_OPEN_Y = 2.5 + 4.6;
const DOCK_MOTION_HALF_LIFE_MS = 900;
const PALLET_REVEAL_HALF_LIFE_MS = 350;

// Choreography Refinement Pass, Commit 1: a slow, irregular amplitude
// modulation on the existing cable/pennant sway (still the same base sines
// below) -- reads as gusting wind rather than a metronomic loop. Two
// mismatched periods multiplied together, not one, so the combined envelope
// never repeats on either period alone.
const WIND_GUST_PERIOD_A_MS = 8600;
const WIND_GUST_PERIOD_B_MS = 5200;

// Choreography Refinement Pass, Commit 3: how far (world Z) the dock truck's
// own remaining distance-to-target maps to a full-strength camera lead --
// roughly the arrive->dock leg's own length (QUEUE_WAYPOINT_Z to
// DOCK_TRUCK_WAYPOINT_Z is 16), so the lead is near-full right after a phase
// change and eases off as the truck actually reaches its target, the same
// "how fast it's actually moving" shape Air's own setTargetLead() caller
// already uses.
const DOCK_LEAD_REFERENCE_DISTANCE = 16;
const DOCK_LEAD_MAX_AMPLITUDE = 0.7;

// Logistics Choreography Phase, Commit 1: matches each wheel's own
// CylinderGeometry radius exactly (createTruck/createForklift), used to
// convert an actual per-frame position delta into a roll angle.
const TRUCK_WHEEL_RADIUS = 0.5;
const FORKLIFT_WHEEL_RADIUS = 0.32;

// Cinematic Motion Refinement Phase, Commit 2: load-settle bounce -- the
// same decaying-oscillation shape as the camera's own settle-overshoot
// (Commit 1), duplicated locally since each pallet needs its own
// independent timer (matching this codebase's own per-file-duplication
// convention rather than extracting a shared utility for six meshes).
const PALLET_SETTLE_HALF_LIFE_MS = 180;
const PALLET_SETTLE_PERIOD_MS = 260;
const PALLET_SETTLE_AMPLITUDE = 0.08;

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
// Logistics Choreography Phase, Commit 2: how far forkGroup.position.y
// rises while carrying -- clears the seat/mast comfortably (seat sits at
// y=1.45; forks start at local y=0.25, so 0.6 lift tops out around y=0.85).
const FORKLIFT_LIFT_HEIGHT = 0.6;

// Choreography Refinement Pass, Track A3 Pass 1: the "coordination" decision
// moment -- one forklift carries a pallet from the stack to the departing
// truck, closing the one gap in an otherwise fully-choreographed dock cycle
// (forklifts previously only ever moved cargo FROM the truck TO the stack,
// never the outbound leg). Reuses FORKLIFT_DROP/FORKLIFT_PICKUP verbatim as
// the two waypoints, just reversed -- the stack (FORKLIFT_DROP) is this
// trip's own source, the truck-side spot (FORKLIFT_PICKUP) is its
// destination, no new positions needed. Window sits entirely inside
// dockClose/early depart, well clear of the unload window it follows.
const LOADOUT_WINDOW_START = PHASE_UNLOAD_END;
const LOADOUT_WINDOW_END = PHASE_DEPART_END - 2000;
const LOADOUT_MIDPOINT = LOADOUT_WINDOW_START + (LOADOUT_WINDOW_END - LOADOUT_WINDOW_START) * 0.5;
// Only the first forklift performs this trip -- one clear actor for a
// single decision beat reads better than two forklifts converging on the
// same truck at once.
const LOADOUT_FORKLIFT_INDEX = 0;

/** Logistics Choreography Phase, Commit 1: rolls a vehicle's wheel meshes
 *  by the arc-length equivalent of how far it actually moved this frame --
 *  reuses each vehicle's own already-computed per-frame position delta
 *  (however it was produced: eased target, taper, sine) rather than a
 *  separate velocity/speed system, so it stays correct regardless of the
 *  motion technique behind it. Zero allocation -- forEach over an
 *  already-built array. */
function rollWheels(wheels, deltaDistance, radius) {
  const deltaAngle = deltaDistance / radius;
  wheels.forEach((wheel) => {
    wheel.rotation.x += deltaAngle;
  });
}

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

  // Logistics Choreography Phase, Commit 3: a flashing amber warning
  // light, active only while the door is actually mid-motion (reuses the
  // door's own existing position-lerp state -- see update()). Starts at
  // intensity 0, matching every other beacon's "starts off/dark" pattern.
  const doorWarningLight = new PointLight(0xffaa33, 0, 3, 2);
  doorWarningLight.position.set(-3, 5.3, 7.3);
  group.add(doorWarningLight);

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
  return { group, door, doorWarningLight, platforms, containers };
}

/** Layered lighting fixtures (Commit 4) -- a floodlight and a softer
 *  skylight under the canopy (distinct color temperatures, both small-
 *  radius practicals following the same precedent Pickup's scanner light
 *  and this file's own forklift beacons already set), emissive warehouse
 *  window strips, and two ambient-motion props (a hanging cable, a small
 *  pennant) whose sway is driven in update(). Positioned in the same
 *  dock-local coordinate space createDockBuilding() uses (its own group is
 *  offset to DOCK_CENTER_X/Z; this one is too, so the two line up). */
function createDockLighting() {
  const group = new Group();

  const fixtureMaterial = new MeshStandardMaterial({ color: 0x0a0d1a, roughness: 0.5, metalness: 0.4 });
  const floodFixture = new Mesh(new BoxGeometry(0.6, 0.2, 0.3), fixtureMaterial);
  floodFixture.position.set(-3, 5.1, 6.8);
  const floodlight = new PointLight(0xdce8ff, 2.2, 10, 2);
  floodlight.position.set(-3, 4.9, 7);
  group.add(floodFixture, floodlight);

  const skylight = new PointLight(0xffd9a0, 0.9, 14, 1.5);
  skylight.position.set(-3, 5.3, 5);
  group.add(skylight);

  const windowMaterial = new MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.85 });
  const windows = [-5.5, -0.5].map((x) => {
    const win = new Mesh(new BoxGeometry(1.6, 0.7, 0.08), windowMaterial.clone());
    win.position.set(x, 6.2, 0.55);
    group.add(win);
    return win;
  });

  const cableMaterial = new MeshStandardMaterial({ color: 0x0a0d1a, roughness: 0.6, metalness: 0.3 });
  const cable = new Mesh(new CylinderGeometry(0.03, 0.03, 1.4, 6), cableMaterial);
  cable.position.set(1.5, 4.6, 7.3);
  cable.geometry.translate(0, -0.7, 0); // pivot at the top end, for a pendulum sway
  group.add(cable);

  const pennant = new Mesh(new BoxGeometry(0.5, 0.35, 0.02), new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.6 }));
  pennant.position.set(6.5, 8.6, 0.6);
  group.add(pennant);

  group.position.set(DOCK_CENTER_X, 0, DOCK_CENTER_Z);
  return { group, floodlight, skylight, windows, cable, pennant };
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

  // Logistics Choreography Phase, Commit 4: a small exhaust puff parented
  // directly to each dock-area truck rig (not the fixed roofline haze
  // above/elsewhere) -- Points inherit their parent's transform, so it
  // follows the truck through arrive/depart for free, no position-
  // tracking code. Opacity is driven in updateDockCycle(). Only the two
  // dock-area rigs get one (they're the ones that meaningfully
  // accelerate-away-from-a-stop; the highway fleet cruises continuously).
  [dockTruck, queuedTruck].forEach((truck) => {
    const exhaustPuff = createParticles({
      count: 10,
      spreadX: 0.4,
      spreadZ: 0.4,
      height: 1.4,
      driftSpeed: 0.1,
      color: 0x9aa0b5,
      size: 0.04,
      opacity: 0,
      turbulence: 0.2,
    });
    exhaustPuff.position.set(1.3, 2.4, 4.4);
    truck.add(exhaustPuff);
    truck.userData.exhaustPuff = exhaustPuff;

    // Choreography Refinement Pass, Commit 1: a low, ground-hugging dust
    // puff near the rear wheel cluster, same parented-particles technique
    // as exhaustPuff above (follows the truck for free) -- driven by the
    // same arrive/depart opacity target in updateDockCycle(), just a
    // distinct color/height/count so it reads as kicked-up dust, not more
    // exhaust.
    const tireDust = createParticles({
      count: 14,
      spreadX: 1.6,
      spreadZ: 1,
      height: 0.4,
      driftSpeed: 0.05,
      color: 0xb3a184,
      size: 0.05,
      opacity: 0,
      turbulence: 0.15,
    });
    tireDust.position.set(0, 0.2, -3);
    truck.add(tireDust);
    truck.userData.tireDust = tireDust;
  });

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

  // Choreography Refinement Pass, Track A3 Pass 2: the operator -- this
  // chapter's own audit finding was that almost no chapter has visible
  // human presence; this is the one place in Ground's own yard a person
  // is already, structurally, standing (the seat, above). Same capsule +
  // sphere vocabulary Pickup/FinalMile's figures already use (a shorter
  // capsule reads as seated at this abstraction level -- no separate
  // seated-pose geometry needed), duplicated hex values per this
  // codebase's own sibling-environment-file independence convention.
  const operatorClothingMaterial = new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.7, metalness: 0.1 });
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

  // Logistics Choreography Phase, Commit 2: a cargo box carried on the
  // forks, visible only while loaded -- CONTAINER_COLORS[0], the same
  // color Air's own cargo pod echoes ("the same shipment" through both
  // chapters). Parented to forkGroup so it lifts/lowers/travels with the
  // forks automatically, no separate position tracking.
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

function createHighway() {
  const group = new Group();
  const asphaltMaterial = new MeshPhysicalMaterial({ color: ASPHALT_COLOR, metalness: 0.1, roughness: 0.9, clearcoat: 0 });
  // Ground Chapter Cinematic Realism Pass, Commit 5: a single subtle nudge
  // (one mesh, not per-instance -- only one highway exists) so the surface
  // isn't a perfectly uniform roughness value, same varyMaterial() bounds
  // as everywhere else in this phase.
  varyMaterial(asphaltMaterial, 600);
  const asphalt = new Mesh(new BoxGeometry(48, 0.3, HIGHWAY_LENGTH), asphaltMaterial);
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
  // Ground Chapter Cinematic Realism Pass, Commit 5: previously one shared
  // material instance across both hubs -- cloned + varied per instance,
  // the same technique already used for Sorting's parcels (Cinematic
  // Polish Phase, Commit 5), so the two background silhouettes read as
  // distinct structures rather than a stamped copy.
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
  const wheels = [];
  const frontWheels = [];
  [-4.5, -1.5, 1.5, 4.5].forEach((z) => {
    [-1.6, 1.6].forEach((x) => {
      const wheel = new Mesh(wheelGeometry, rubberMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      group.add(wheel);
      wheels.push(wheel);
      // Choreography Refinement Pass, Commit 2: the steer axle -- the pair
      // nearest the cab (z=5) -- kept separate so updateDockCycle() can yaw
      // just these two, not the whole wheelset, while steering.
      if (z === 4.5) frontWheels.push(wheel);
    });
  });
  // Logistics Choreography Phase, Commit 1: stored so update()/
  // updateDockCycle() can roll them proportional to actual per-frame
  // movement -- previously built and positioned, then discarded.
  group.userData.wheels = wheels;
  group.userData.frontWheels = frontWheels;

  [-1.4, 1.4].forEach((x) => {
    const tail = new Mesh(new BoxGeometry(0.15, 0.25, 0.05), lightMaterial);
    tail.position.set(x, 1.9, -4.1);
    group.add(tail);
  });

  // Logistics Choreography Phase, Commit 3: headlights at the cab's front
  // face (local +Z, opposite the tail lights above) -- every truck built
  // by this shared function (highway fleet, dock/queued trucks, the
  // service vehicle) already carries its own correct rotation.y for
  // which way it faces, so a fixed local position here automatically
  // points the right way for all of them.
  const headlightMaterial = new MeshBasicMaterial({ color: OFFWHITE_100 });
  const headlights = [];
  [-1.4, 1.4].forEach((x) => {
    const headlight = new Mesh(new BoxGeometry(0.2, 0.2, 0.05), headlightMaterial);
    headlight.position.set(x, 1.9, 6.15);
    group.add(headlight);
    headlights.push(headlight);
  });
  group.userData.headlights = headlights;

  // Turn-signal-style indicator lights, one per side -- built for every
  // truck (this shared function), but only actually driven for the dock/
  // queued trucks in updateDockCycle() (the only ones that "turn," in
  // this chapter's own abstracted sense -- the highway fleet just cruises
  // straight, so these simply stay dark for them, same as a real truck
  // never signaling on an open highway).
  const indicatorMaterial = new MeshBasicMaterial({ color: 0xffaa33 });
  const indicators = [];
  [-1.4, 1.4].forEach((x) => {
    const indicator = new Mesh(new BoxGeometry(0.12, 0.12, 0.05), indicatorMaterial);
    indicator.position.set(x, 1.6, 6.15);
    indicator.visible = false;
    group.add(indicator);
    indicators.push(indicator);
  });
  group.userData.indicators = indicators; // [left, right]

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
    this.dockDoorWarningLight = dockBuilding.doorWarningLight;
    this.dockPlatforms = dockBuilding.platforms;
    this.containers = dockBuilding.containers;
    this.group.add(dockBuilding.group);
    this.group.add(createYardSignage());

    // Ground Chapter Cinematic Realism Pass, Commit 4: layered lighting +
    // the two ambient-motion props (see update() for the sway/blink/
    // rotation driving them).
    const dockLighting = createDockLighting();
    this.dockFloodlight = dockLighting.floodlight;
    this.dockSkylight = dockLighting.skylight;
    this.dockWindows = dockLighting.windows;
    this.dockCable = dockLighting.cable;
    this.dockPennant = dockLighting.pennant;
    this.baseFloodlightIntensity = this.dockFloodlight.intensity;
    this.baseSkylightIntensity = this.dockSkylight.intensity;
    this.baseWindowOpacity = this.dockWindows[0].material.opacity;
    this.group.add(dockLighting.group);

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

    // Track A3 Pass 2: every other yard vehicle that actually maneuvers
    // (both forklifts, the dock trucks via the door-motion warning light)
    // already carries an amber practical -- the service vehicle was the
    // one exception. Same small-radius-PointLight-plus-glow-mesh precedent,
    // attached externally after construction (like the dock trucks' own
    // exhaust puffs) rather than added to createTruck() itself, since only
    // this one truck instance needs it.
    const serviceBeacon = new Mesh(new SphereGeometry(0.1, 8, 8), new MeshBasicMaterial({ color: 0xffaa33 }));
    serviceBeacon.position.set(0, 3.6, 0);
    const serviceBeaconLight = new PointLight(0xffaa33, 0, 3.5, 2);
    serviceBeaconLight.position.copy(serviceBeacon.position);
    this.serviceVehicle.add(serviceBeacon, serviceBeaconLight);
    this.serviceVehicle.userData.beaconLight = serviceBeaconLight;

    this.group.add(this.serviceVehicle);

    // Heaviest ground-level haze in the journey (Section 23) -- the densest
    // particle field of any chapter so far. Ground Chapter Cinematic
    // Realism Pass, Commit 4: opts into the turbulence layer built for
    // this (Cinematic Polish Phase) for a general "light wind" read across
    // the whole region -- previously unused here.
    this.particles = createParticles({
      count: 220,
      spreadX: 28,
      spreadZ: HIGHWAY_LENGTH,
      height: 5,
      offsetZ: REGION_Z,
      opacity: 0.4,
      turbulence: 0.25,
    });
    this.group.add(this.particles);

    // A small, sparse, slow-drifting tinted cluster near the dock roofline
    // -- an approximation of exhaust/vent haze, not simulated smoke (no
    // per-particle lifecycle fade exists in createParticles.js; building
    // one would be a new rendering mechanism, out of scope here).
    this.exhaustParticles = createParticles({
      count: 16,
      spreadX: 1,
      spreadZ: 1,
      height: 3,
      offsetX: DOCK_CENTER_X + 5,
      offsetZ: DOCK_CENTER_Z - 1,
      driftSpeed: 0.12,
      color: 0x9aa0b5,
      size: 0.05,
      opacity: 0.16,
      turbulence: 0.3,
    });
    this.baseExhaustOpacity = this.exhaustParticles.material.opacity;
    this.group.add(this.exhaustParticles);

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

    // Ground Chapter Cinematic Realism Pass, Commit 5: a self-contained
    // hover micro-interaction, deliberately not routed through pointer.js/
    // main.js's global CTA-hover mechanism -- Ground has no `cta` in
    // config.js (only proofPoints), so that mechanism has nothing to
    // attach to here, and widening it would ripple to every other
    // chapter's proof-points. On hover, a small, capped, one-time nudge to
    // targetActivityWeight (identical to the existing CTA-hover technique)
    // -- which, via Commit 4's wiring, already brightens the dock/beacon/
    // window lights. Camera/cursor response is intentionally not wired
    // here (that's the CTA-hover mechanism's own job) -- a stated
    // trade-off, not a silent gap.
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
    this.particles.material.opacity = this.baseParticleOpacity * this.activityWeight;

    // Ground Chapter Cinematic Realism Pass, Commit 4: every new practical
    // (dock floodlight/skylight/windows) recedes and returns together with
    // the rest of the chapter's activity weight, exactly like the key/fill
    // lights above -- never independently.
    this.dockFloodlight.intensity = this.baseFloodlightIntensity * this.activityWeight;
    this.dockSkylight.intensity = this.baseSkylightIntensity * this.activityWeight;
    this.dockWindows.forEach((win) => {
      win.material.opacity = this.baseWindowOpacity * this.activityWeight;
    });
    this.exhaustParticles.material.opacity = this.baseExhaustOpacity * this.activityWeight;

    const tintT = dampFactor(LIGHT_TINT_HALF_LIFE_MS, time.delta);
    this.keyLight.color.lerp(this.targetKeyColor, tintT);
    this.fillLight.color.lerp(this.targetFillColor, tintT);

    updateParticles(this.particles, time.delta / 1000, time.elapsed);
    updateParticles(this.exhaustParticles, time.delta / 1000, time.elapsed);

    // Ambient micro-motion (Commit 4): a hanging cable's pendulum sway and
    // a small pennant's light sway -- distinct, independent periods from
    // every other ambient touch in this chapter, so nothing pulses in
    // lockstep.
    // Choreography Refinement Pass, Commit 1: two mismatched slow sines
    // multiplied together, remapped to a positive [0.55, 1.15] range -- an
    // irregular gust envelope on top of the sway's own base periods below,
    // rather than a second fixed period that would just add a new kind of
    // metronome.
    const windGust =
      0.85 + 0.3 * Math.sin(time.elapsed / WIND_GUST_PERIOD_A_MS) * Math.sin(time.elapsed / WIND_GUST_PERIOD_B_MS + 0.6);
    this.dockCable.rotation.z = Math.sin(time.elapsed / 2600) * 0.05 * windGust;
    this.dockCable.rotation.x = Math.sin(time.elapsed / 3100 + 1) * 0.03 * windGust;
    this.dockPennant.rotation.y = Math.sin(time.elapsed / 1400) * 0.35 * windGust;

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

      // Logistics Choreography Phase, Commit 1: rolled by the pre-wrap
      // delta specifically -- the wrap itself is a teleport back to the
      // opposite end, not real movement, and shouldn't spike the wheels.
      rollWheels(truck.userData.wheels, truckDeltaZ, TRUCK_WHEEL_RADIUS);

      // Ground Chapter Cinematic Realism Pass, Commit 3: additive refinement
      // only -- the wrap/taper system above is untouched. A sub-millimeter,
      // high-frequency sine reads as idle engine vibration; a brief pitch
      // that grows as `taper` shrinks (i.e. exactly while the truck is
      // decelerating into its wrap) reads as braking, then releases once
      // taper recovers past the wrap.
      const brakeDive = (1 - taper) ** 2 * BRAKE_DIVE_AMPLITUDE;
      truck.position.y = Math.sin(time.elapsed / 90 + truckIndex * 1.7) * 0.004 - brakeDive;
      truck.rotation.x = (1 - taper) * 0.05 * truck.userData.direction;

      // Cinematic Motion Refinement Phase, Commit 2: a small persistent
      // body-roll, independent period from both the idle-vibration bounce
      // above and the braking pitch -- reads as a loaded truck settling
      // side-to-side at cruise, not synced to anything else in this file.
      truck.rotation.z = Math.sin(time.elapsed / 1750 + truckIndex * 2.3) * 0.012;
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
    const phaseChanged = phase !== this.dockCyclePhase;

    // Commit 5: inert audio hook points, dispatched exactly at the phase
    // boundaries a future audio layer would care about.
    if (phaseChanged) {
      if (phase === 'dockOpen' || phase === 'dockClose') this.dispatchGroundEvent('ground:dock-door');
      if (phase === 'unload') this.dispatchGroundEvent('ground:forklift-move');
      if (phase === 'dockClose') this.dispatchGroundEvent('ground:forklift-pause');
      if (phase === 'gap') this.dispatchGroundEvent('ground:truck-idle');
    }

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
    if (phase === 'arrive' && phaseChanged) {
      const previousDock = this.dockTruck;
      this.dockTruck = this.queuedTruck;
      this.queuedTruck = previousDock;
    }
    this.dockCyclePhase = phase;

    this.queuedTruck.userData.targetZ = phase === 'gap' ? SPAWN_WAYPOINT_Z : QUEUE_WAYPOINT_Z;
    this.dockTruck.userData.targetZ = phase === 'depart' || phase === 'gap' ? SPAWN_WAYPOINT_Z : DOCK_TRUCK_WAYPOINT_Z;
    const dockTruckDeltaZ = this.dockTruck.userData.targetZ - this.dockTruck.position.z;
    const queuedTruckDeltaZ = this.queuedTruck.userData.targetZ - this.queuedTruck.position.z;
    this.dockTruck.position.z += dockTruckDeltaZ * motionT;
    this.queuedTruck.position.z += queuedTruckDeltaZ * motionT;

    // Logistics Choreography Phase, Commit 4: exhaust brightens briefly
    // during arrive/depart (accelerating away from a stop), reusing the
    // phase transitions already tracked above rather than a new signal.
    const exhaustTargetOpacity = phase === 'arrive' || phase === 'depart' ? 0.22 : 0;
    // Choreography Refinement Pass, Commit 1: dust shares the exhaust
    // puff's own arrive/depart gate (a truck kicks up dust exactly when
    // it's accelerating away from a stop, the same moment exhaust
    // brightens) at a lower ceiling opacity -- distinct enough from the
    // exhaust's own reading, not a second independent trigger.
    const dustTargetOpacity = exhaustTargetOpacity > 0 ? 0.18 : 0;
    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const puff = truck.userData.exhaustPuff;
      puff.material.opacity += (exhaustTargetOpacity - puff.material.opacity) * motionT;
      updateParticles(puff, time.delta / 1000, time.elapsed);

      const dust = truck.userData.tireDust;
      dust.material.opacity += (dustTargetOpacity - dust.material.opacity) * motionT;
      updateParticles(dust, time.delta / 1000, time.elapsed);
    });

    // Logistics Choreography Phase, Commit 1: rolled by the actual applied
    // delta (post-motionT), not the raw distance-to-target.
    rollWheels(this.dockTruck.userData.wheels, dockTruckDeltaZ * motionT, TRUCK_WHEEL_RADIUS);
    rollWheels(this.queuedTruck.userData.wheels, queuedTruckDeltaZ * motionT, TRUCK_WHEEL_RADIUS);

    // Cinematic Motion Refinement Phase, Commit 2: "steering correction" --
    // a small roll proportional to remaining distance to target, the same
    // leans-while-moving/levels-out-as-it-settles idiom the forklifts below
    // already use for their own pitch.
    this.dockTruck.rotation.z = Math.max(-0.03, Math.min(0.03, dockTruckDeltaZ * 0.01));
    this.queuedTruck.rotation.z = Math.max(-0.03, Math.min(0.03, queuedTruckDeltaZ * 0.01));

    // Choreography Refinement Pass, Commit 2: front-wheel steering yaw --
    // the same steering-correction roll above, applied to just the steer
    // axle (frontWheels) as a visible yaw rather than a body lean. A
    // distinct, larger gain/ceiling than the body roll's own 0.03 rad, since
    // a wheel visibly turning reads at a much smaller body-roll input than
    // the body itself needs to lean to sell "steering."
    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const steerAngle = Math.max(-0.35, Math.min(0.35, truck.rotation.z * 8));
      truck.userData.frontWheels.forEach((wheel) => {
        wheel.rotation.y = steerAngle;
      });
    });

    // Logistics Choreography Phase, Commit 3: turn-signal blink, reusing
    // the steering-correction roll's own sign above as the "which way"
    // signal -- no new steering-intent logic. Only lit while the roll is
    // meaningfully nonzero (still correcting toward its target, not yet
    // settled) and the shared blink gate is on.
    const indicatorBlink = Math.sin(time.elapsed / 200) > 0.2;
    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const [left, right] = truck.userData.indicators;
      const active = indicatorBlink && Math.abs(truck.rotation.z) > 0.004;
      left.visible = active && truck.rotation.z < 0;
      right.visible = active && truck.rotation.z > 0;
    });

    // Dock door: this is what its open/close easing is *for* -- not a
    // standalone decorative loop.
    const doorTargetY = phase === 'dockOpen' || phase === 'unload' ? DOOR_OPEN_Y : DOOR_CLOSED_Y;
    this.dockDoor.position.y += (doorTargetY - this.dockDoor.position.y) * motionT;

    // Logistics Choreography Phase, Commit 3: the warning light activates
    // only while the door hasn't yet reached its target -- reuses the
    // door's own position-lerp state directly rather than tracking phase
    // membership separately, so it's lit for exactly as long as the door
    // is visibly moving, regardless of which phase boundary triggered it.
    const doorMidMotion = Math.abs(doorTargetY - this.dockDoor.position.y) > 0.05;
    this.dockDoorWarningLight.intensity = doorMidMotion && Math.sin(time.elapsed / 180) > 0 ? 1.4 : 0;

    // Pallet stack: each pallet reveals at its own threshold within the
    // unload window -- a visibly growing stack, not an instant swap -- and
    // resets once the cycle moves past it.
    const unloadDuration = PHASE_UNLOAD_END - PHASE_DOCK_OPEN_END;
    const isStacking = phase === 'unload' || phase === 'dockClose';
    const palletT = dampFactor(PALLET_REVEAL_HALF_LIFE_MS, time.delta);
    this.palletPool.forEach((pallet, i) => {
      const revealAt = PHASE_DOCK_OPEN_END + (i / this.palletPool.length) * unloadDuration;
      const targetScale = isStacking && cycleT >= revealAt ? 1 : 0;
      const previousScale = pallet.scale.x;
      const nextScale = previousScale + (targetScale - previousScale) * palletT;
      pallet.scale.setScalar(nextScale);

      // Cinematic Motion Refinement Phase, Commit 2: load-settle bounce --
      // once a pallet's reveal crosses ~90% on its way UP, arm one brief
      // decaying overshoot on top of its scale ("follow-through," not a new
      // mechanism -- the same settle-envelope shape introduced for the
      // camera in Commit 1). Never arms on the way down (targetScale === 0
      // is an intentional disappear at cycle reset, not an arrival).
      // `settleElapsed` is left `undefined` (not Infinity) while inert, so
      // the block below is skipped entirely rather than ever evaluating
      // Math.cos on a runaway value -- the same NaN trap Commit 1 hit.
      if (targetScale === 1 && previousScale < 0.9 && nextScale >= 0.9 && !pallet.userData.settled) {
        pallet.userData.settleElapsed = 0;
        pallet.userData.settled = true;
      }
      if (targetScale === 0) pallet.userData.settled = false;

      if (pallet.userData.settleElapsed !== undefined) {
        pallet.userData.settleElapsed += time.delta;
        const settleEnvelope = 2 ** (-pallet.userData.settleElapsed / PALLET_SETTLE_HALF_LIFE_MS);
        if (settleEnvelope > 0.0005) {
          const settleOscillation = Math.cos((pallet.userData.settleElapsed / PALLET_SETTLE_PERIOD_MS) * Math.PI * 2);
          pallet.scale.setScalar(nextScale + settleEnvelope * settleOscillation * PALLET_SETTLE_AMPLITUDE);
        } else {
          pallet.userData.settleElapsed = undefined;
        }
      }
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
      let atDrop = false;
      let loadoutCarrying = false;
      const inLoadoutWindow =
        i === LOADOUT_FORKLIFT_INDEX && cycleT >= LOADOUT_WINDOW_START && cycleT < LOADOUT_WINDOW_END;
      if (phase === 'unload') {
        const period = FORKLIFT_TRIP_PERIOD_MS[i];
        const tripPhase = ((unloadElapsed + i * 900) % period) / period;
        atDrop = tripPhase < 0.5;
        targetX = atDrop ? FORKLIFT_DROP.x : FORKLIFT_PICKUP.x;
        targetZ = atDrop ? FORKLIFT_DROP.z : FORKLIFT_PICKUP.z;
      } else if (inLoadoutWindow) {
        // One-shot, not a repeating trip like the unload loop above: first
        // leg fetches the pallet from the stack (FORKLIFT_DROP), second leg
        // carries it to the truck (FORKLIFT_PICKUP) -- see this file's own
        // LOADOUT_* constants for the full rationale.
        loadoutCarrying = cycleT >= LOADOUT_MIDPOINT;
        targetX = loadoutCarrying ? FORKLIFT_PICKUP.x : FORKLIFT_DROP.x;
        targetZ = loadoutCarrying ? FORKLIFT_PICKUP.z : FORKLIFT_DROP.z;
      }
      const dz = targetZ - forklift.position.z;
      const dx = targetX - forklift.position.x;
      forklift.position.x += dx * motionT;
      forklift.position.z += dz * motionT;
      // A brief pitch proportional to remaining distance -- "leans while
      // moving, levels out as it settles."
      forklift.rotation.x = Math.max(-0.15, Math.min(0.15, dz * 0.02));

      // Logistics Choreography Phase, Commit 1: rolled by the combined
      // X/Z movement magnitude this frame (forklifts move diagonally,
      // unlike trucks) -- a plain untextured wheel shows no visual
      // difference for direction of spin, so magnitude alone is enough.
      rollWheels(forklift.userData.wheels, Math.hypot(dx, dz) * motionT, FORKLIFT_WHEEL_RADIUS);
      // Logistics Choreography Phase, Commit 2: real staged lift, replacing
      // the previous rotational wobble -- forks rise while heading to DROP
      // (carrying the load) and lower while heading back to PICKUP (empty),
      // reusing the exact same `atDrop` signal already computed above for
      // horizontal translation rather than a new sub-phase timeline. Target
      // change + damped ease, the same idiom this file's own dock-cycle
      // comments describe explicitly ("a target change, not a hand-computed
      // trajectory"). A visible cargo box (CONTAINER_COLORS[0], the same
      // echo Air's own cargo pod already uses) reveals in step via a scale
      // ease, the same idiom the pallet stack already uses, so the forklift
      // visibly IS carrying something rather than just tilting its tines.
      // Track A3 Pass 1: `carrying` covers both trips this forklift can be
      // mid-flight on -- the repeating unload trip (atDrop) and the one-shot
      // loadout trip (loadoutCarrying) -- so the lift/cargo-box logic below
      // doesn't need to know which one is actually driving it.
      const carrying = (phase === 'unload' && atDrop) || loadoutCarrying;
      const forkGroup = forklift.userData.forkGroup;
      const forkHeightTarget = carrying ? FORKLIFT_LIFT_HEIGHT : 0;
      forkGroup.position.y += (forkHeightTarget - forkGroup.position.y) * motionT;
      const cargoBox = forklift.userData.cargoBox;
      if (cargoBox) {
        const cargoTargetScale = carrying ? 1 : 0;
        cargoBox.scale.setScalar(cargoBox.scale.x + (cargoTargetScale - cargoBox.scale.x) * motionT);
      }

      // Cinematic Motion Refinement Phase, Commit 2: mast sway -- until now
      // only the fork-tine group (above) had any motion; the mast itself
      // was rigid. Sub-degree ambient sway, same ceiling as Air's own
      // wingtip jitter, ever-present (not gated to 'unload').
      const mast = forklift.userData.mast;
      if (mast) mast.rotation.z = Math.sin(time.elapsed / 580 + i * 2.3) * 0.01;

      // Ground Chapter Cinematic Realism Pass, Commit 4: beacon rotation
      // (continuous) and blink (a distinct, unrelated period -- never
      // synced to the rotation) tied to activityWeight like every other
      // light in this chapter.
      forklift.userData.beacon.rotation.y = time.elapsed / 260 + i * 3;
      const blink = Math.sin(time.elapsed / 340 + i * 5) > 0.6 ? 1 : 0.25;
      forklift.userData.beaconLight.intensity = 1.6 * blink * this.activityWeight;
    });

    // Choreography Refinement Pass, Commit 3: a small camera lead toward
    // the dock truck's own direction of travel, magnitude scaled by how
    // much of its current leg still remains -- near-full right after
    // arrive/depart begins (dockTruckDeltaZ still large), easing to zero as
    // it actually reaches its target. Same setTargetLead() entry point
    // Air's own aircraft already uses (CameraRig applies it only while the
    // `ground` shot is the active one -- see that method's own guard).
    const leadMagnitude = Math.min(1, Math.abs(dockTruckDeltaZ) / DOCK_LEAD_REFERENCE_DISTANCE) * DOCK_LEAD_MAX_AMPLITUDE;
    this.experience.camera.setTargetLead('ground', 0, 0, Math.sign(dockTruckDeltaZ) * leadMagnitude);

    // Reversing service vehicle -- a short, continuous reverse/return loop
    // on its own period, deliberately independent of the dock cycle above
    // ("staggered timing," never one metronomic machine). The sign of the
    // motion's own analytic derivative (cosine) flips exactly at each
    // direction reversal -- comparing it frame to frame is cheaper and
    // more direct than tracking a position delta.
    const serviceDirection = Math.sign(Math.cos(time.elapsed / 3300));
    if (serviceDirection !== 0 && serviceDirection !== this.serviceVehicle.userData.lastDirection) {
      this.dispatchGroundEvent('ground:vehicle-reverse');
    }
    this.serviceVehicle.userData.lastDirection = serviceDirection;
    const previousServiceX = this.serviceVehicle.position.x;
    this.serviceVehicle.position.x = this.serviceVehicle.userData.baseX + Math.sin(time.elapsed / 3300) * 4;

    // Logistics Choreography Phase, Commit 1: this vehicle travels along X
    // (unlike every other truck, which travels along Z), so its wheels'
    // construction-time orientation doesn't literally match its direction
    // of travel -- immaterial for a plain untextured cylinder with no
    // tread to betray the mismatch, so the same helper still applies.
    rollWheels(this.serviceVehicle.userData.wheels, this.serviceVehicle.position.x - previousServiceX, TRUCK_WHEEL_RADIUS);

    // Track A3 Pass 2: a distinct blink period from every other beacon in
    // this chapter (forklifts blink on 340ms, the dock door warning on
    // 180ms) so nothing pulses in lockstep, tied to activityWeight like
    // every other light here.
    const serviceBeaconBlink = Math.sin(time.elapsed / 260) > 0.55 ? 1 : 0.2;
    this.serviceVehicle.userData.beaconLight.intensity = 1.4 * serviceBeaconBlink * this.activityWeight;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
