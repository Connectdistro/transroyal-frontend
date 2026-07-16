import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PointLight, SphereGeometry } from 'three';
import { createLights } from './createLights.js';

const STEP_COLOR = 0x080d33;
const FACADE_COLOR = 0x0a1030;
const DOOR_COLOR = 0x060814;
const PARCEL_COLOR = 0x141a3a;
const PARCEL_LABEL_COLOR = 0xeef2ff;
const PORCH_LIGHT_COLOR = 0xeef2ff;
// Delivered's own accent from config.js -- the same family as Origin,
// closing the loop (Section 23).
const ELECTRIC_500 = 0x2f8bff;
const ROYAL_600 = 0x2540b0;

// Past Final Mile's furthest house (which sits around z = -740).
const REGION_Z = -800;

function createDoorstep() {
  const group = new Group();

  const step = new Mesh(
    new BoxGeometry(6, 0.3, 5),
    new MeshPhysicalMaterial({ color: STEP_COLOR, metalness: 0.1, roughness: 0.7, clearcoat: 0 })
  );
  step.position.set(4, -0.15, REGION_Z - 6);
  step.receiveShadow = true;
  group.add(step);

  const facade = new Mesh(
    new BoxGeometry(7, 5, 0.6),
    new MeshStandardMaterial({ color: FACADE_COLOR, roughness: 0.6, metalness: 0.25 })
  );
  facade.position.set(4, 2.5, REGION_Z - 8.5);
  facade.castShadow = true;
  facade.receiveShadow = true;
  group.add(facade);

  const door = new Mesh(
    new BoxGeometry(1.8, 3.2, 0.15),
    new MeshStandardMaterial({ color: DOOR_COLOR, roughness: 0.5, metalness: 0.3 })
  );
  door.position.set(4, 1.7, REGION_Z - 8.15);
  group.add(door);

  return group;
}

/** The sole sharp subject in frame (Section 23) -- everything else in this
 *  chapter stays calm and minimal around it. */
function createParcel() {
  const group = new Group();

  const box = new Mesh(
    new BoxGeometry(0.9, 0.7, 0.7),
    new MeshStandardMaterial({ color: PARCEL_COLOR, roughness: 0.55, metalness: 0.1 })
  );
  box.position.set(0, 0.35, 0);
  box.castShadow = true;
  group.add(box);

  const label = new Mesh(
    new BoxGeometry(0.5, 0.3, 0.02),
    new MeshBasicMaterial({ color: PARCEL_LABEL_COLOR, transparent: true, opacity: 0.5 })
  );
  label.position.set(0, 0.4, 0.36);
  group.add(label);

  group.position.set(3.2, 0, REGION_Z - 5.2);
  return group;
}

/** A single steady practical -- no pulse, no animation. Section 23: "None.
 *  ...This is the one chapter in the entire journey where motion fully
 *  stops." */
function createPorchLight() {
  const glow = new Mesh(new SphereGeometry(0.08, 12, 12), new MeshBasicMaterial({ color: PORCH_LIGHT_COLOR }));
  glow.position.set(5.3, 3.6, REGION_Z - 8.2);

  const light = new PointLight(PORCH_LIGHT_COLOR, 1.6, 4, 2);
  light.position.copy(glow.position);

  return { glow, light };
}

/**
 * The Customer Destination / Delivered (Production Handbook Section 23,
 * Scene 07) -- the story's resolution, all tension released. The calmest,
 * least populated environment in the world, and the one chapter where
 * motion fully stops: no particles, no route line, no pulse. Own region of
 * the continuous scene graph (Section 9: `REGION_Z`), past Final Mile's
 * geometry. Framing belongs to the Production Camera's `delivered` shot
 * (camera/shots.js), held perfectly static -- this class carries no camera
 * state and drives no animation of its own.
 */
export class DeliveredEnvironment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;

    this.group = new Group();
    this.group.add(createDoorstep(), createParcel());

    const { glow: porchGlow, light: porchLight } = createPorchLight();
    this.group.add(porchGlow, porchLight);

    // Section 23: "Key light in electric blue, fill in the constant royal
    // blue -- the same accent family as Origin, closing the loop." The
    // lightest haze in the journey alongside Origin -- softer, lower-
    // intensity lights than any populated chapter, matching this scene's
    // resolved calm.
    const { key, fill } = createLights({
      keyColor: ELECTRIC_500,
      keyIntensity: 2.2,
      keyPosition: [11, 10, REGION_Z + 4],
      fillColor: ROYAL_600,
      fillIntensity: 1,
      fillPosition: [-8, 6, REGION_Z - 14],
      keyTarget: [4, 1.5, REGION_Z - 6],
    });
    this.keyLight = key;
    this.fillLight = fill;
    this.group.add(key, key.target, fill, fill.target);

    this.scene.add(this.group);
  }

  // Deliberately a no-op: this is the one chapter in the entire journey
  // where motion fully stops (Section 23). World.js calls update() on every
  // region uniformly, so this method exists to satisfy that shape without
  // animating anything.
  update() {}
}
