import {
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

const LANDMASS_COLOR = 0x070b28;
const BLOCK_COLOR = 0x0a1030;
const CLOUD_COLOR = 0xeef2ff;
// Air's own accent from config.js.
const ELECTRIC_400 = 0x4fa3ff;
const ROYAL_600 = 0x2540b0;
// Fuselage reads light/reflective -- distinct from every ground vehicle's
// dark navy palette, so it can visibly "catch" the key light (Commit 4).
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

// Loop behavior (Commit 4): a brief held arrival at the destination marker's
// brightest, then an eased rewind back to 0 -- the same
// dwell-then-transition idiom as Ground's dock cycle phases, just simpler
// (one continuous journey, no multi-actor choreography). The rewind is
// deliberately much faster than the forward flight so it reads as a
// distinct "reset" beat rather than a naturalistic reverse flight.
const FLIGHT_HOLD_DURATION_MS = 1800;
const FLIGHT_RESET_HALF_LIFE_MS = 450;
const FLIGHT_RESET_SNAP_THRESHOLD = 0.01;

// "Sunlight catching the fuselage" on approach (Commit 4): a small extra
// multiplier on the key light only, ramping up over the flight's final
// quarter -- same activityWeight-multiplication pattern already used
// everywhere, layered with its own eased target so it never jumps.
const FLIGHT_SUNLIGHT_START = 0.75;
const FLIGHT_SUNLIGHT_BOOST = 1.35;
const FLIGHT_SUNLIGHT_HALF_LIFE_MS = 1200;

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

  const tailVertical = new Mesh(new BoxGeometry(0.3, 3, 2.4), wingMaterial);
  tailVertical.position.set(0, 2.3, 7.2);
  const tailHorizontal = new Mesh(new BoxGeometry(7.5, 0.3, 1.8), wingMaterial);
  tailHorizontal.position.set(0, 1.1, 7.2);
  group.add(tailVertical, tailHorizontal);

  const engineGeometry = new CylinderGeometry(0.6, 0.6, 2.6, 10);
  [-6, 6].forEach((x) => {
    const engine = new Mesh(engineGeometry, wingMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -1, 0.6);
    group.add(engine);
  });

  const cargoPodMaterial = new MeshStandardMaterial({ color: CARGO_POD_COLOR, roughness: 0.5, metalness: 0.3 });
  varyMaterial(cargoPodMaterial, 701);
  const cargoPod = new Mesh(new BoxGeometry(2.2, 1.5, 6), cargoPodMaterial);
  cargoPod.position.set(0, -2.1, -1);
  group.add(cargoPod);

  group.userData.wings = wings;
  // Real cruising-altitude framing dwarfs a literal-scale fuselage against
  // the 340-unit landmass -- scaled up so the aircraft reads as the frame's
  // hero object (Section: camera stays put, "aircraft remains the hero"),
  // verified against the actual `air` shot rather than guessed.
  group.scale.setScalar(2);
  return group;
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
    this.flightState = 'flying';
    this.flightHoldTimer = 0;
    this.flightSunlightBoost = 1;
    this.destinationBoost = 1;

    // Section 23: key electric blue, fill constant royal blue, "both read at
    // greater distance and softer falloff than any other chapter."
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

    const pulse = 0.85 + 0.15 * Math.sin(time.elapsed / PULSE_PERIOD);
    this.lightTrails.userData.lines.forEach((line) => {
      line.material.opacity = line.material.userData.baseOpacity * pulse;
    });

    // Commit 3/4: eased speed chases a target that tapers near both curve
    // ends (accelerate off P0, cruise, decelerate into approach) while
    // 'flying'; on reaching the destination it holds briefly (the
    // destination marker's brightest beat), then eases back to 0 and
    // resumes -- everything downstream (thread reveal, destination ramp)
    // already reads flightProgress and needs no separate reset.
    const deltaSeconds = time.delta / 1000;
    if (this.flightState === 'flying') {
      const taperToEnd = Math.max(FLIGHT_MIN_TAPER, Math.min(1, (1 - this.flightProgress) / FLIGHT_TAPER_DISTANCE));
      const taperFromStart = Math.max(FLIGHT_MIN_TAPER, Math.min(1, this.flightProgress / FLIGHT_TAPER_DISTANCE));
      const desiredSpeed = FLIGHT_CRUISE_SPEED * Math.min(taperToEnd, taperFromStart);
      this.flightSpeed += (desiredSpeed - this.flightSpeed) * dampFactor(FLIGHT_VELOCITY_HALF_LIFE_MS, time.delta);
      this.flightProgress += this.flightSpeed * deltaSeconds;
      if (this.flightProgress >= 1) {
        this.flightProgress = 1;
        this.flightState = 'holding';
        this.flightHoldTimer = 0;
      }
    } else if (this.flightState === 'holding') {
      this.flightSpeed = 0;
      this.flightHoldTimer += time.delta;
      if (this.flightHoldTimer >= FLIGHT_HOLD_DURATION_MS) {
        this.flightState = 'resetting';
      }
    } else {
      // 'resetting'
      this.flightSpeed = 0;
      this.flightProgress -= this.flightProgress * dampFactor(FLIGHT_RESET_HALF_LIFE_MS, time.delta);
      if (this.flightProgress <= FLIGHT_RESET_SNAP_THRESHOLD) {
        this.flightProgress = 0;
        this.flightState = 'flying';
      }
    }

    const sunlightTarget =
      this.flightProgress > FLIGHT_SUNLIGHT_START
        ? 1 + ((this.flightProgress - FLIGHT_SUNLIGHT_START) / (1 - FLIGHT_SUNLIGHT_START)) * (FLIGHT_SUNLIGHT_BOOST - 1)
        : 1;
    this.flightSunlightBoost +=
      (sunlightTarget - this.flightSunlightBoost) * dampFactor(FLIGHT_SUNLIGHT_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight * this.flightSunlightBoost;

    // Position and orientation, sampled fresh from the curve every frame --
    // smooth by construction (no snapping), constant forward orientation,
    // and arc-length parameterized so motion speed reads evenly along the
    // visually curved path rather than just parametrically.
    this.flightPath.getPointAt(this.flightProgress, scratchPosition);
    this.aircraft.position.copy(scratchPosition);
    this.flightPath.getTangentAt(Math.min(1, this.flightProgress + FLIGHT_LOOK_AHEAD), scratchLookAt);
    scratchLookAt.add(scratchPosition);
    this.aircraft.lookAt(scratchLookAt);

    // Banking: compare the tangent at the current progress against a small
    // step ahead, project the heading change onto the aircraft's own local
    // right vector (post-lookAt), scale and clamp -- a cheap, standard
    // banked-turn approximation layered on top via a local-space roll.
    this.flightPath.getTangentAt(this.flightProgress, scratchTangentNow);
    this.flightPath.getTangentAt(Math.min(1, this.flightProgress + FLIGHT_BANK_LOOK_AHEAD), scratchTangentAhead);
    scratchHeadingDelta.copy(scratchTangentAhead).sub(scratchTangentNow);
    scratchRight.set(1, 0, 0).applyQuaternion(this.aircraft.quaternion);
    const bankSignal = scratchHeadingDelta.dot(scratchRight) * FLIGHT_BANK_GAIN;
    const bankAngle = Math.max(-FLIGHT_MAX_BANK, Math.min(FLIGHT_MAX_BANK, bankSignal));
    this.aircraft.rotateZ(-bankAngle);

    // Lightweight atmosphere: sub-degree wingtip flex and pitch/roll jitter
    // read as engine vibration, recomputed fresh each frame on top of the
    // curve-driven base orientation above (never accumulated frame to
    // frame, so there's no drift).
    const wings = this.aircraft.userData.wings;
    if (wings) wings.rotation.z = Math.sin(time.elapsed / 260) * 0.01;
    this.aircraft.rotateX(Math.sin(time.elapsed / 340 + 2) * 0.0015);
    this.aircraft.rotateZ(Math.sin(time.elapsed / 410 + 4) * 0.001);

    const revealIndices = Math.floor(
      (this.deliveryThread.indexCount * this.flightProgress) / THREAD_INDICES_PER_RING
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

    const markerPulse = 0.85 + 0.15 * Math.sin(time.elapsed / PULSE_PERIOD + 1.7);
    const marker = this.destinationMarker;
    marker.glow.material.opacity = Math.min(1, marker.baseGlowOpacity * markerPulse * this.destinationBoost);
    marker.light.intensity = marker.baseLightIntensity * markerPulse * this.destinationBoost;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
