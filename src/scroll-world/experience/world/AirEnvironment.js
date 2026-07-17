import {
  BoxGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { createLights } from './createLights.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR } from '../utils/damp.js';

const LANDMASS_COLOR = 0x070b28;
const BLOCK_COLOR = 0x0a1030;
const CLOUD_COLOR = 0xeef2ff;
// Air's own accent from config.js.
const ELECTRIC_400 = 0x4fa3ff;
const ROYAL_600 = 0x2540b0;

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

    this.scene.add(this.group);
  }

  update(time) {
    this.activityWeight += (this.targetActivityWeight - this.activityWeight) * dampFactor(ACTIVITY_HALF_LIFE_MS, time.delta);
    this.keyLight.intensity = this.baseKeyIntensity * this.activityWeight;
    this.fillLight.intensity = this.baseFillIntensity * this.activityWeight;

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
}
