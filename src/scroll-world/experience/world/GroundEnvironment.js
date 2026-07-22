import {
  Box3,
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
// Sorting/Ground Link Pass: matches Sorting/Pickup/Air's own route-line
// tube color exactly -- it's the same physical shipment-tracking line
// continuing through this chapter, not a new one.
const ELECTRIC_400 = 0x4fa3ff;
const ELECTRIC_500 = 0x2f8bff;
const ROYAL_600 = 0x2540b0;
const OFFWHITE_100 = 0xeef2ff;
const ASPHALT_COLOR = 0x232428;
const HUB_COLOR = 0x565b66;
const RUBBER_COLOR = 0x05070f;
const HIGHWAY_LENGTH = 100;
// Sorting/Ground Link Pass: SortingEnvironment.js's own mezzanine floor
// (BoxGeometry(30, 0.4, CONVEYOR_LENGTH+6=52), centered on its own
// REGION_Z=-180) physically ends at world z=-206; this file's own highway
// asphalt (below) starts at z=-280 (REGION_Z - HIGHWAY_LENGTH/2). Checked
// live: nothing exists in between -- not even asphalt, just void, despite
// Sorting's own route line being built to hand off exactly at -206 (see
// its own createRouteLine() comment). This was fixed once already
// (pre-rebuild commit cc62faa) and silently dropped when Ground was fully
// rebuilt this session; these two constants are unchanged from that fix.
const TRANSITION_APRON_NEAR_Z = -206;
const TRANSITION_APRON_FAR_Z = -280;
// Ground Chapter Full Rebuild, Step 3 fix: re-checked live against the
// new angled warehouse's own MEASURED bounds (world x -10.2 to 22.4,
// read via a per-mesh traversal, not estimated) -- the original Step 2
// values (carried over from the old, smaller footprint) overlapped 3 of
// 4 lanes once actually checked. Widened west/east spread with real
// clearance margin on both sides.
const LANE_X = [-19, -15, 23, 29];
const FLEET_SPEED = 6.5;
const VELOCITY_HALF_LIFE_MS = 300;
// Ground Chapter Cross-Chapter Continuity Pass: was symmetric
// (REGION_Z +/- HIGHWAY_LENGTH/2); the near edge now extends into the
// transition apron (paved since the Sorting/Ground Link Pass -- see
// TRANSITION_APRON_NEAR_Z/FAR_Z) so the fleet is already visibly moving
// well before the camera crosses into Ground's own section -- one
// continuous journey, not a hard start. Left a 10-unit margin before
// TRANSITION_APRON_NEAR_Z (Sorting's own floor edge) so a truck never
// reads as driving into Sorting's interior.
const FLEET_NEAR_WRAP_Z = TRANSITION_APRON_NEAR_Z + 10;
const FLEET_FAR_WRAP_Z = REGION_Z - HIGHWAY_LENGTH / 2;
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

/** Static floor connector across the Sorting/Ground gap (see
 *  TRANSITION_APRON_NEAR_Z/FAR_Z) -- its own mesh, deliberately NOT folded
 *  into createHighway()/HIGHWAY_LENGTH, so the fleet's own wrap
 *  boundaries/timing stay untouched. Same asphalt material AND footprint
 *  as the highway's own asphalt (60 wide, centered x=4) so the seam at
 *  z=-280 lines up edge-to-edge -- comfortably wider than Sorting's own
 *  30-unit floor too, so the near-end seam at z=-206 has no gap either.
 *  Sorting's FLOOR_COLOR and this file's ASPHALT_COLOR are the identical
 *  hex already, so this reads as one continuous paved surface arriving
 *  from Sorting, not a new patch. */
function createTransitionApron() {
  const length = TRANSITION_APRON_NEAR_Z - TRANSITION_APRON_FAR_Z;
  const centerZ = (TRANSITION_APRON_NEAR_Z + TRANSITION_APRON_FAR_Z) / 2;
  const material = new MeshPhysicalMaterial({ color: ASPHALT_COLOR, metalness: 0.1, roughness: 0.9, clearcoat: 0 });
  varyMaterial(material, 610);
  const apron = new Mesh(new BoxGeometry(60, 0.3, length), material);
  apron.position.set(4, -0.15, centerZ);
  apron.receiveShadow = true;
  return apron;
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

// Sorting/Ground Link Pass: same physical tube, same pulse -- matches
// Sorting's own PULSE_PERIOD/PULSE_DEPTH exactly rather than picking a new
// beat, so the line reads as continuous through the hand-off, not two
// differently-timed segments.
const ROUTE_PULSE_PERIOD_MS = 3400;
const ROUTE_PULSE_DEPTH = 0.25;

/** Continues Sorting's own route line from its exact hand-off point --
 *  SortingEnvironment.js's createRouteLine() ends at (0, 0.65,
 *  TRANSITION_APRON_NEAR_Z) by design (its own comment: "GroundEnvironment
 *  .js's own route line start is updated to the same coordinate, keeping
 *  the two chapters' tubes joined exactly") -- across the apron and into
 *  the yard, ending at the live dock door: the shipment's actual
 *  destination this chapter. Control points checked clear of the highway
 *  lanes (x -19/-15/23/29) and the dock cluster -- this is the shortest
 *  legible path from the hand-off point to the door, not decorative. */
function createRouteLine() {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0.65, TRANSITION_APRON_NEAR_Z),
    new Vector3(1, 0.3, -240),
    new Vector3(2, 0.1, DOCK_CENTER_Z + 20),
    new Vector3(DOCK_CENTER_X, 0.1, DOCK_CENTER_Z + 1.2),
  ]);
  const material = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.85 });
  material.userData.baseOpacity = material.opacity;
  return new Mesh(new TubeGeometry(curve, 100, 0.05, 8, false), material);
}

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
// Ground Chapter Composition Pass: widened +1 on both -- a bigger, more
// legible sweep for the one motion this corridor produces. Checked clear
// of Wing B's second dock platform (world x 10.8-12.6): pallet pool's own
// outer bound (DROP[0].x+1.05 = 9.05) still leaves ~1.75 units of margin.
const FORKLIFT_DROP = [
  { x: DOCK_CENTER_X + 6, z: DOCK_CENTER_Z + 5 },
  { x: DOCK_CENTER_X + 7.1, z: DOCK_CENTER_Z + 5 },
];
// Ground Chapter Composition Pass: PICKUP used to sit at (DOCK_CENTER_X,
// DOCK_CENTER_Z+6) -- the dock truck's own resting point once its
// rotation.y=PI is applied to its local geometry (world x 0.4-3.6, z
// -310.1--299.9) -- so a forklift easing there drove straight into the
// truck's own mesh. Moved to the truck's clear east flank, same side as
// FORKLIFT_DROP (the west side was checked too: it would route the
// straight-line ease path *through* the truck's footprint mid-transit,
// trading one clip for another).
const FORKLIFT_PICKUP = [
  { x: DOCK_CENTER_X + 2.8, z: DOCK_CENTER_Z + 6 },
  { x: DOCK_CENTER_X + 4.2, z: DOCK_CENTER_Z + 6 },
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
// Ground Chapter Composition Pass: widened from DOCK_LANE_X-4 -- from the
// fixed ground camera (view axis dominated by world Z), the two dock-cycle
// rigs read as one merged silhouette at only 4 units of lateral spread.
// Checked clear of everything else at this x/z: Wing A's wall footprint
// (world x -10..14) does overlap this x, but only at z -310.5..-304.5
// (the building itself), 16+ units of Z away from where a queued truck
// actually sits (QUEUE_WAYPOINT_Z=-288) or spawns (SPAWN_WAYPOINT_Z=-278);
// highway lanes (-19,-15,23,29) and the parking cluster (x 0-8, z
// -330/-340) are untouched.
const QUEUE_LANE_X = DOCK_LANE_X - 8;
const DOCK_TRUCK_WAYPOINT_Z = DOCK_CENTER_Z + 6;
const QUEUE_WAYPOINT_Z = DOCK_CENTER_Z + 22;
const SPAWN_WAYPOINT_Z = DOCK_CENTER_Z + 32;

// Ground Chapter Composition Pass: the dock/queue role swap (updateDockCycle,
// on entering 'arrive') relabels which physical rig is "dockTruck" vs
// "queuedTruck" without moving either -- each then eases toward the OTHER's
// old lane+Z target. If X and Z shared the same half-life, the X gap between
// them would hit exactly zero at t = one half-life into 'arrive'
// (worked the closed-form damped-lerp trajectory to confirm), and at that
// same moment the Z gap would only be ~half its final value -- both rigs'
// ~10.2-unit footprints (cargo BoxGeometry(3,3,8) + cab BoxGeometry(2.6,2.4,2.2)
// offset to local z=+5) would provably overlap. Widening the lanes alone
// can't fix this: a full role swap means the two rigs' X positions MUST
// trade sides (start on opposite sides of 0, end on opposite sides of 0),
// so by the intermediate value theorem their X gap is guaranteed to cross
// zero at some point regardless of how far apart the lanes are -- and a
// simple push-apart correction on X can't prevent that crossing either,
// only how hard it's fought (numerically confirmed: an earlier draft of
// this fix that only pushed X apart still produced worse overlap than no
// guard at all, because it couldn't out-fight a crossing that's
// mathematically forced).
//
// The fix that actually works: let Z open its gap faster than X closes.
// LANE_SWAP_HALF_LIFE_MS gives the X-lane transition its own, much slower,
// half-life than DOCK_MOTION_HALF_LIFE_MS's 900ms Z motion -- so by the
// time X reaches its own crossing point, Z has already had 3x longer to
// separate. Numerically verified (fixed 16ms steps, worst-case start
// condition of both rigs at identical Z): worst-case footprint overlap is
// exactly zero at this half-life, with margin to spare. Doesn't touch
// steady-state lane-holding -- both rigs already sit exactly on their own
// lane's X outside a swap, so this only slows how fast a *deviation*
// corrects, which only matters during the swap itself.
const LANE_SWAP_HALF_LIFE_MS = 3000;

const TRUCK_MIN_SEPARATION_X = 4.4; // > combined half-widths (1.6+1.6=3.2), ~1.2 margin
const TRUCK_MIN_SEPARATION_Z = 12; // > combined footprint length (~10.2) -- gates whether overlap is even geometrically possible
const SEPARATION_HALF_LIFE_MS = 220; // snappier corrective ease than DOCK_MOTION_HALF_LIFE_MS's 900, but still a damped ease -- never a hard snap

/** Defense-in-depth on top of LANE_SWAP_HALF_LIFE_MS -- same damped-lerp
 *  idiom as every other motion in this file, applied to a minimum-gap
 *  target instead of a fixed waypoint. No-ops whenever the Z gap already
 *  makes overlap geometrically impossible (true almost all of the time).
 *  Cannot by itself prevent the X crossing (see LANE_SWAP_HALF_LIFE_MS's
 *  comment -- that's the actual fix); this only adds extra separation
 *  speed on either side of it. dockTruck is always nudged toward +X,
 *  queuedTruck toward -X -- matches their steady-state lane assignment
 *  (DOCK_LANE_X > QUEUE_LANE_X), so the push direction stays deterministic
 *  even exactly at dx === 0. */
function maintainDockQueueSeparation(dockTruck, queuedTruck, correctionT) {
  const dz = dockTruck.position.z - queuedTruck.position.z;
  if (Math.abs(dz) >= TRUCK_MIN_SEPARATION_Z) return;
  const dx = dockTruck.position.x - queuedTruck.position.x;
  if (Math.abs(dx) >= TRUCK_MIN_SEPARATION_X) return;
  const shortfall = (TRUCK_MIN_SEPARATION_X - Math.abs(dx)) * 0.5;
  dockTruck.position.x += shortfall * correctionT;
  queuedTruck.position.x -= shortfall * correctionT;
}

// Ground Chapter Full Rebuild, Step 7: the service vehicle's own two-
// point trip -- proven mechanism from the vehicle-organization pass,
// retargeted between the dock row's own container-stack area and the new
// parking cluster.
const SERVICE_POINT_A = { x: DOCK_CENTER_X + 9, z: DOCK_CENTER_Z + 4 };
// Ground Chapter Reference Pass: was inside the parking cluster's own
// footprint (a truck-parking row sits at z=-330/-340) with no building
// there at all. reference/ground/ground reference.mp4 (frames 010/014)
// confirms a small standalone yard building DOES exist in the reference,
// correcting the old assumption above -- moved just past the parking rows
// and paired with one (createYardBuilding()), giving this trip a real
// destination instead of an empty yard coordinate.
const SERVICE_POINT_B = { x: 4, z: -349 };
const SERVICE_MOTION_HALF_LIFE_MS = 900;
const SERVICE_ARRIVE_DISTANCE = 0.4;
const SERVICE_HOLD_MS = 1800;
const SERVICE_HEADING_HALF_LIFE_MS = 500;

/** Small standalone yard building -- confirmed present in the reference
 *  footage (reference/ground/ground reference.mp4, frames 010/014),
 *  correcting this file's own prior assumption that it wasn't. Generic/
 *  unbranded single-story massing, not a copy of the reference's own
 *  branded structure. Positioned at the service vehicle's own
 *  SERVICE_POINT_B so its existing two-point trip gains a real
 *  destination. */
function createYardBuilding() {
  const group = new Group();
  const wallMaterial = new MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.6, metalness: 0.15 });
  varyMaterial(wallMaterial, 620);
  const roofMaterial = new MeshStandardMaterial({ color: 0x121316, roughness: 0.8, metalness: 0.1 });
  const body = new Mesh(new BoxGeometry(6, 3, 4), wallMaterial);
  body.position.set(0, 1.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  const roof = new Mesh(new BoxGeometry(6.3, 0.3, 4.3), roofMaterial);
  roof.position.set(0, 3.15, 0);
  group.add(body, roof);
  // A small tracking/dispatch accent -- Digital function, stays blue
  // regardless of lighting per the Material Language Guide, the one
  // deliberate brand-blue touch on an otherwise neutral structure.
  const accent = new Mesh(
    new BoxGeometry(6.02, 0.15, 0.1),
    new MeshStandardMaterial({ color: ELECTRIC_500, roughness: 0.35, metalness: 0.25 })
  );
  accent.position.set(0, 2.3, 2.02);
  group.add(accent);
  group.position.set(SERVICE_POINT_B.x, 0, SERVICE_POINT_B.z - 3);
  return group;
}

/** Low boundary fence -- confirmed present in the reference (separating
 *  the paved yard from adjacent unpaved land); marks the operational
 *  yard's own outer edge rather than a full security perimeter (the
 *  reference itself only shows this one boundary, not a full perimeter --
 *  see reference/ground/observations.md's own Open Questions). Post+rail,
 *  zero-allocation repeat, same flat/thin-mesh idiom as every other yard
 *  marking already in this file. */
function createBoundaryFence() {
  const group = new Group();
  const postMaterial = new MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.6, metalness: 0.3 });
  const railMaterial = new MeshStandardMaterial({ color: 0x50555f, roughness: 0.5, metalness: 0.3 });
  const runZ = [SPAWN_WAYPOINT_Z + 14, DOCK_CENTER_Z - 32]; // spans past the parking cluster's own far row (z=-340)
  // Just past the highway/apron's own west edge (asphalt spans x -26..34)
  // so the fence marks the yard's actual boundary rather than sitting on
  // the pavement.
  const fenceX = -28;
  const length = runZ[0] - runZ[1];
  const postCount = Math.round(length / 4);
  for (let i = 0; i <= postCount; i += 1) {
    const post = new Mesh(new BoxGeometry(0.12, 1.4, 0.12), postMaterial);
    post.position.set(fenceX, 0.7, runZ[0] - i * (length / postCount));
    group.add(post);
  }
  const rail = new Mesh(new BoxGeometry(0.08, 0.08, length), railMaterial);
  rail.position.set(fenceX, 1.1, (runZ[0] + runZ[1]) / 2);
  group.add(rail);
  return group;
}

/** Painted yard markings confirmed in the reference (a crosshatched keep-
 *  clear zone) -- same flat-decal idiom as createForkliftCorridorMarkings()/
 *  the highway's own lane dashes, not a new visual language. Placed at the
 *  parking cluster's own approach, where a real yard would mark a no-
 *  stopping zone in front of a working area. */
function createYardMarkings() {
  const group = new Group();
  const paintMaterial = new MeshBasicMaterial({ color: OFFWHITE_100, transparent: true, opacity: 0.3 });
  const hatchCenter = { x: 4, z: PARKING_ROWS_Z[0] + 6 };
  for (let i = -2; i <= 2; i += 1) {
    const hatch = new Mesh(new BoxGeometry(0.15, 0.02, 3), paintMaterial);
    hatch.rotation.y = Math.PI / 4;
    hatch.position.set(hatchCenter.x + i * 1.4, 0.01, hatchCenter.z);
    group.add(hatch);
  }
  return group;
}

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

// Ground Chapter Full Rebuild, Step 6: a distinct parking cluster --
// separate from both the dock row and the queue lane, matching the real
// reference footage's own separate parking area. Placed south of the
// dock cluster (z -330/-340), inside the "far highway stretch" the very
// first Ground layout audit this session identified as sparse/
// underutilized space -- reorganizing existing footprint rather than
// extending it, the same principle that's driven every Ground pass
// since. Columns spaced 4 apart (clears each truck's own ~3.2-unit
// track width); rows spaced 10 apart (clears the ~8-unit cargo length
// plus margin) -- kept in the same nose-along-Z orientation every other
// truck in this file uses, not perpendicular parking, so the spacing
// math stays the same as everywhere else rather than needing a second
// clearance formula for a rotated footprint. x range 0-8 keeps real
// clearance from every highway lane (nearest is -15, 15+ units away).
const PARKING_ROWS_Z = [-330, -340];
const PARKING_COLS_X = [0, 4, 8];

/** Static parked trailers -- same idle-motion-only technique as the
 *  queue-dressing trucks, organized in two rows rather than the queue
 *  lane's single file, reading as "parked," not "waiting in line." */
function createParkingCluster() {
  const trucks = [];
  PARKING_ROWS_Z.forEach((z, rowIndex) => {
    PARKING_COLS_X.forEach((x, colIndex) => {
      const seed = 44 + rowIndex * 3 + colIndex;
      const truck = createTruck(colIndex % 2 === 0 ? 0xd2d6dc : 0xc8ccd4, seed, { livery: false });
      truck.position.set(x, 0, z);
      truck.rotation.y = rowIndex % 2 === 0 ? 0 : Math.PI;
      trucks.push(truck);
    });
  });
  return trucks;
}

// Ground Chapter Full Rebuild, Step 7: the dock cycle -- arrive -> queue
// -> dock-open -> unload -> dock-close -> depart -> gap -- reused
// verbatim from the mechanism proven earlier this session (round-trip
// through one shared threshold), not the one-way redesign evaluated and
// declined for lack of any reference-footage justification. Phase
// boundaries unchanged; only the physical waypoints (DOCK_LANE_X etc.,
// defined in Step 5) were recalibrated for the new warehouse.
const DOCK_CYCLE_MS = 24000;
const PHASE_ARRIVE_END = 4000;
const PHASE_QUEUE_END = 6000;
const PHASE_DOCK_OPEN_END = 8000;
const PHASE_UNLOAD_END = 16000;
const PHASE_DOCK_CLOSE_END = 18000;
const PHASE_DEPART_END = 22000;
// PHASE_DEPART_END..DOCK_CYCLE_MS is the closing "gap" beat.
const DOOR_CLOSED_Y = 2.4;
const DOOR_OPEN_Y = 2.4 + 4.5;
const DOCK_MOTION_HALF_LIFE_MS = 900;
const PALLET_REVEAL_HALF_LIFE_MS = 350;
const DEPART_REVERSE_DISTANCE = 8;
const DEPART_TURN_HALF_LIFE_MS = 2200;
const PALLET_SETTLE_HALF_LIFE_MS = 180;
const PALLET_SETTLE_PERIOD_MS = 260;
// Ground Chapter Composition Pass: both raised for a clearer, bigger read
// from the fixed establishing camera -- lift height still clears the
// mast's own top (y=2.4: BoxGeometry height 2.2 centered at y=1.3) with
// margin to spare, and the settle bounce is still a brief overshoot, not a
// bigger cargo box.
const PALLET_SETTLE_AMPLITUDE = 0.14;
// Ground Chapter Composition Pass: quickened from [2600, 3100] -- more
// round trips visible across the 8s unload window (PHASE_DOCK_OPEN_END to
// PHASE_UNLOAD_END), reading as busier without changing the DROP/PICKUP
// waypoints themselves.
const FORKLIFT_TRIP_PERIOD_MS = [2200, 2700];
const FORKLIFT_LIFT_HEIGHT = 0.95;
const LOADOUT_WINDOW_START = PHASE_UNLOAD_END;
const LOADOUT_WINDOW_END = PHASE_DEPART_END - 2000;
const LOADOUT_MIDPOINT = LOADOUT_WINDOW_START + (LOADOUT_WINDOW_END - LOADOUT_WINDOW_START) * 0.5;
const LOADOUT_FORKLIFT_INDEX = 0;
const DOCK_LEAD_REFERENCE_DISTANCE = 16;
const DOCK_LEAD_MAX_AMPLITUDE = 0.7;

/** Zero-allocation phase lookup. */
function phaseFor(cycleT) {
  if (cycleT < PHASE_ARRIVE_END) return 'arrive';
  if (cycleT < PHASE_QUEUE_END) return 'queue';
  if (cycleT < PHASE_DOCK_OPEN_END) return 'dockOpen';
  if (cycleT < PHASE_UNLOAD_END) return 'unload';
  if (cycleT < PHASE_DOCK_CLOSE_END) return 'dockClose';
  if (cycleT < PHASE_DEPART_END) return 'depart';
  return 'gap';
}

/** The two choreographed dock-yard rigs, plus their own exhaust/dust
 *  puffs -- Points inherit their parent's transform, so they follow the
 *  truck through arrive/depart for free. */
function createDockPair() {
  const dockTruck = createTruck(0xd8dce2, 40, { livery: true });
  dockTruck.position.set(DOCK_LANE_X, 0, DOCK_TRUCK_WAYPOINT_Z);
  dockTruck.rotation.y = Math.PI;
  dockTruck.userData.headingY = Math.PI;
  dockTruck.userData.targetZ = dockTruck.position.z;

  const queuedTruck = createTruck(0xc8ccd4, 41, { livery: true });
  queuedTruck.position.set(QUEUE_LANE_X, 0, QUEUE_WAYPOINT_Z);
  queuedTruck.rotation.y = Math.PI;
  queuedTruck.userData.headingY = Math.PI;
  queuedTruck.userData.targetZ = queuedTruck.position.z;

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

  return { dockTruck, queuedTruck };
}

/** Swaps a truck rig's procedural hull for the real deliveryVan GLB once
 *  it loads -- recenter/flip/scale, the same three-nested-group technique
 *  proven earlier this session. X/Z recenter on bbox center; Y anchors
 *  the bbox's own MINIMUM to 0 so the model's wheels sit on the ground
 *  plane instead of floating/buried. */
const TRUCK_MODEL_ROTATION_Y = Math.PI;
const TRUCK_TARGET_LENGTH = 10.25;
function applyTruckModel(truckGroup, scene) {
  const box = new Box3().setFromObject(scene);
  const center = box.getCenter(new Vector3());

  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box.min.y;

  const recenter = new Group();
  recenter.add(scene);

  const flip = new Group();
  flip.rotation.y = TRUCK_MODEL_ROTATION_Y;
  flip.add(recenter);

  const size = box.getSize(new Vector3());
  const scale = TRUCK_TARGET_LENGTH / size.z;
  const container = new Group();
  container.scale.setScalar(scale);
  container.add(flip);

  scene.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });

  truckGroup.userData.hullMeshes.forEach((mesh) => {
    mesh.visible = false;
  });
  truckGroup.add(container);
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
    this.routeLine = createRouteLine();
    this.group.add(createHighway(), createTransitionApron(), createHubSilhouettes(), this.fleet, this.routeLine);

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

    // Ground Chapter Full Rebuild, Step 6: the parking cluster.
    this.parkingTrucks = createParkingCluster();
    this.parkingTrucks.forEach((truck) => this.group.add(truck));

    // Ground Chapter Reference Pass: the yard building the service
    // vehicle's own point B is now targeted at (see SERVICE_POINT_B).
    this.group.add(createYardBuilding());
    this.group.add(createBoundaryFence());
    this.group.add(createYardMarkings());

    // Ground Chapter Full Rebuild, Step 7: the dock cycle's two
    // choreographed rigs, recycled from a small pool the same way the
    // proven mechanism always has -- `dockTruck`/`queuedTruck` swap roles
    // once per cycle rather than being instantiated fresh.
    const dockPair = createDockPair();
    this.dockTruck = dockPair.dockTruck;
    this.queuedTruck = dockPair.queuedTruck;
    this.group.add(this.dockTruck, this.queuedTruck);
    this.dockCyclePhase = 'gap';

    // Both dock-yard rigs get the real hull -- one load, two independent
    // clones (a raw get() would share one Object3D between both rigs).
    // The procedural rig renders immediately in the meantime.
    this.experience.resources.load('deliveryVan').then(() => {
      [this.dockTruck, this.queuedTruck].forEach((truck) => {
        const clone = this.experience.resources.clone('deliveryVan');
        if (!clone) return;
        applyTruckModel(truck, clone.scene);
      });
    });

    // Service vehicle -- same two-point-trip mechanism proven in the
    // vehicle-organization pass, retargeted between the dock row and the
    // new parking cluster (there's no Ground Office in this rebuild's
    // scope -- the real reference footage never showed one).
    this.serviceVehicle = createTruck(0x3a3e46, 60);
    this.serviceVehicle.position.set(SERVICE_POINT_A.x, 0, SERVICE_POINT_A.z);
    this.serviceVehicle.rotation.y = Math.PI / 2;
    this.serviceVehicle.userData.targetPoint = 'B';
    this.serviceVehicle.userData.holdTimer = 0;
    this.serviceVehicle.userData.headingY = this.serviceVehicle.rotation.y;
    const serviceBeacon = new Mesh(new SphereGeometry(0.1, 8, 8), new MeshBasicMaterial({ color: 0xffaa33 }));
    serviceBeacon.position.set(0, 3.6, 0);
    const serviceBeaconLight = new PointLight(0xffaa33, 0, 3.5, 2);
    serviceBeaconLight.position.copy(serviceBeacon.position);
    this.serviceVehicle.add(serviceBeacon, serviceBeaconLight);
    this.serviceVehicle.userData.beaconLight = serviceBeaconLight;
    this.group.add(this.serviceVehicle);

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

    // Sorting/Ground Link Pass: same pulse formula Sorting's own route
    // line uses, so the two chapters' tubes read as one continuously
    // pulsing line through the hand-off, not two independently-timed ones.
    const routePulse = 1 - ROUTE_PULSE_DEPTH + ROUTE_PULSE_DEPTH * Math.sin((time.elapsed / ROUTE_PULSE_PERIOD_MS) * Math.PI * 2);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * routePulse;

    const deltaSeconds = time.delta / 1000;
    const velocityT = dampFactor(VELOCITY_HALF_LIFE_MS, time.delta);
    this.fleet.userData.trucks.forEach((truck, truckIndex) => {
      const distanceToWrap =
        truck.userData.direction > 0 ? FLEET_NEAR_WRAP_Z - truck.position.z : truck.position.z - FLEET_FAR_WRAP_Z;
      const taper = Math.max(MIN_TAPER_FACTOR, Math.min(1, distanceToWrap / WRAP_TAPER_DISTANCE));
      const desiredSpeed = truck.userData.targetSpeed * taper;
      truck.userData.speed += (desiredSpeed - truck.userData.speed) * velocityT;

      const truckDeltaZ = truck.userData.speed * truck.userData.direction * deltaSeconds;
      truck.position.z += truckDeltaZ;
      if (truck.position.z > FLEET_NEAR_WRAP_Z) truck.position.z = FLEET_FAR_WRAP_Z;
      if (truck.position.z < FLEET_FAR_WRAP_Z) truck.position.z = FLEET_NEAR_WRAP_Z;

      rollWheels(truck.userData.wheels, truckDeltaZ, TRUCK_WHEEL_RADIUS);

      const brakeDive = (1 - taper) ** 2 * BRAKE_DIVE_AMPLITUDE;
      truck.position.y = Math.sin(time.elapsed / 90 + truckIndex * 1.7) * 0.004 - brakeDive;
      truck.rotation.x = (1 - taper) * 0.05 * truck.userData.direction;

      truck.rotation.z = Math.sin(time.elapsed / 1750 + truckIndex * 2.3) * 0.012;
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

    // Ground Chapter Full Rebuild, Step 6: parking cluster, same idle-
    // motion-only treatment.
    this.parkingTrucks.forEach((truck, i) => {
      truck.position.y = Math.sin(time.elapsed / 90 + i * 1.3) * 0.004;
      truck.rotation.z = Math.sin(time.elapsed / 1750 + i * 1.9) * 0.012;
    });

    this.updateDockCycle(time);
  }

  /** Ground Chapter Full Rebuild, Step 7: the dock's single operational
   *  cycle, reused verbatim from the mechanism proven earlier this
   *  session -- every moving part here is a target-plus-damped-ease, no
   *  per-frame allocation. */
  updateDockCycle(time) {
    const cycleT = time.elapsed % DOCK_CYCLE_MS;
    const phase = phaseFor(cycleT);
    const motionT = dampFactor(DOCK_MOTION_HALF_LIFE_MS, time.delta);
    const phaseChanged = phase !== this.dockCyclePhase;

    if (phaseChanged) {
      if (phase === 'dockOpen' || phase === 'dockClose') this.dispatchGroundEvent('ground:dock-door');
      if (phase === 'unload') this.dispatchGroundEvent('ground:forklift-move');
      if (phase === 'dockClose') this.dispatchGroundEvent('ground:forklift-pause');
      if (phase === 'gap') this.dispatchGroundEvent('ground:truck-idle');
    }

    // Role swap -- once, exactly on entering 'arrive'. By the time
    // 'arrive' begins, the truck that was docked has already reached
    // SPAWN under its old label; swapping here means it picks up the
    // "ease toward QUEUE unless phase is gap" target under its new
    // queuedTruck label, which is exactly the arriving motion.
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

    // Lane discipline -- ease each rig's X toward whichever lane its
    // CURRENT role implies. Deliberately its own (slower) half-life, not
    // `motionT` -- see LANE_SWAP_HALF_LIFE_MS's own comment: this is what
    // lets Z separation open up before the X crossing a role swap forces.
    const laneT = dampFactor(LANE_SWAP_HALF_LIFE_MS, time.delta);
    this.dockTruck.position.x += (DOCK_LANE_X - this.dockTruck.position.x) * laneT;
    this.queuedTruck.position.x += (QUEUE_LANE_X - this.queuedTruck.position.x) * laneT;

    // Anti-interpenetration guard -- see maintainDockQueueSeparation's own
    // comment. Runs after lane discipline so it corrects the position that
    // motion actually landed on this frame, not a stale one.
    maintainDockQueueSeparation(this.dockTruck, this.queuedTruck, dampFactor(SEPARATION_HALF_LIFE_MS, time.delta));

    // Departure heading turn -- a departing truck backs out, then turns
    // to face its real direction of travel once clear of the dock.
    const turnT = dampFactor(DEPART_TURN_HALF_LIFE_MS, time.delta);
    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const isDeparting = truck.userData.targetZ === SPAWN_WAYPOINT_Z;
      const clearOfDock = truck.position.z >= DOCK_TRUCK_WAYPOINT_Z + DEPART_REVERSE_DISTANCE;
      truck.userData.headingY = isDeparting && clearOfDock ? 0 : Math.PI;
      truck.rotation.y += (truck.userData.headingY - truck.rotation.y) * turnT;
    });

    const exhaustTargetOpacity = phase === 'arrive' || phase === 'depart' ? 0.22 : 0;
    const dustTargetOpacity = exhaustTargetOpacity > 0 ? 0.18 : 0;
    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const puff = truck.userData.exhaustPuff;
      puff.material.opacity += (exhaustTargetOpacity - puff.material.opacity) * motionT;
      updateParticles(puff, time.delta / 1000, time.elapsed);

      const dust = truck.userData.tireDust;
      dust.material.opacity += (dustTargetOpacity - dust.material.opacity) * motionT;
      updateParticles(dust, time.delta / 1000, time.elapsed);
    });

    rollWheels(this.dockTruck.userData.wheels, dockTruckDeltaZ * motionT, TRUCK_WHEEL_RADIUS);
    rollWheels(this.queuedTruck.userData.wheels, queuedTruckDeltaZ * motionT, TRUCK_WHEEL_RADIUS);

    this.dockTruck.rotation.z = Math.max(-0.03, Math.min(0.03, dockTruckDeltaZ * 0.01));
    this.queuedTruck.rotation.z = Math.max(-0.03, Math.min(0.03, queuedTruckDeltaZ * 0.01));

    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const steerAngle = Math.max(-0.35, Math.min(0.35, truck.rotation.z * 8));
      truck.userData.frontWheels.forEach((wheel) => {
        wheel.rotation.y = steerAngle;
      });
    });

    const indicatorBlink = Math.sin(time.elapsed / 200) > 0.2;
    [this.dockTruck, this.queuedTruck].forEach((truck) => {
      const [left, right] = truck.userData.indicators;
      const active = indicatorBlink && Math.abs(truck.rotation.z) > 0.004;
      left.visible = active && truck.rotation.z < 0;
      right.visible = active && truck.rotation.z > 0;
    });

    // Dock door.
    const doorTargetY = phase === 'dockOpen' || phase === 'unload' ? DOOR_OPEN_Y : DOOR_CLOSED_Y;
    this.dockDoor.position.y += (doorTargetY - this.dockDoor.position.y) * motionT;
    const doorMidMotion = Math.abs(doorTargetY - this.dockDoor.position.y) > 0.05;
    this.dockDoorWarningLight.intensity = doorMidMotion && Math.sin(time.elapsed / 180) > 0 ? 1.4 : 0;

    // Pallet stack: each pallet reveals at its own threshold within the
    // unload window.
    const unloadDuration = PHASE_UNLOAD_END - PHASE_DOCK_OPEN_END;
    const isStacking = phase === 'unload' || phase === 'dockClose';
    const palletT = dampFactor(PALLET_REVEAL_HALF_LIFE_MS, time.delta);
    this.palletPool.forEach((pallet, i) => {
      const revealAt = PHASE_DOCK_OPEN_END + (i / this.palletPool.length) * unloadDuration;
      const targetScale = isStacking && cycleT >= revealAt ? 1 : 0;
      const previousScale = pallet.scale.x;
      const nextScale = previousScale + (targetScale - previousScale) * palletT;
      pallet.scale.setScalar(nextScale);

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
    // truck and the pallet stack on their own staggered trip periods.
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
        targetX = atDrop ? FORKLIFT_DROP[i].x : FORKLIFT_PICKUP[i].x;
        targetZ = atDrop ? FORKLIFT_DROP[i].z : FORKLIFT_PICKUP[i].z;
      } else if (inLoadoutWindow) {
        loadoutCarrying = cycleT >= LOADOUT_MIDPOINT;
        targetX = loadoutCarrying ? FORKLIFT_PICKUP[i].x : FORKLIFT_DROP[i].x;
        targetZ = loadoutCarrying ? FORKLIFT_PICKUP[i].z : FORKLIFT_DROP[i].z;
      }
      const dz = targetZ - forklift.position.z;
      const dx = targetX - forklift.position.x;
      forklift.position.x += dx * motionT;
      forklift.position.z += dz * motionT;
      forklift.rotation.x = Math.max(-0.15, Math.min(0.15, dz * 0.02));

      rollWheels(forklift.userData.wheels, Math.hypot(dx, dz) * motionT, FORKLIFT_WHEEL_RADIUS);

      const carrying = (phase === 'unload' && atDrop) || loadoutCarrying;
      const forkGroup = forklift.userData.forkGroup;
      const forkHeightTarget = carrying ? FORKLIFT_LIFT_HEIGHT : 0;
      forkGroup.position.y += (forkHeightTarget - forkGroup.position.y) * motionT;
      const cargoBox = forklift.userData.cargoBox;
      if (cargoBox) {
        const cargoTargetScale = carrying ? 1 : 0;
        cargoBox.scale.setScalar(cargoBox.scale.x + (cargoTargetScale - cargoBox.scale.x) * motionT);
      }

      const mast = forklift.userData.mast;
      if (mast) mast.rotation.z = Math.sin(time.elapsed / 580 + i * 2.3) * 0.01;

      // Ground Chapter Composition Pass: brighter, crisper strobe
      // specifically during 'unload' -- from the fixed, wide establishing
      // camera these ~1.2-unit rigs read as barely-visible dark shapes;
      // the working-amber beacon is the one thing on them designed to
      // read at a distance, so this leans further into it rather than
      // adding new geometry. Amber is already the correct, established
      // color for this (Material Language Guide: industrial safety already
      // uses 0xffaa33, real-world convention) -- not a new brand color.
      forklift.userData.beacon.rotation.y = time.elapsed / 260 + i * 3;
      const isUnloading = phase === 'unload';
      const blinkLow = isUnloading ? 0.05 : 0.25;
      const blink = Math.sin(time.elapsed / 340 + i * 5) > 0.6 ? 1 : blinkLow;
      const beaconBase = isUnloading ? 2.4 : 1.6;
      forklift.userData.beaconLight.intensity = beaconBase * blink * this.activityWeight;
    });

    // A small camera lead toward the dock truck's own direction of
    // travel, magnitude scaled by how much of its current leg remains.
    const leadMagnitude = Math.min(1, Math.abs(dockTruckDeltaZ) / DOCK_LEAD_REFERENCE_DISTANCE) * DOCK_LEAD_MAX_AMPLITUDE;
    this.experience.camera.setTargetLead('ground', 0, 0, Math.sign(dockTruckDeltaZ) * leadMagnitude);

    // Service vehicle -- real two-point trip, same mechanism proven in
    // the vehicle-organization pass.
    const serviceTarget = this.serviceVehicle.userData.targetPoint === 'B' ? SERVICE_POINT_B : SERVICE_POINT_A;
    const serviceDx = serviceTarget.x - this.serviceVehicle.position.x;
    const serviceDz = serviceTarget.z - this.serviceVehicle.position.z;
    const serviceDistance = Math.hypot(serviceDx, serviceDz);

    if (this.serviceVehicle.userData.holdTimer > 0) {
      this.serviceVehicle.userData.holdTimer -= time.delta;
      if (this.serviceVehicle.userData.holdTimer <= 0) {
        this.serviceVehicle.userData.holdTimer = 0;
        this.serviceVehicle.userData.targetPoint = this.serviceVehicle.userData.targetPoint === 'B' ? 'A' : 'B';
        this.dispatchGroundEvent('ground:vehicle-reverse');
      }
    } else if (serviceDistance < SERVICE_ARRIVE_DISTANCE) {
      this.serviceVehicle.userData.holdTimer = SERVICE_HOLD_MS;
    } else {
      const serviceMotionT = dampFactor(SERVICE_MOTION_HALF_LIFE_MS, time.delta);
      const previousServiceX = this.serviceVehicle.position.x;
      const previousServiceZ = this.serviceVehicle.position.z;
      this.serviceVehicle.position.x += serviceDx * serviceMotionT;
      this.serviceVehicle.position.z += serviceDz * serviceMotionT;
      this.serviceVehicle.userData.headingY = Math.atan2(serviceDx, serviceDz);
      rollWheels(
        this.serviceVehicle.userData.wheels,
        Math.hypot(this.serviceVehicle.position.x - previousServiceX, this.serviceVehicle.position.z - previousServiceZ),
        TRUCK_WHEEL_RADIUS
      );
    }

    const serviceHeadingT = dampFactor(SERVICE_HEADING_HALF_LIFE_MS, time.delta);
    this.serviceVehicle.rotation.y += (this.serviceVehicle.userData.headingY - this.serviceVehicle.rotation.y) * serviceHeadingT;

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
