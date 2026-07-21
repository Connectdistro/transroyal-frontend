import {
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { createLights } from './createLights.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR, LIGHT_TINT_HALF_LIFE_MS } from '../utils/damp.js';
import { LIGHT_TINTS } from '../camera/shots.js';
import { varyMaterial } from './materialVariation.js';

const LANDMASS_COLOR = 0x14151a;
const BLOCK_COLOR = 0x2a2d33;
const CLOUD_COLOR = 0xeef2ff;
// Air's own accent from config.js.
const ELECTRIC_400 = 0x4fa3ff;
const ROYAL_600 = 0x2540b0;
// Fuselage reads light/reflective -- distinctly lighter than every ground
// vehicle's own industrial-neutral palette, so it can visibly "catch" the
// key light (Commit 4).
const FUSELAGE_COLOR = 0xd4dbe8;
const ENGINE_COLOR = 0x14181f;
// Matches GroundEnvironment.js's CONTAINER_COLORS[0] exactly -- a
// deliberate visual echo, not a cross-file import (these sibling
// environment files have no dependencies on each other; the shared hex
// value alone carries "the same shipment" through both chapters).
const CARGO_POD_COLOR = 0x2f5fae;
// A warm accent, deliberately distinct from the chapter's cool electric-blue
// palette -- "destination glow warming" (Commit 4) reads against this
// contrast, and it doubles as the arrival beacon's own color.
const DESTINATION_COLOR = 0xffb347;

// Well past Ground's own region -- height (not distance) is what protects
// this chapter from the others, since the camera sits far above every
// ground-level region regardless of z (Section 23: "true aerial altitude").
const REGION_Z = -460;

const TRAIL_COUNT = 5;
const PULSE_PERIOD = 5000;

// Destination marker brightness ramp (Commit 2/4): normal pulse until the
// approach zone, ramping to a held, brighter arrival state.
const DESTINATION_APPROACH_START = 0.75;
const DESTINATION_ARRIVAL_THRESHOLD = 0.97;
const DESTINATION_ARRIVAL_BOOST = 2.6;
const DESTINATION_BOOST_HALF_LIFE_MS = 600;

// Flight motion (Commit 3): a single eased speed (progress-units/second)
// chases a target that tapers near both ends of the curve -- accelerating
// off P0, holding cruise through the middle, decelerating into the
// approach -- the same taper-by-proximity-to-boundary technique Ground's
// truck/parcel velocity system already uses, applied to a 0-1 curve
// parameter instead of world-space Z.
const FLIGHT_CRUISE_SPEED = 1 / 34;
const FLIGHT_TAPER_DISTANCE = 0.14;
const FLIGHT_MIN_TAPER = 0.06;
const FLIGHT_VELOCITY_HALF_LIFE_MS = 900;
const FLIGHT_LOOK_AHEAD = 0.01;
const FLIGHT_BANK_LOOK_AHEAD = 0.02;
const FLIGHT_MAX_BANK = (22 * Math.PI) / 180;
const FLIGHT_BANK_GAIN = 60;

// Cinematic Motion Refinement Phase, Commit 1: how far (world units, at
// full cruise speed) the camera's target leads the aircraft's own current
// heading -- CameraRig.setTargetLead() clamps to its own smaller ceiling
// regardless, this just sets the design intent so the lead visibly breathes
// with flightSpeed rather than sitting permanently at the clamp.
const TARGET_LEAD_SCALE = 1;

// Cinematic Motion Refinement Phase, Commit 3: the cargo pod lags the
// aircraft's own bank angle, reading as the load swinging/settling under
// the aircraft rather than being welded to it. A slower half-life than the
// bank calculation's own instant application, so the pod visibly trails.
const CARGO_SWAY_HALF_LIFE_MS = 380;

// Cinematic Motion Refinement Phase, Commit 4: cross-chapter continuity.
// scene-blend.js's corridor loop calls setNeighborInfluence() every tick
// for every region that defines it -- eases the destination marker's
// prominence up a little ahead of the actual shot cut while entering from
// `ground` (the shipment's own departure point), and a smaller settle cue
// while leaving toward `final-mile`.
const NEIGHBOR_BOOST_HALF_LIFE_MS = 500;
const NEIGHBOR_PROMINENCE_SCALE = 0.35;

// Loop behavior (Commit 4, revised for a real round trip): a brief held
// dwell at EACH endpoint between legs -- the same dwell-then-transition
// idiom as Ground's dock cycle phases. The return leg is a genuine flight
// (same taper-speed physics as the outbound leg, direction reversed), not
// a fast rewind of the progress value -- see the 4-state FSM in update()
// (outbound -> destinationHold -> inbound -> originHold -> repeat).
const FLIGHT_HOLD_DURATION_MS = 1800;

// "Sunlight catching the fuselage" on approach (Commit 4): a small extra
// multiplier on the key light only, ramping up over the flight's final
// quarter -- same activityWeight-multiplication pattern already used
// everywhere, layered with its own eased target so it never jumps.
const FLIGHT_SUNLIGHT_START = 0.75;
const FLIGHT_SUNLIGHT_BOOST = 1.35;
const FLIGHT_SUNLIGHT_HALF_LIFE_MS = 1200;

// Logistics Choreography Phase, Commit 5: gear/flap staging and a liftoff
// "rotation" pitch. Confirmed with the user: the Air chapter's shot and
// flight path stay true-aerial-altitude only (no literal runway) -- these
// simulate the departure/arrival story beats via simple progress-threshold
// visibility/angle targets (the same idiom the destination marker's
// approach ramp already uses), not a literal ground sequence.
const GEAR_EXTENDED_WINDOW = 0.05;
// Motion Weight Pass: nose and main gear ease independently toward the same
// target (never a hand-authored delay timer) -- the nose leg's own faster
// half-life makes it lead the lift/touchdown sequence for free, and the
// main legs' much slower half-life is what turns retraction into the
// several-seconds process real gear takes, not a half-second snap. Confirmed
// with the user: still no literal runway/ground-contact geometry -- this is
// the existing symmetric-window abstraction, just two eased rates instead
// of one.
const GEAR_NOSE_HALF_LIFE_MS = 350;
const GEAR_MAIN_HALF_LIFE_MS = 2200;
const FLAP_DEPLOY_WINDOW = 0.08;
const FLAP_MAX_ANGLE = (18 * Math.PI) / 180;
const FLAP_HALF_LIFE_MS = 500;
// Widened from the previous 6 deg into the 8-12 deg real-world rotation
// range, and eased (smoothstep, see rotationEnvelope's own use in update())
// rather than a linear ramp -- reads as a deliberate rotation, not a twitch.
const ROTATION_PITCH_MAX = (10 * Math.PI) / 180;
const ROTATION_PITCH_WINDOW = 0.06;
// Motion Weight Pass: a smaller, mirrored pitch bias right at the OPPOSITE
// end of the current leg from ROTATION_PITCH_MAX above -- a liftoff
// "rotation" happens at the leg's departure end, this "flare" happens at
// its arrival end, the same idiom the destination marker's own approach
// ramp already uses, just applied to pitch instead of light intensity.
const FLARE_PITCH_MAX = (4 * Math.PI) / 180;
const FLARE_WINDOW = 0.035;

// Motion Weight Pass: the "throttle up, nothing moves yet while thrust
// builds" beat -- flightSpeed's own target is held at 0 for this long after
// a hold ends, before the taper-based acceleration below is allowed to
// engage, so departure reads as two distinct beats (spool, then roll) not
// one continuous ease. Engine glow and the airframe vibration below both
// ramp against this same timer independent of actual motion, so the
// aircraft visibly "comes alive" before it ever moves.
const SPOOL_DURATION_MS = 1100;
const SPOOL_VIBRATION_BOOST = 3;
// A small, brief squat-then-release on the aircraft's own world Y during
// the spool window -- "compresses slightly under thrust, then releases as
// it starts rolling." Single half-sine pulse (peaks at the window's
// midpoint), not a spring simulation -- this chapter has no literal gear/
// runway contact to actually compress against, so the cue stays subtle and
// abstracted like every other ground-mechanic cue here.
const SPOOL_COMPRESSION_AMOUNT = 0.06;

// Logistics Choreography Phase, Commit 6: aircraft-mounted lights and
// engine glow. Standard aviation nav-light convention: red on the left
// wingtip, green on the right (facing forward, -Z).
const NAV_LIGHT_RED = 0xff3b30;
const NAV_LIGHT_GREEN = 0x30d158;
const BEACON_COLOR = 0xff3b30;
const BEACON_BLINK_PERIOD_MS = 900;
const BEACON_BASE_INTENSITY = 1.4;
const TAXI_LIGHT_COLOR = 0xfff2d0;
const TAXI_LIGHT_WINDOW = 0.05;
const TAXI_LIGHT_HALF_LIFE_MS = 500;
const TAXI_LIGHT_BASE_INTENSITY = 2.2;
const ENGINE_GLOW_COLOR = 0xffb347;
const ENGINE_GLOW_MAX_OPACITY = 0.7;

// Asset Integration Phase, Air Chapter Commit 1: the real cargoPlane GLB
// (manifest id `cargoPlane`) replaces the procedural hull once it loads.
// Confirmed live in the Asset Gallery before writing this: the model's nose
// points toward +Z and its own local origin sits ~8 units off its true
// geometric center -- the opposite of this file's own "-Z is forward,
// origin at the hull's center" convention that lookAt()/rotateX()/rotateZ()
// all assume every frame. CARGO_PLANE_MODEL_ROTATION_Y and the recenter in
// applyCargoPlaneModel() correct both before the model ever joins the
// aircraft group, so none of the existing flight/banking/pitch code below
// needs to know a swap happened.
//
// CARGO_PLANE_MODEL_SCALE matches the loaded model's raw wingspan (60.18
// units, confirmed via a full vertex-bounds check) to the procedural hull's
// own pre-group-scale wingspan (24, from the `wings` BoxGeometry below) --
// the dimension the `air` shot's framing was actually verified against, so
// the aircraft keeps reading at the same size in-frame post-swap. The real
// model's proportions aren't the procedural hull's simplified ones (a real
// C-17's length is close to its wingspan; the procedural hull was
// deliberately squashed shorter), so gear/flap/light attachment offsets
// below are widened by CARGO_PLANE_LENGTH_RATIO along Z to track the real,
// more elongated fuselage rather than sitting tuned for the old boxy one.
const CARGO_PLANE_MODEL_ROTATION_Y = Math.PI;
const CARGO_PLANE_MODEL_SCALE = 24 / 60.18;
const CARGO_PLANE_LENGTH_RATIO = 1.28;
// Same reasoning as CARGO_PLANE_LENGTH_RATIO, for the vertical axis. The
// real hull's centered half-height works out to ~3.84 units at
// CARGO_PLANE_MODEL_SCALE versus the procedural fuselage's 1.6, so a
// literal ratio (2.4) was tried first -- verified live, it pushed the
// cargo pod/gear/taxi light far enough below the hull to read as visually
// detached rather than attached. This smaller value is a deliberately
// conservative compromise, verified live in its place.
const CARGO_PLANE_HEIGHT_RATIO = 1.3;

// Module-scope scratch vectors, reused every frame (never reallocated) as
// `optionalTarget` args to Curve.getPointAt()/getTangentAt() -- Goal 9's
// zero-per-frame-allocation rule.
const scratchPosition = new Vector3();
const scratchLookAt = new Vector3();
const scratchTangentNow = new Vector3();
const scratchTangentAhead = new Vector3();
const scratchRight = new Vector3();
const scratchHeadingDelta = new Vector3();

function createLandmass() {
  const group = new Group();
  const plane = new Mesh(
    new PlaneGeometry(340, 340),
    new MeshStandardMaterial({ color: LANDMASS_COLOR, roughness: 0.95, metalness: 0 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, -38, REGION_Z);
  group.add(plane);

  // Faint distant city-block texture -- small, sparse, never a literal
  // structure at this altitude (Section 23: "none in the architectural
  // sense -- this chapter is landscape and light").
  const blockMaterial = new MeshStandardMaterial({ color: BLOCK_COLOR, roughness: 0.8, metalness: 0.1 });
  for (let i = 0; i < 60; i += 1) {
    const w = 1.5 + Math.random() * 3;
    const block = new Mesh(new BoxGeometry(w, 0.3 + Math.random() * 0.4, w), blockMaterial);
    block.position.set((Math.random() - 0.5) * 260, -37.7, REGION_Z + (Math.random() - 0.5) * 260);
    group.add(block);
  }

  return group;
}

/** A near-foreground cloud layer between the camera and the landmass below
 *  (Section 23) -- soft, low-opacity, additive so overlapping layers read
 *  as haze rather than solid geometry. */
function createCloudLayer() {
  const group = new Group();
  const material = new MeshBasicMaterial({ color: CLOUD_COLOR, transparent: true, opacity: 0.18 });

  // Biased toward the frame's right two-thirds and the mid-distance, not the
  // near-camera lower-left -- Composition Rules (Section 22) keep that zone
  // quiet for the interface regardless of world content.
  for (let i = 0; i < 11; i += 1) {
    const cloud = new Mesh(new PlaneGeometry(50 + Math.random() * 70, 18 + Math.random() * 14), material);
    cloud.rotation.x = -Math.PI / 2;
    cloud.position.set(Math.random() * 220 - 50, 34 + Math.random() * 20, REGION_Z + 60 - i * 16);
    group.add(cloud);
  }

  return group;
}

/** Shipping and flight lanes rendered as light trails (Section 23) -- the
 *  connective motif carried from every prior chapter's route line, now at
 *  continental scale, all following the camera's own dominant sightline. */
function createLightTrails() {
  const group = new Group();
  const material = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.75 });
  const lines = [];

  for (let i = 0; i < TRAIL_COUNT; i += 1) {
    const xOffset = -100 + i * 45;
    const curve = new CatmullRomCurve3([
      new Vector3(xOffset, -37.7, REGION_Z + 140),
      new Vector3(xOffset + 40, -37.7, REGION_Z + 40),
      new Vector3(xOffset + 90, -37.7, REGION_Z - 60),
      new Vector3(xOffset + 150, -37.7, REGION_Z - 160),
    ]);
    const lineMaterial = material.clone();
    lineMaterial.userData.baseOpacity = 0.75;
    const line = new Mesh(new TubeGeometry(curve, 120, 0.25, 6, false), lineMaterial);
    group.add(line);
    lines.push(line);
  }

  group.userData.lines = lines;
  return group;
}

// Global Logistics Cinematic Air Cargo Sequence, Commit 1: the flight-path
// waypoints, authored against the `air` shot's own sightline (camera/
// shots.js: position {x:-10,y:72,z:-380} -> target {x:30,y:66,z:-560}).
// The shot looks toward MORE NEGATIVE z (forward = target - position =
// (40,-6,-180)), so every waypoint's z must sit below -380 (in front of the
// camera, not behind it). P0 is offset well to camera-left (x=-30) rather
// than sitting on the sightline itself: verified live against the actual
// shot, a P0 placed directly on the sightline put the aircraft's initial
// climb heading almost straight down the camera's own view axis, which
// foreshortened it into an unreadable nose-on silhouette (and, scaled up,
// clipped the tail past the near plane). Starting off-axis means the early
// tangent points across the frame instead of at the camera, so the
// aircraft reads broadside/three-quarter -- nose, wings, and cargo pod all
// visible -- while banking in toward cruise. Cruise (P2/P3) matches the
// shot's own y=66-72 band, and the destination (P5) sits past the shot's
// own target x/z, so arrival lands exactly where the camera is already
// looking.
const FLIGHT_WAYPOINTS = [
  [-30, 48, -480], // origin / takeoff (banking in from camera-left, broadside)
  [0, 60, -500], // climb
  [20, 70, -530], // cruise-in
  [35, 71, -570], // cruise / bank
  [45, 50, -610], // begin descent
  [52, 22, -650], // destination / arrival
];

/** One CatmullRomCurve3 shared by the aircraft's own motion (Commit 3) and
 *  the delivery-thread tubes (Commit 2) -- never duplicated. */
function createFlightPath() {
  return new CatmullRomCurve3(FLIGHT_WAYPOINTS.map(([x, y, z]) => new Vector3(x, y, z)));
}

/** Logistics Choreography Phase, Commit 5: small strut+wheel landing
 *  gear, extended (scale 1) near departure/arrival and retracted (scale
 *  0) through cruise -- implies "just left/about to touch down" without
 *  the chapter ever depicting a literal runway (see this file's own
 *  altitude-only design intent). */
/** Motion Weight Pass: nose and main gear are now separate sub-groups
 *  (previously one flat group scaled uniformly) so update() can ease each
 *  toward the shared gear target at its own rate -- see GEAR_NOSE_HALF_LIFE_MS/
 *  GEAR_MAIN_HALF_LIFE_MS's own doc comment for why. */
function createLandingGear() {
  const group = new Group();
  const noseGear = new Group();
  const mainGear = new Group();
  group.add(noseGear, mainGear);

  const strutMaterial = new MeshStandardMaterial({ color: ENGINE_COLOR, roughness: 0.5, metalness: 0.5 });
  const wheelMaterial = new MeshStandardMaterial({ color: 0x14181f, roughness: 0.7, metalness: 0.2 });
  const legs = [
    [noseGear, 0, -2.4 * CARGO_PLANE_HEIGHT_RATIO, -7 * CARGO_PLANE_LENGTH_RATIO],
    [mainGear, -2.6, -2.6 * CARGO_PLANE_HEIGHT_RATIO, 1 * CARGO_PLANE_LENGTH_RATIO],
    [mainGear, 2.6, -2.6 * CARGO_PLANE_HEIGHT_RATIO, 1 * CARGO_PLANE_LENGTH_RATIO],
  ];
  legs.forEach(([parent, x, y, z]) => {
    const strut = new Mesh(new CylinderGeometry(0.08, 0.08, 1.2, 6), strutMaterial);
    strut.position.set(x, y + 0.6, z);
    const wheel = new Mesh(new CylinderGeometry(0.35, 0.35, 0.25, 10), wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    parent.add(strut, wheel);
  });
  return { group, noseGear, mainGear };
}

/** A simple, legible cargo aircraft from the same flat-color primitive
 *  vocabulary every other chapter already uses -- built along the local
 *  -Z axis (nose at -Z) specifically so Object3D.lookAt() orients it
 *  correctly with no extra rotation offset (Commit 3). The cargo pod is
 *  the chapter's actual subject: visible for the entire flight, in the
 *  same color language as Ground's own containers -- "the same
 *  shipment," carried the whole way, not hidden inside the fuselage. */
function createCargoAircraft() {
  const group = new Group();

  const fuselageMaterial = new MeshStandardMaterial({ color: FUSELAGE_COLOR, roughness: 0.35, metalness: 0.45 });
  varyMaterial(fuselageMaterial, 700);
  const fuselage = new Mesh(new BoxGeometry(3.2, 3.2, 16), fuselageMaterial);
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new Mesh(new CylinderGeometry(0.15, 1.6, 3, 8), fuselageMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -9.4);
  group.add(nose);

  const wingMaterial = new MeshStandardMaterial({ color: ENGINE_COLOR, roughness: 0.45, metalness: 0.4 });
  const wings = new Mesh(new BoxGeometry(24, 0.4, 3.4), wingMaterial);
  wings.position.set(0, -0.3, 0.5);
  group.add(wings);

  // Logistics Choreography Phase, Commit 6: nav lights at the wingtips --
  // standard aviation convention, red on the left (-X, facing forward
  // -Z), green on the right. Always on, small emissive spheres (no
  // PointLight needed -- these are meant to read as tiny colored points,
  // not illuminate anything).
  [
    [-12, NAV_LIGHT_RED],
    [12, NAV_LIGHT_GREEN],
  ].forEach(([x, color]) => {
    const navLight = new Mesh(new SphereGeometry(0.18, 8, 8), new MeshBasicMaterial({ color }));
    navLight.position.set(x, -0.3, 0.5);
    group.add(navLight);
  });

  const tailVertical = new Mesh(new BoxGeometry(0.3, 3, 2.4), wingMaterial);
  tailVertical.position.set(0, 2.3, 7.2);
  const tailHorizontal = new Mesh(new BoxGeometry(7.5, 0.3, 1.8), wingMaterial);
  tailHorizontal.position.set(0, 1.1, 7.2);
  group.add(tailVertical, tailHorizontal);

  const engineGeometry = new CylinderGeometry(0.6, 0.6, 2.6, 10);
  // Logistics Choreography Phase, Commit 6: a small emissive disc at each
  // engine's rear (the aft/exhaust end, local +Z), brightness scaling
  // with flightSpeed in update() -- a cheap "thrust response" cue reusing
  // a value already computed every frame, no new state.
  const engineGlowMaterial = new MeshBasicMaterial({ color: ENGINE_GLOW_COLOR, transparent: true, opacity: 0 });
  const engineGlows = [];
  const engines = [];
  [-6, 6].forEach((x) => {
    const engine = new Mesh(engineGeometry, wingMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -1, 0.6);
    group.add(engine);
    engines.push(engine);

    const glow = new Mesh(new CylinderGeometry(0.45, 0.45, 0.05, 10), engineGlowMaterial);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, -1, 1.95 * CARGO_PLANE_LENGTH_RATIO);
    group.add(glow);
    engineGlows.push(glow);
  });

  const cargoPodMaterial = new MeshStandardMaterial({ color: CARGO_POD_COLOR, roughness: 0.5, metalness: 0.3 });
  varyMaterial(cargoPodMaterial, 701);
  const cargoPod = new Mesh(new BoxGeometry(2.2, 1.5, 6), cargoPodMaterial);
  cargoPod.position.set(0, -2.1 * CARGO_PLANE_HEIGHT_RATIO, -1 * CARGO_PLANE_LENGTH_RATIO);
  group.add(cargoPod);

  // Logistics Choreography Phase, Commit 5: trailing-edge flaps, one per
  // side, each in its own small pivot group so rotating the group droops
  // the flap mesh down/back from its leading (hinge) edge rather than
  // spinning around its own center.
  const flapGroups = [-8, 8].map((x) => {
    const flapGroup = new Group();
    flapGroup.position.set(x, -0.3, 2.2 * CARGO_PLANE_LENGTH_RATIO);
    const flap = new Mesh(new BoxGeometry(6, 0.12, 1.4), wingMaterial);
    flap.position.set(0, 0, 0.7);
    flapGroup.add(flap);
    group.add(flapGroup);
    return flapGroup;
  });

  const { group: gear, noseGear, mainGear } = createLandingGear();
  noseGear.scale.setScalar(0);
  mainGear.scale.setScalar(0);
  group.add(gear);

  // Logistics Choreography Phase, Commit 6: anti-collision beacon (small
  // blinking PointLight, fuselage top, continuous blink independent of
  // flight phase -- same idiom as Ground's own forklift beacons) and a
  // taxi/landing light (brightness ramped in update() during the low-
  // altitude departure/approach windows, dim at cruise).
  const beacon = new Mesh(new SphereGeometry(0.14, 8, 8), new MeshBasicMaterial({ color: BEACON_COLOR }));
  beacon.position.set(0, 1.75 * CARGO_PLANE_HEIGHT_RATIO, 2 * CARGO_PLANE_LENGTH_RATIO);
  // `distance` (this constructor's 3rd arg) is the light's own falloff
  // radius -- left at its original value, it's now small relative to the
  // real hull's larger surfaces, producing a tight, hard-edged specular
  // hotspot on nearby geometry instead of the soft point-source glow it
  // read as against the procedural hull (confirmed live). Scaled by the
  // same length ratio as everything else positioned relative to the hull.
  const beaconLight = new PointLight(BEACON_COLOR, 0, 4 * CARGO_PLANE_LENGTH_RATIO, 2);
  beaconLight.position.copy(beacon.position);
  group.add(beacon, beaconLight);

  const taxiLight = new PointLight(TAXI_LIGHT_COLOR, 0, 6 * CARGO_PLANE_LENGTH_RATIO, 2);
  taxiLight.position.set(0, -0.5 * CARGO_PLANE_HEIGHT_RATIO, -9.8 * CARGO_PLANE_LENGTH_RATIO);
  group.add(taxiLight);

  group.userData.wings = wings;
  group.userData.cargoPod = cargoPod;
  group.userData.flapGroups = flapGroups;
  group.userData.gear = gear;
  group.userData.noseGear = noseGear;
  group.userData.mainGear = mainGear;
  group.userData.engineGlowMaterial = engineGlowMaterial;
  group.userData.beaconLight = beaconLight;
  group.userData.taxiLight = taxiLight;
  // Asset Integration Phase, Air Chapter Commit 1: the raw hull primitives
  // only -- everything the real cargoPlane GLB's own detailed mesh already
  // depicts once it loads (fuselage, nose, flat-box wings/tail, engine
  // nacelles). cargoPod/flapGroups/gear/lights are NOT in this list -- they
  // stay visible as procedural attachments layered onto the real hull (see
  // applyCargoPlaneModel()), since the static GLB has no rig of its own for
  // any of them and the cargo pod is a deliberate narrative element, not
  // hull geometry.
  group.userData.hullMeshes = [fuselage, nose, wings, tailVertical, tailHorizontal, ...engines];
  // Real cruising-altitude framing dwarfs a literal-scale fuselage against
  // the 340-unit landmass -- scaled up so the aircraft reads as the frame's
  // hero object (Section: camera stays put, "aircraft remains the hero"),
  // verified against the actual `air` shot rather than guessed.
  group.scale.setScalar(2);
  return group;
}

/** Asset Integration Phase, Air Chapter Commit 1: swaps the procedural hull
 *  primitives for the real cargoPlane GLB once it loads, without touching
 *  any of the flight/banking/pitch/gear/flap/light code above -- all of
 *  that reads `this.aircraft`'s own transform and its `userData` children,
 *  neither of which change identity here.
 *
 *  `scene` arrives fresh from Resources.clone() with whatever pivot/facing
 *  its source file happened to author (confirmed live in the Asset
 *  Gallery: nose at +Z, origin offset from the true geometric center) --
 *  three nested groups correct that without fighting matrix-composition
 *  order on a single object: `recenter` shifts the model so its own bbox
 *  center sits at local origin (a pure translation, unrotated); `flip`
 *  then rotates that already-centered pivot 180 deg around Y so the nose
 *  ends up at -Z, matching every other object in this file; `container`
 *  applies the uniform scale. The result behaves exactly like the
 *  procedural hull it replaces: centered at local origin, nose at -Z. */
function applyCargoPlaneModel(aircraftGroup, scene) {
  // The source file's own rear cargo-ramp part ("DropDoor") is authored
  // ~11 units below the main body in its raw coordinate space -- after
  // this function's scale it reads as a strange dangling appendage rather
  // than an integrated part of the hull (confirmed live). Removed outright
  // (not just hidden) before computing the bounding box below -- Box3's
  // own traversal ignores `.visible` and would still skew the box toward
  // wherever the drop door sits otherwise. Collected first, then removed
  // in a separate pass -- mutating each node's parent.children mid-
  // traverse() would disrupt that same array's own iteration.
  const dropDoors = [];
  scene.traverse((child) => {
    if (child.name.toLowerCase().includes('dropdoor')) dropDoors.push(child);
  });
  dropDoors.forEach((node) => node.parent?.remove(node));

  const box = new Box3().setFromObject(scene);
  const center = box.getCenter(new Vector3());

  const recenter = new Group();
  scene.position.sub(center);
  recenter.add(scene);

  const flip = new Group();
  flip.rotation.y = CARGO_PLANE_MODEL_ROTATION_Y;
  flip.add(recenter);

  const container = new Group();
  container.scale.setScalar(CARGO_PLANE_MODEL_SCALE);
  container.add(flip);

  scene.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });

  aircraftGroup.userData.hullMeshes.forEach((mesh) => {
    mesh.visible = false;
  });
  aircraftGroup.add(container);
}

/** A small, modest "shipment leaves the hub" beat near the flight path's
 *  own start -- deliberately not a full ground-level choreography (see
 *  this file's own Context note on legibility at true cruising altitude).
 *  Placed just below/beside P0, not at the distant landmass level, so it
 *  stays comfortably within the same visible region as the aircraft's own
 *  starting position. */
function createOriginVignette() {
  const group = new Group();
  const containerMaterial = new MeshStandardMaterial({ color: CARGO_POD_COLOR, roughness: 0.5, metalness: 0.3 });
  varyMaterial(containerMaterial, 702);
  const container = new Mesh(new BoxGeometry(2.4, 2.2, 5), containerMaterial);
  container.position.set(0, 0, 0);
  group.add(container);

  const loaderMaterial = new MeshStandardMaterial({ color: 0xd8621a, roughness: 0.5, metalness: 0.2 });
  const loaderBody = new Mesh(new BoxGeometry(1.4, 1.6, 3), loaderMaterial);
  loaderBody.position.set(3, -0.5, -3);
  group.add(loaderBody);

  // Matched to the aircraft's own scale bump (createCargoAircraft) so the
  // cargo container reads as continuous with the pod it becomes once
  // loaded -- "the same shipment," not a mismatched miniature. Children are
  // positioned in small local offsets above specifically so scale and
  // world placement (set once here) don't multiply against each other.
  group.scale.setScalar(1.8);
  group.position.set(-34, 44, -477);
  return group;
}

const THREAD_TUBULAR_SEGMENTS = 120;
const THREAD_RADIAL_SEGMENTS = 8;
const THREAD_INDICES_PER_RING = THREAD_RADIAL_SEGMENTS * 6;

/** Two tubes built from the SAME flight-path curve instance (never a
 *  duplicate) -- a dim, always-fully-visible base ("remaining route is
 *  subtle") and a brighter overlay whose BufferGeometry.setDrawRange is
 *  advanced each frame in update() to grow behind the aircraft, allocation-
 *  free, the same TubeGeometry + native draw-range technique already used
 *  by every other chapter's route line (just revealed progressively here
 *  instead of drawn whole). Commit 1's curve starts at P0 (u=0), and
 *  TubeGeometry's index buffer is built ring-by-ring along that same
 *  parameterization, so revealing indices from 0 upward grows the tube
 *  from the same point the aircraft departs. */
function createDeliveryThread(curve) {
  const group = new Group();

  const baseGeometry = new TubeGeometry(curve, THREAD_TUBULAR_SEGMENTS, 0.35, THREAD_RADIAL_SEGMENTS, false);
  const baseMaterial = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.18 });
  group.add(new Mesh(baseGeometry, baseMaterial));

  const overlayGeometry = new TubeGeometry(curve, THREAD_TUBULAR_SEGMENTS, 0.45, THREAD_RADIAL_SEGMENTS, false);
  const overlayMaterial = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.85 });
  overlayGeometry.setDrawRange(0, 0);
  group.add(new Mesh(overlayGeometry, overlayMaterial));

  return { group, overlayGeometry, indexCount: overlayGeometry.index.count };
}

/** A modest glow + practical light at the flight path's own destination
 *  (P5) -- the same glow-mesh-plus-PointLight beacon precedent every other
 *  chapter already uses (Ground's dock beacon, FinalMile's porch light),
 *  scaled for this chapter's much larger distances. Pulses gently at rest;
 *  update() ramps its brightness target up as flightProgress approaches 1
 *  (Commit 4 supplies the real progress; this commit's placeholder in
 *  update() exercises the same ramp). */
function createDestinationMarker(position) {
  const group = new Group();

  const glow = new Mesh(
    new SphereGeometry(1.4, 16, 16),
    new MeshBasicMaterial({ color: DESTINATION_COLOR, transparent: true, opacity: 0.85 })
  );
  group.add(glow);

  const light = new PointLight(DESTINATION_COLOR, 2.4, 40, 2);
  group.add(light);

  group.position.copy(position);
  return { group, glow, light, baseGlowOpacity: 0.85, baseLightIntensity: 2.4 };
}

/**
 * The Air Cargo Hub / Global Logistics (Production Handbook Section 23,
 * Scene 05) -- experienced from true altitude, the journey's continental
 * scale reveal. Own region of the continuous scene graph (Section 9:
 * `REGION_Z`); the camera's own `air` shot (camera/shots.js) sits far above
 * every other chapter's geometry, so this region needs no ground-level
 * clearance from Ground's. This class carries no camera state.
 */
export class AirEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();
    this.clouds = createCloudLayer();
    this.lightTrails = createLightTrails();
    this.group.add(createLandmass(), this.clouds, this.lightTrails);

    // Global Logistics Cinematic Air Cargo Sequence, Commit 1: the flight
    // path (shared with Commit 2's delivery-thread tubes) and the aircraft
    // itself, placed at the curve's own start with an instant look-at
    // toward a point just ahead -- Commit 3 wires the actual eased
    // progress-driven motion into update(); this constructor only builds
    // and places things.
    this.flightPath = createFlightPath();
    this.aircraft = createCargoAircraft();
    this.aircraft.position.copy(this.flightPath.getPointAt(0));
    this.aircraft.lookAt(this.flightPath.getPointAt(0.01));
    this.group.add(this.aircraft);
    this.group.add(createOriginVignette());

    // Asset Integration Phase, Air Chapter Commit 1: the procedural hull
    // built above renders immediately (no blank hero object while this
    // loads) and stays the visual until the real GLB is ready, then
    // applyCargoPlaneModel() hides the hull primitives and attaches the
    // real mesh in their place. `preload: false` in the manifest means this
    // is the first thing that ever requests it -- resources.load() caches
    // after, so re-entering this chapter later is instant.
    this.experience.resources.load('cargoPlane').then(() => {
      const clone = this.experience.resources.clone('cargoPlane');
      if (!clone) return;
      applyCargoPlaneModel(this.aircraft, clone.scene);
    });

    // Commit 2: the progressive delivery thread and destination marker,
    // both built from this.flightPath -- the same curve instance, never a
    // duplicate. Commit 3 drives flightProgress via an eased, tapered speed
    // (this.flightSpeed) and samples the curve fresh each frame for the
    // aircraft's own position/orientation/banking.
    this.deliveryThread = createDeliveryThread(this.flightPath);
    this.group.add(this.deliveryThread.group);
    this.destinationMarker = createDestinationMarker(this.flightPath.getPointAt(1));
    this.group.add(this.destinationMarker.group);
    this.flightProgress = 0;
    this.flightSpeed = 0;
    this.flightDirection = 1;
    this.flightState = 'outbound';
    this.flightHoldTimer = 0;
    // Grows with flightProgress during 'outbound' only, frozen during
    // 'destinationHold'/'inbound' (the shipment stays visibly delivered
    // for the whole return leg, not un-delivered), reset to 0 during
    // 'originHold' so a fresh trip regrows its own thread from scratch.
    this.threadReveal = 0;
    this.flightSunlightBoost = 1;
    this.cargoBankLag = 0;
    this.neighborBoost = 0;
    this.neighborBoostTarget = 0;
    this.destinationBoost = 1;
    this.noseGearScale = 0;
    this.mainGearScale = 0;
    this.flapAngle = 0;
    this.taxiLightIntensity = 0;
    // Motion Weight Pass: ms elapsed since the current 'outbound'/'inbound'
    // leg began -- reset to 0 whenever a hold ends and real movement is
    // about to (re)start, drives the spool-then-roll gating in update().
    this.legElapsedMs = 0;
    this.vibrationBoost = 0;

    // Section 23: "both read at greater distance and softer falloff than
    // any other chapter." These two params are only this light's initial
    // value -- shots.js's LIGHT_TINTS.air overrides both immediately at
    // construction below.
    const { key, fill } = createLights({
      keyColor: ELECTRIC_400,
      keyIntensity: 0.9,
      keyPosition: [110, 35, REGION_Z + 30],
      fillColor: ROYAL_600,
      fillIntensity: 0.6,
      fillPosition: [-110, 25, REGION_Z - 50],
      keyTarget: [0, -38, REGION_Z],
    });
    this.keyLight = key;
    this.fillLight = fill;
    this.group.add(key, key.target, fill, fill.target);

    // Cinematic Integration Phase, Commit 1: see OriginEnvironment.js. This
    // chapter has no `this.particles` (clouds/light-trails instead), so its
    // update() below skips the particle-opacity line entirely -- there's no
    // `baseParticleOpacity` to read back.
    this.id = 'air';
    this.baseKeyIntensity = this.keyLight.intensity;
    this.baseFillIntensity = this.fillLight.intensity;
    this.activityWeight = 1;
    this.targetActivityWeight = 1;
    this.activityFloor = DEFAULT_ACTIVITY_FLOOR;

    // Cinematic Polish Phase, Commit 1: see OriginEnvironment.js.
    const tint = LIGHT_TINTS.air;
    this.keyLight.color.set(tint.key);
    this.fillLight.color.set(tint.fill);
    this.targetKeyColor = this.keyLight.color.clone();
    this.targetFillColor = this.fillLight.color.clone();

    this.scene.add(this.group);
  }

  update(time) {
    this.activityWeight += (this.targetActivityWeight - this.activityWeight) * dampFactor(ACTIVITY_HALF_LIFE_MS, time.delta);
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;

    const tintT = dampFactor(LIGHT_TINT_HALF_LIFE_MS, time.delta);
    this.keyLight.color.lerp(this.targetKeyColor, tintT);
    this.fillLight.color.lerp(this.targetFillColor, tintT);

    // Level-cruise light-trail motion and a near-imperceptible cloud drift
    // (Section 23) -- both far calmer than any ground-level chapter's motion.
    // Commit 3: a small progress-linked bias added on top -- clouds nearer
    // the aircraft's current z read as gently reactive to it passing by,
    // reusing the existing per-cloud sine rather than adding a new system.
    const aircraftZ = this.aircraft.position.z;
    this.clouds.children.forEach((cloud, i) => {
      const proximity = Math.max(0, 1 - Math.abs(cloud.position.z - aircraftZ) / 120);
      cloud.position.x += Math.sin(time.elapsed / 9000 + i) * 0.002 + proximity * 0.0015;
    });

    const pulse = 0.85 + 0.15 * Math.sin((time.elapsed / PULSE_PERIOD) * Math.PI * 2);
    this.lightTrails.userData.lines.forEach((line) => {
      line.material.opacity = line.material.userData.baseOpacity * pulse;
    });

    // A real round trip: 'outbound' (0->1) and 'inbound' (1->0) both use
    // the exact same eased-speed-chases-a-taper-target physics (accelerate
    // off the departure end, cruise, decelerate into the approach) --
    // taper is a pure function of flightProgress regardless of which way
    // it's currently moving, so the two legs share this branch, only the
    // sign of the integration step differs. Each leg ends in its own dwell
    // ('destinationHold' / 'originHold', the destination marker's
    // brightest beat happens during the former) before the next leg
    // starts -- outbound -> destinationHold -> inbound -> originHold ->
    // outbound, indefinitely.
    const deltaSeconds = time.delta / 1000;
    let spoolT = 1;
    if (this.flightState === 'outbound' || this.flightState === 'inbound') {
      this.flightDirection = this.flightState === 'outbound' ? 1 : -1;
      this.legElapsedMs += time.delta;
      // Motion Weight Pass: "throttle up, nothing moves yet while thrust
      // builds" -- desiredSpeed stays exactly 0 for the whole spool window
      // regardless of the taper below, so departure reads as two distinct
      // beats (spool, then roll) rather than one continuous ease.
      spoolT = Math.min(1, this.legElapsedMs / SPOOL_DURATION_MS);
      let desiredSpeed = 0;
      if (spoolT >= 1) {
        const taperToEnd = Math.max(FLIGHT_MIN_TAPER, Math.min(1, (1 - this.flightProgress) / FLIGHT_TAPER_DISTANCE));
        const taperFromStart = Math.max(FLIGHT_MIN_TAPER, Math.min(1, this.flightProgress / FLIGHT_TAPER_DISTANCE));
        const taper = Math.min(taperToEnd, taperFromStart);
        // Motion Weight Pass: smoothstep instead of the previous raw linear
        // taper -- slow to build, a more decisive middle ramp, easing again
        // into the approach -- reads closer to real aircraft acceleration
        // than a constant-rate ramp.
        const easedTaper = taper * taper * (3 - 2 * taper);
        desiredSpeed = FLIGHT_CRUISE_SPEED * easedTaper;
      }
      this.flightSpeed += (desiredSpeed - this.flightSpeed) * dampFactor(FLIGHT_VELOCITY_HALF_LIFE_MS, time.delta);
      this.flightProgress += this.flightSpeed * this.flightDirection * deltaSeconds;
      if (this.flightDirection > 0 && this.flightProgress >= 1) {
        this.flightProgress = 1;
        this.flightState = 'destinationHold';
        this.flightHoldTimer = 0;
      } else if (this.flightDirection < 0 && this.flightProgress <= 0) {
        this.flightProgress = 0;
        this.flightState = 'originHold';
        this.flightHoldTimer = 0;
      }
    } else {
      // 'destinationHold' or 'originHold'
      this.flightSpeed = 0;
      this.flightHoldTimer += time.delta;
      if (this.flightHoldTimer >= FLIGHT_HOLD_DURATION_MS) {
        this.flightState = this.flightState === 'destinationHold' ? 'inbound' : 'outbound';
        this.legElapsedMs = 0;
      }
    }

    // Motion Weight Pass: ramps up across the spool window (engines
    // spooling before the aircraft actually moves), eases back down once
    // real motion begins -- feeds both the airframe-vibration jitter and
    // the brief gear-compression squat below, the same target-plus-damped-
    // ease idiom as everything else in this file.
    const vibrationTarget = spoolT < 1 ? 1 + (SPOOL_VIBRATION_BOOST - 1) * spoolT : 1;
    this.vibrationBoost += (vibrationTarget - this.vibrationBoost) * dampFactor(400, time.delta);
    const compressionEnvelope = spoolT < 1 ? Math.sin(spoolT * Math.PI) * SPOOL_COMPRESSION_AMOUNT : 0;

    // See this.threadReveal's own doc comment (constructor) -- grows only
    // on the way out, frozen (still delivered) through the hold and the
    // whole return leg, cleared right as a fresh outbound leg begins.
    if (this.flightState === 'outbound') {
      this.threadReveal = this.flightProgress;
    } else if (this.flightState === 'originHold') {
      this.threadReveal = 0;
    }

    const sunlightTarget =
      this.flightProgress > FLIGHT_SUNLIGHT_START
        ? 1 + ((this.flightProgress - FLIGHT_SUNLIGHT_START) / (1 - FLIGHT_SUNLIGHT_START)) * (FLIGHT_SUNLIGHT_BOOST - 1)
        : 1;
    this.flightSunlightBoost +=
      (sunlightTarget - this.flightSunlightBoost) * dampFactor(FLIGHT_SUNLIGHT_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight * this.flightSunlightBoost;

    // Position and orientation, sampled fresh from the curve every frame --
    // smooth by construction (no snapping), and arc-length parameterized
    // so motion speed reads evenly along the visually curved path rather
    // than just parametrically. getTangentAt() always returns the curve's
    // own increasing-parameter direction regardless of which way the
    // aircraft is actually flying -- every tangent sample below is scaled
    // by flightDirection so "forward" always means the aircraft's real
    // direction of travel, not just "toward P5"; on the inbound leg this
    // is what makes it fly nose-first back toward the origin instead of
    // orienting itself as though still headed for the destination.
    this.flightPath.getPointAt(this.flightProgress, scratchPosition);
    this.aircraft.position.copy(scratchPosition);
    // Motion Weight Pass: the spool-window squat-then-release from above,
    // applied after the curve sample so it isn't overwritten by it --
    // "compresses slightly under thrust, then releases as it starts
    // rolling," the one physical cue this chapter borrows from ground
    // contact without ever depicting an actual runway.
    this.aircraft.position.y -= compressionEnvelope;
    const lookAheadT = Math.max(0, Math.min(1, this.flightProgress + FLIGHT_LOOK_AHEAD * this.flightDirection));
    this.flightPath.getTangentAt(lookAheadT, scratchLookAt);
    scratchLookAt.multiplyScalar(this.flightDirection);
    scratchLookAt.add(scratchPosition);
    this.aircraft.lookAt(scratchLookAt);

    // Banking: compare the tangent at the current progress against a small
    // step ahead (in the actual direction of travel), project the heading
    // change onto the aircraft's own local right vector (post-lookAt),
    // scale and clamp -- a cheap, standard banked-turn approximation
    // layered on top via a local-space roll.
    this.flightPath.getTangentAt(this.flightProgress, scratchTangentNow);
    scratchTangentNow.multiplyScalar(this.flightDirection);
    const bankAheadT = Math.max(0, Math.min(1, this.flightProgress + FLIGHT_BANK_LOOK_AHEAD * this.flightDirection));
    this.flightPath.getTangentAt(bankAheadT, scratchTangentAhead);
    scratchTangentAhead.multiplyScalar(this.flightDirection);
    scratchHeadingDelta.copy(scratchTangentAhead).sub(scratchTangentNow);
    scratchRight.set(1, 0, 0).applyQuaternion(this.aircraft.quaternion);
    const bankSignal = scratchHeadingDelta.dot(scratchRight) * FLIGHT_BANK_GAIN;
    const bankAngle = Math.max(-FLIGHT_MAX_BANK, Math.min(FLIGHT_MAX_BANK, bankSignal));
    this.aircraft.rotateZ(-bankAngle);

    // Cinematic Motion Refinement Phase, Commit 3: cargo pod independent
    // sway -- cargoBankLag eases toward the current bankAngle on its own,
    // slower half-life. The pod is a rigid child of the aircraft group, so
    // giving it a local counter-rotation of (bankAngle - cargoBankLag) on
    // top of the parent's own -bankAngle makes its WORLD roll equal
    // -cargoBankLag instead -- the load visibly trailing the aircraft's
    // own banking rather than welded to it, not a new mechanism, just a
    // second eased copy of a value already computed above.
    this.cargoBankLag += (bankAngle - this.cargoBankLag) * dampFactor(CARGO_SWAY_HALF_LIFE_MS, time.delta);
    const cargoPod = this.aircraft.userData.cargoPod;
    if (cargoPod) cargoPod.rotation.z = bankAngle - this.cargoBankLag;

    // Cinematic Motion Refinement Phase, Commit 1: a small lead on the
    // camera's own target, in the aircraft's current direction of travel,
    // scaled by how fast it's actually moving -- near-zero during
    // hold/reset, full during cruise. Reuses scratchTangentNow (already
    // unit-length, untouched since line above) and the existing
    // flightSpeed -- no new allocation. CameraRig only actually applies
    // this while the `air` shot is the camera's active one (see
    // setTargetLead's own guard), so it's inert whenever another chapter
    // is on screen.
    const leadMagnitude = TARGET_LEAD_SCALE * Math.min(1, this.flightSpeed / FLIGHT_CRUISE_SPEED);
    this.experience.camera.setTargetLead(
      'air',
      scratchTangentNow.x * leadMagnitude,
      scratchTangentNow.y * leadMagnitude,
      scratchTangentNow.z * leadMagnitude
    );

    // Lightweight atmosphere: sub-degree wingtip flex and pitch/roll jitter
    // read as engine vibration, recomputed fresh each frame on top of the
    // curve-driven base orientation above (never accumulated frame to
    // frame, so there's no drift). Scaled by vibrationBoost (Motion Weight
    // Pass) -- during the spool window this reads as "engines spooling up"
    // before the aircraft ever moves, easing back to the calm baseline once
    // it's actually rolling; during a hold it's already this baseline
    // amount, which is what keeps the aircraft feeling "alive" while
    // stationary rather than inert.
    const wings = this.aircraft.userData.wings;
    if (wings) wings.rotation.z = Math.sin(time.elapsed / 260) * 0.01 * this.vibrationBoost;
    this.aircraft.rotateX(Math.sin(time.elapsed / 340 + 2) * 0.0015 * this.vibrationBoost);
    this.aircraft.rotateZ(Math.sin(time.elapsed / 410 + 4) * 0.001 * this.vibrationBoost);

    // Logistics Choreography Phase, Commit 5: a brief "rotation" pitch
    // bias right at departure, layered additively via rotateX (same
    // technique as the wingtip jitter above), active only in the first
    // sliver of the CURRENT leg and easing out as the climb settles into
    // its own curve-derived pitch -- a distinct "liftoff" read without
    // touching the flight-path curve itself. Positive rotateX pitches the
    // nose (local -Z) upward. A round trip departs from both ends (origin
    // on the way out, the destination on the way back), so this reads off
    // whichever end the current leg actually started from rather than
    // always progress=0 -- outbound's own departure is progress=0,
    // inbound's is progress=1.
    const legStartProgress = this.flightDirection > 0 ? 0 : 1;
    const rotationLinear = Math.max(0, 1 - Math.abs(this.flightProgress - legStartProgress) / ROTATION_PITCH_WINDOW);
    // Motion Weight Pass: smoothstep instead of the previous straight-line
    // ramp -- reads as a deliberate, controlled rotation rather than a
    // linear twitch that starts and ends at full speed.
    const rotationEnvelope = rotationLinear * rotationLinear * (3 - 2 * rotationLinear);
    this.aircraft.rotateX(rotationEnvelope * ROTATION_PITCH_MAX);

    // Motion Weight Pass: a smaller, mirrored "flare" pitch right at the
    // CURRENT leg's arrival end (the opposite end from legStartProgress
    // above) -- real aircraft raise the nose slightly just before
    // touchdown to arrest the descent; this reads as that beat without any
    // literal ground contact to flare against.
    const legEndProgress = this.flightDirection > 0 ? 1 : 0;
    const flareLinear = Math.max(0, 1 - Math.abs(this.flightProgress - legEndProgress) / FLARE_WINDOW);
    const flareEnvelope = flareLinear * flareLinear * (3 - 2 * flareLinear);
    this.aircraft.rotateX(flareEnvelope * FLARE_PITCH_MAX);

    // Gear and flaps: extended/deployed near departure and arrival,
    // retracted/flat through cruise -- a pure function of the current
    // flightProgress (same idiom as the destination marker's approach
    // ramp below), so it responds correctly on every leg regardless of
    // which direction progress is currently moving. Nose and main gear
    // ease toward the same target at different rates (see
    // GEAR_NOSE_HALF_LIFE_MS/GEAR_MAIN_HALF_LIFE_MS's own doc comment) --
    // the nose leads on both ends, and retraction takes several seconds
    // instead of snapping.
    const gearTarget =
      this.flightProgress < GEAR_EXTENDED_WINDOW || this.flightProgress > 1 - GEAR_EXTENDED_WINDOW ? 1 : 0;
    this.noseGearScale += (gearTarget - this.noseGearScale) * dampFactor(GEAR_NOSE_HALF_LIFE_MS, time.delta);
    this.mainGearScale += (gearTarget - this.mainGearScale) * dampFactor(GEAR_MAIN_HALF_LIFE_MS, time.delta);
    this.aircraft.userData.noseGear.scale.setScalar(this.noseGearScale);
    this.aircraft.userData.mainGear.scale.setScalar(this.mainGearScale);

    const flapTarget =
      this.flightProgress < FLAP_DEPLOY_WINDOW || this.flightProgress > 1 - FLAP_DEPLOY_WINDOW ? FLAP_MAX_ANGLE : 0;
    this.flapAngle += (flapTarget - this.flapAngle) * dampFactor(FLAP_HALF_LIFE_MS, time.delta);
    this.aircraft.userData.flapGroups.forEach((flapGroup) => {
      flapGroup.rotation.x = this.flapAngle;
    });

    // Logistics Choreography Phase, Commit 6: anti-collision beacon
    // (always blinking, independent of flight phase -- same idiom as
    // Ground's own forklift beacons), taxi/landing light (reuses the same
    // low-progress departure/approach window idiom as gear/flaps above),
    // and engine glow (brightness tracks flightSpeed directly, already
    // computed this frame for the curve-follow taper -- a cheap "thrust
    // response" cue, no new state).
    const beaconBlink = Math.sin((time.elapsed / BEACON_BLINK_PERIOD_MS) * Math.PI * 2) > 0.5 ? 1 : 0;
    this.aircraft.userData.beaconLight.intensity = BEACON_BASE_INTENSITY * beaconBlink * this.activityWeight;

    const taxiLightTarget =
      this.flightProgress < TAXI_LIGHT_WINDOW || this.flightProgress > 1 - TAXI_LIGHT_WINDOW ? TAXI_LIGHT_BASE_INTENSITY : 0;
    this.taxiLightIntensity += (taxiLightTarget - this.taxiLightIntensity) * dampFactor(TAXI_LIGHT_HALF_LIFE_MS, time.delta);
    this.aircraft.userData.taxiLight.intensity = this.taxiLightIntensity * this.activityWeight;

    this.aircraft.userData.engineGlowMaterial.opacity =
      ENGINE_GLOW_MAX_OPACITY * Math.min(1, this.flightSpeed / FLIGHT_CRUISE_SPEED);

    const revealIndices = Math.floor(
      (this.deliveryThread.indexCount * this.threadReveal) / THREAD_INDICES_PER_RING
    ) * THREAD_INDICES_PER_RING;
    this.deliveryThread.overlayGeometry.setDrawRange(0, revealIndices);

    let boostTarget = 1;
    if (this.flightProgress >= DESTINATION_ARRIVAL_THRESHOLD) {
      boostTarget = DESTINATION_ARRIVAL_BOOST;
    } else if (this.flightProgress > DESTINATION_APPROACH_START) {
      const approachT =
        (this.flightProgress - DESTINATION_APPROACH_START) /
        (DESTINATION_ARRIVAL_THRESHOLD - DESTINATION_APPROACH_START);
      boostTarget = 1 + approachT * (DESTINATION_ARRIVAL_BOOST - 1);
    }
    this.destinationBoost +=
      (boostTarget - this.destinationBoost) * dampFactor(DESTINATION_BOOST_HALF_LIFE_MS, time.delta);

    // Cinematic Motion Refinement Phase, Commit 4: eases toward whatever
    // setNeighborInfluence() last targeted (called every tick by
    // scene-blend.js's corridor loop, including an explicit 0 reset once
    // this chapter is neither the current nor adjacent scene -- see that
    // method's own doc).
    this.neighborBoost += (this.neighborBoostTarget - this.neighborBoost) * dampFactor(NEIGHBOR_BOOST_HALF_LIFE_MS, time.delta);

    const markerPulse = 0.85 + 0.15 * Math.sin(time.elapsed / PULSE_PERIOD + 1.7);
    const marker = this.destinationMarker;
    const neighborProminence = 1 + this.neighborBoost * NEIGHBOR_PROMINENCE_SCALE;
    marker.glow.material.opacity = Math.min(1, marker.baseGlowOpacity * markerPulse * this.destinationBoost * neighborProminence);
    marker.light.intensity = marker.baseLightIntensity * markerPulse * this.destinationBoost * neighborProminence;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  /** Cinematic Motion Refinement Phase, Commit 4: scene-blend.js's corridor
   *  loop calls this every tick for every region that defines it -- a
   *  no-op hook for every other chapter, which simply doesn't implement
   *  it. `t` is 0-1 how far into the transition corridor the scroll
   *  position is; `neighborId`/`direction` identify the adjacent chapter
   *  and whether it's about to appear ('entering') or be left behind
   *  ('leaving'). Only two pairings are meaningful here -- entering from
   *  `ground` (the shipment's own departure point) eases the destination
   *  marker's prominence up a little ahead of the actual shot cut, so the
   *  onward journey reads as already underway rather than popping in;
   *  leaving toward `final-mile` eases a smaller settle cue as arrival
   *  approaches. Every other call (including the explicit reset scene-
   *  blend sends once this chapter is neither current nor adjacent)
   *  simply targets 0. */
  setNeighborInfluence(t, neighborId, direction) {
    if (direction === 'entering' && neighborId === 'ground') {
      this.neighborBoostTarget = t;
    } else if (direction === 'leaving' && neighborId === 'final-mile') {
      this.neighborBoostTarget = t * 0.6;
    } else {
      this.neighborBoostTarget = 0;
    }
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
