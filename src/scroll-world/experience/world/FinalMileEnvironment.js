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
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR } from '../utils/damp.js';

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

function createHouse(x, z, scale) {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: HOUSE_COLOR, roughness: 0.65, metalness: 0.2 });
  const roofMaterial = new MeshStandardMaterial({ color: 0x060814, roughness: 0.7, metalness: 0.15 });
  const windowMaterial = new MeshBasicMaterial({ color: WINDOW_COLOR, transparent: true, opacity: 0.55 });

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
  positions.forEach(([x, z, scale]) => group.add(createHouse(x, z, scale)));
  return group;
}

function createVehicle() {
  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: VEHICLE_COLOR, roughness: 0.4, metalness: 0.4 });
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

    // Moderate haze, softer and calmer than Ground (Section 23).
    this.particles = createParticles({
      count: 90,
      spreadX: 12,
      spreadZ: STREET_LENGTH,
      height: 5,
      offsetZ: REGION_Z,
      opacity: 0.25,
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

    this.scene.add(this.group);
  }

  update(time) {
    this.activityWeight += (this.targetActivityWeight - this.activityWeight) * dampFactor(ACTIVITY_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight;
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;
    this.particles.material.opacity = this.baseParticleOpacity * this.activityWeight;

    updateParticles(this.particles, time.delta / 1000);

    // A slow, calm pulse -- the routing indicator, not a busier motif.
    const pulse = 0.6 + 0.4 * Math.sin(time.elapsed / 2600);
    this.indicator.scale.setScalar(0.85 + pulse * 0.3);

    const linePulse = 0.8 + 0.2 * Math.sin(time.elapsed / 3200);
    this.routeLine.material.opacity = this.routeLine.material.userData.baseOpacity * linePulse;
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }
}
