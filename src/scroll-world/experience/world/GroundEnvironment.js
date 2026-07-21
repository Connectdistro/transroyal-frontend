import { Group } from 'three';
import { createLights } from './createLights.js';
import { dampFactor, ACTIVITY_HALF_LIFE_MS, DEFAULT_ACTIVITY_FLOOR, LIGHT_TINT_HALF_LIFE_MS } from '../utils/damp.js';
import { LIGHT_TINTS } from '../camera/shots.js';

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
const ELECTRIC_500 = 0x2f8bff;
const ROYAL_600 = 0x2540b0;

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
  }

  setActivity(state) {
    this.targetActivityWeight = state === 'active' || state === 'entering' ? 1 : this.activityFloor;
  }

  setLightTint(key, fill) {
    this.targetKeyColor.set(key);
    this.targetFillColor.set(fill);
  }
}
