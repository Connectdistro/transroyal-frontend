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

const STREET_COLOR = 0x070a26;
const HOUSE_COLOR = 0x0a1030;
const VEHICLE_COLOR = 0x0d1440;
const RUBBER_COLOR = 0x05070f;
const WINDOW_COLOR = 0xeef2ff;
// Final Mile's own accent from config.js (royal-blue-leaning, matching Sorting).
const ROYAL_500 = 0x3654d6;
const ROYAL_600 = 0x2540b0;
const ELECTRIC_400 = 0x4fa3ff;
const SKIN_TONE = 0xc48a6a;

// Well past Air's landmass footprint (which extends to roughly z = -630).
const REGION_Z = -700;
const STREET_LENGTH = 46;

// Choreography Refinement Pass: a small, distant echo of Air's own
// aircraft, positioned along this chapter's own `final-mile` sightline
// (camera/shots.js: position {x:-14,y:3.2,z:-673} -> target {x:7,y:1.3,
// z:-705}) -- not the literal Air aircraft/geometry (sibling environment
// files stay independent, the same convention AirEnvironment.js's own
// CARGO_POD_COLOR comment already establishes for Ground), just a small
// silhouette in the same flat-color/box vocabulary, echoing Air's own
// fuselage/cargo-pod/beacon colors so the two read as "the same shipment,
// still descending" without importing anything. Deliberately simple and
// small -- a background beat glimpsed during the Air->FinalMile transition
// corridor (setNeighborInfluence below), not a second hero object; the
// delivery van stays this chapter's own subject.
const DISTANT_AIRCRAFT_FUSELAGE_COLOR = 0xd4dbe8; // matches AirEnvironment's FUSELAGE_COLOR
const DISTANT_AIRCRAFT_CARGO_COLOR = 0x2f5fae; // matches AirEnvironment's CARGO_POD_COLOR
const DISTANT_AIRCRAFT_BEACON_COLOR = 0xff3b30; // matches AirEnvironment's BEACON_COLOR
const DISTANT_AIRCRAFT_BEACON_BLINK_PERIOD_MS = 900; // matches AirEnvironment's own period exactly -- reads as the same beacon, not a different one
const DISTANT_AIRCRAFT_BEACON_INTENSITY = 1.1;
const DISTANT_AIRCRAFT_POSITION = { x: 35, y: 16, z: -748 };
const NEIGHBOR_BOOST_HALF_LIFE_MS = 500; // matches AirEnvironment's own half-life

function createStreet() {
  const group = new Group();
  const asphalt = new Mesh(
    new BoxGeometry(14, 0.3, STREET_LENGTH),
    new MeshPhysicalMaterial({ color: STREET_COLOR, metalness: 0.1, roughness: 0.85, clearcoat: 0 })
  );
  asphalt.position.set(0, -0.15, REGION_Z);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const curb = new Mesh(
    new BoxGeometry(2, 0.25, STREET_LENGTH),
    new MeshStandardMaterial({ color: HOUSE_COLOR, roughness: 0.7, metalness: 0.1 })
  );
  curb.position.set(-8, -0.05, REGION_Z);
  group.add(curb);

  return group;
}

function createHouse(x, z, scale, seed = 0) {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: HOUSE_COLOR, roughness: 0.65, metalness: 0.2 });
  const roofMaterial = new MeshStandardMaterial({ color: 0x060814, roughness: 0.7, metalness: 0.15 });
  const windowMaterial = new MeshBasicMaterial({ color: WINDOW_COLOR, transparent: true, opacity: 0.55 });
  // Choreography Refinement Pass: each house already gets its own fresh
  // material instances (declared inside this per-call function, never
  // shared across the five createHouses() calls) -- varyMaterial() just
  // needed to actually be applied to them, closing the one gap in this
  // chapter's own material-variation coverage.
  varyMaterial(bodyMaterial, 900 + seed);
  varyMaterial(roofMaterial, 920 + seed);

  const body = new Mesh(new BoxGeometry(4.5 * scale, 4 * scale, 5 * scale), bodyMaterial);
  body.position.y = 2 * scale;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new Mesh(new CylinderGeometry(0, 3.6 * scale, 1.8 * scale, 4), roofMaterial);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4 * scale + 0.9 * scale;
  roof.castShadow = true;
  group.add(roof);

  [-1.2, 1.2].forEach((wx) => {
    const window = new Mesh(new BoxGeometry(0.9 * scale, 1 * scale, 0.05), windowMaterial);
    window.position.set(wx * scale, 2.1 * scale, 2.51 * scale);
    group.add(window);
  });

  group.position.set(x, 0, z);
  return group;
}

function createHouses() {
  const group = new Group();
  // Nearest house kept well clear of the camera (Section 23 shot sits at
  // roughly z = REGION_Z + 27) -- an earlier pass placed one only ~13 units
  // from camera, looming into most of the frame.
  const positions = [
    [-13, REGION_Z - 6, 1.1],
    [-13, REGION_Z - 24, 0.9],
    [-13, REGION_Z - 40, 1],
    [13, REGION_Z - 14, 1],
    [13, REGION_Z - 32, 0.95],
  ];
  positions.forEach(([x, z, scale], i) => group.add(createHouse(x, z, scale, i)));
  return group;
}

function createVehicle() {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: VEHICLE_COLOR, roughness: 0.4, metalness: 0.4 });
  varyMaterial(bodyMaterial, 940);
  const rubberMaterial = new MeshStandardMaterial({ color: RUBBER_COLOR, roughness: 0.9, metalness: 0.1 });
  const lightMaterial = new MeshBasicMaterial({ color: ELECTRIC_400 });

  const body = new Mesh(new BoxGeometry(2.6, 2.3, 5), bodyMaterial);
  body.position.set(0, 1.25, 0);
  body.castShadow = true;
  group.add(body);

  const wheelGeometry = new CylinderGeometry(0.48, 0.48, 0.35, 14);
  [-1.7, 1.7].forEach((z) => {
    [-1.4, 1.4].forEach((x) => {
      const wheel = new Mesh(wheelGeometry, rubberMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.48, z);
      group.add(wheel);
    });
  });

  [-1.2, 1.2].forEach((x) => {
    const tail = new Mesh(new BoxGeometry(0.15, 0.2, 0.05), lightMaterial);
    tail.position.set(x, 1.6, -2.55);
    group.add(tail);
  });

  group.position.set(4, 0, REGION_Z - 6);
  group.rotation.y = -0.2;
  return group;
}

function createFigure() {
  const group = new Group();
  const clothingMaterial = new MeshStandardMaterial({ color: 0x141a3a, roughness: 0.7, metalness: 0.1 });
  const skinMaterial = new MeshStandardMaterial({ color: SKIN_TONE, roughness: 0.6, metalness: 0 });
  varyMaterial(clothingMaterial, 941);
  varyMaterial(skinMaterial, 942);

  const body = new Mesh(new CapsuleGeometry(0.26, 1, 4, 8), clothingMaterial);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  const head = new Mesh(new SphereGeometry(0.15, 16, 16), skinMaterial);
  head.position.y = 1.65;
  group.add(head);

  group.position.set(2, 0, REGION_Z - 9);
  return group;
}

/** The live routing indicator (Section 23) -- the one practical light in this
 *  chapter, calmer and slower than any pulse since Origin (Section 23:
 *  "deliberately less motion than any chapter since Origin"). */
function createRoutingIndicator() {
  const group = new Group();
  const glow = new Mesh(new SphereGeometry(0.09, 12, 12), new MeshBasicMaterial({ color: WINDOW_COLOR }));
  group.add(glow);
  group.position.set(4, 1.5, REGION_Z - 6.5);

  const light = new PointLight(WINDOW_COLOR, 2, 3.5, 2);
  light.position.copy(group.position);

  return { group, light };
}

function createRouteLine() {
  // The continental light trail narrows, chapter by chapter, down to a
  // single final-mile route (Section 23's transition spec).
  const curve = new CatmullRomCurve3([
    new Vector3(6, 0.4, REGION_Z + 60),
    new Vector3(5, 0.1, REGION_Z + 20),
    new Vector3(4.5, 0.05, REGION_Z - 6),
  ]);
  const material = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.7 });
  material.userData.baseOpacity = material.opacity;
  return new Mesh(new TubeGeometry(curve, 80, 0.045, 8, false), material);
}

/** See DISTANT_AIRCRAFT_* constants above for the full rationale. Built at
 *  a small scale (a real aircraft, but read as distant/backgrounded) --
 *  scale-eased in/out via setNeighborInfluence() below, the same "target
 *  scale, damped ease" reveal idiom the pallet stack and forklift cargo
 *  box already use elsewhere in this codebase, rather than an opacity
 *  fade (its materials are plain opaque MeshStandardMaterial, matching
 *  every other solid prop in this file). */
function createDistantAircraft() {
  const group = new Group();

  const fuselageMaterial = new MeshStandardMaterial({ color: DISTANT_AIRCRAFT_FUSELAGE_COLOR, roughness: 0.35, metalness: 0.45 });
  const fuselage = new Mesh(new BoxGeometry(0.6, 0.6, 3.2), fuselageMaterial);
  group.add(fuselage);

  const wingMaterial = new MeshStandardMaterial({ color: 0x14181f, roughness: 0.45, metalness: 0.4 });
  const wings = new Mesh(new BoxGeometry(4.8, 0.1, 0.7), wingMaterial);
  wings.position.y = -0.05;
  group.add(wings);

  const cargoPod = new Mesh(
    new BoxGeometry(0.45, 0.3, 1.2),
    new MeshStandardMaterial({ color: DISTANT_AIRCRAFT_CARGO_COLOR, roughness: 0.5, metalness: 0.3 })
  );
  cargoPod.position.y = -0.42;
  group.add(cargoPod);

  const beacon = new Mesh(new SphereGeometry(0.05, 8, 8), new MeshBasicMaterial({ color: DISTANT_AIRCRAFT_BEACON_COLOR }));
  beacon.position.y = 0.35;
  const beaconLight = new PointLight(DISTANT_AIRCRAFT_BEACON_COLOR, 0, 3, 2);
  beaconLight.position.copy(beacon.position);
  group.add(beacon, beaconLight);

  group.position.set(DISTANT_AIRCRAFT_POSITION.x, DISTANT_AIRCRAFT_POSITION.y, DISTANT_AIRCRAFT_POSITION.z);
  // A believable descent attitude -- nose down, banked -- rather than
  // level cruise, since the narrative beat is "still descending."
  group.rotation.x = 0.25;
  group.rotation.y = Math.PI * 0.15;
  group.scale.setScalar(0);

  return { group, beaconLight };
}

/**
 * Urban Distribution / Final Mile (Production Handbook Section 23, Scene 06)
 * -- closes the human-scale loop opened at Pickup. Own region of the
 * continuous scene graph (Section 9: `REGION_Z`), past Air's landmass
 * footprint. Framing belongs to the Production Camera's `final-mile` shot
 * (camera/shots.js) -- this class carries no camera state.
 */
export class FinalMileEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();
    this.routeLine = createRouteLine();
    this.group.add(createStreet(), createHouses(), createVehicle(), createFigure(), this.routeLine);

    const { group: indicatorGroup, light: indicatorLight } = createRoutingIndicator();
    this.indicator = indicatorGroup;
    this.group.add(indicatorGroup, indicatorLight);

    const { group: distantAircraftGroup, beaconLight: distantAircraftBeaconLight } = createDistantAircraft();
    this.distantAircraft = distantAircraftGroup;
    this.distantAircraftBeaconLight = distantAircraftBeaconLight;
    this.group.add(distantAircraftGroup);
    this.neighborBoost = 0;
    this.neighborBoostTarget = 0;

    // Moderate haze, softer and calmer than Ground (Section 23).
    this.particles = createParticles({
      count: 90,
      spreadX: 12,
      spreadZ: STREET_LENGTH,
      height: 5,
      offsetZ: REGION_Z,
      opacity: 0.25,
      // Cinematic Motion Refinement Phase, Commit 5: a smaller turbulence
      // amplitude than Pickup/Sorting's -- this chapter's own documented
      // calm ("deliberately less motion than any chapter since Origin")
      // is preserved, this is atmosphere only, not new vehicle/figure
      // motion.
      turbulence: 0.12,
    });
    this.group.add(this.particles);

    // Section 23: "Key light in royal-blue-leaning accent, fill in the
    // constant royal blue."
    const { key, fill } = createLights({
      keyColor: ROYAL_500,
      keyIntensity: 2.6,
      keyPosition: [10, 13, REGION_Z + 12],
      fillColor: ROYAL_600,
      fillIntensity: 1.1,
      fillPosition: [-11, 7, REGION_Z - 10],
      keyTarget: [3, 1.2, REGION_Z - 6],
    });
    this.keyLight = key;
    this.fillLight = fill;
    this.group.add(key, key.target, fill, fill.target);

    // Cinematic Integration Phase, Commit 1: see OriginEnvironment.js.
    this.id = 'final-mile';
    this.baseKeyIntensity = this.keyLight.intensity;
    this.baseFillIntensity = this.fillLight.intensity;
    this.baseParticleOpacity = this.particles.material.opacity;
    this.activityWeight = 1;
    this.targetActivityWeight = 1;
    this.activityFloor = DEFAULT_ACTIVITY_FLOOR;

    // Cinematic Polish Phase, Commit 1: see OriginEnvironment.js.
    const tint = LIGHT_TINTS['final-mile'];
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

    // A slow, calm pulse -- the routing indicator, not a busier motif.
    const pulse = 0.6 + 0.4 * Math.sin(time.elapsed / 2600);
    this.indicator.scale.setScalar(0.85 + pulse * 0.3);

    const linePulse = 0.8 + 0.2 * Math.sin(time.elapsed / 3200);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * linePulse;

    // Choreography Refinement Pass: eases toward whatever
    // setNeighborInfluence() last targeted (called every tick by
    // scene-blend.js's corridor loop for every region that defines it,
    // including an explicit 0 reset once this chapter is neither current
    // nor adjacent -- see that method's own doc, and AirEnvironment.js's
    // matching implementation).
    this.neighborBoost += (this.neighborBoostTarget - this.neighborBoost) * dampFactor(NEIGHBOR_BOOST_HALF_LIFE_MS, time.delta);
    this.distantAircraft.scale.setScalar(this.neighborBoost);
    const beaconBlink = Math.sin((time.elapsed / DISTANT_AIRCRAFT_BEACON_BLINK_PERIOD_MS) * Math.PI * 2) > 0.5 ? 1 : 0;
    this.distantAircraftBeaconLight.intensity = DISTANT_AIRCRAFT_BEACON_INTENSITY * beaconBlink * this.neighborBoost * this.activityWeight;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  /** scene-blend.js's corridor loop calls this every tick for every region
   *  that defines it -- see AirEnvironment.js's own setNeighborInfluence()
   *  for the full mechanism doc. The only meaningful pairing here: entering
   *  from `air` (the shipment's own final leg) eases the distant-aircraft
   *  echo above into view as the delivery van becomes this chapter's own
   *  hero, so the handoff reads as one continuous descent rather than the
   *  aircraft simply vanishing. Every other call, including the explicit
   *  reset scene-blend sends once this chapter is neither current nor
   *  adjacent, targets 0. */
  setNeighborInfluence(t, neighborId, direction) {
    this.neighborBoostTarget = direction === 'entering' && neighborId === 'air' ? t : 0;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
