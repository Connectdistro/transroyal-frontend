import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
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

// Well past Ground's own region -- height (not distance) is what protects
// this chapter from the others, since the camera sits far above every
// ground-level region regardless of z (Section 23: "true aerial altitude").
const REGION_Z = -460;

const TRAIL_COUNT = 5;
const PULSE_PERIOD = 5000;

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
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight;
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;

    const tintT = dampFactor(LIGHT_TINT_HALF_LIFE_MS, time.delta);
    this.keyLight.color.lerp(this.targetKeyColor, tintT);
    this.fillLight.color.lerp(this.targetFillColor, tintT);

    // Level-cruise light-trail motion and a near-imperceptible cloud drift
    // (Section 23) -- both far calmer than any ground-level chapter's motion.
    this.clouds.children.forEach((cloud, i) => {
      cloud.position.x += Math.sin(time.elapsed / 9000 + i) * 0.002;
    });

    const pulse = 0.85 + 0.15 * Math.sin(time.elapsed / PULSE_PERIOD);
    this.lightTrails.userData.lines.forEach((line) => {
      line.material.opacity = line.material.userData.baseOpacity * pulse;
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
