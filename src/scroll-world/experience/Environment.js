import { Color, EquirectangularReflectionMapping, FogExp2, SRGBColorSpace } from 'three';
import { createBackgroundGradient } from './environment/background.js';
import { dampFactor } from './utils/damp.js';

const ROYAL_600 = '#2540b0';
// Tuned to Origin's own spec (Section 23: "the lightest haze in the entire
// journey... maximum clarity") -- the shared default, adjustable at runtime
// via setFogDensity() once later chapters need a heavier reading.
const DEFAULT_FOG_DENSITY = 0.012;

// Cinematic Integration Phase, Commit 1: how quickly fog blends toward a new
// color/density (see update() below) -- tuned to match world.css's M2A
// scene-transition system (~700ms), so fog and the DOM's own CSS fades read
// as one coordinated transition rather than two independently-timed ones.
const FOG_HALF_LIFE_MS = 400;

/** Manifest id for the world's single shared HDR (Production Handbook
 *  Section 8: every location shares one material/lighting language). Not a
 *  scene id -- Environment always asks Resources for this one id; adding
 *  the production HDR is a manifest-only change, no code change here. */
const WORLD_HDR_ID = 'world-environment';

/**
 * Global visual language shared by the entire logistics world (Production
 * Handbook Section 10/12): background, environment map, and fog. Every scene
 * inherits this automatically -- Environment carries no scene-specific
 * state and no geometry, camera, or animation logic.
 */
export class Environment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene.instance;
    this.resources = experience.resources;

    this.setBackground();
    this.setFog();
    this.setEnvironmentMap();
  }

  setBackground() {
    this.backgroundTexture = createBackgroundGradient();
    this.scene.background = this.backgroundTexture;
  }

  setFog(color = ROYAL_600, density = DEFAULT_FOG_DENSITY) {
    this.fog = new FogExp2(color, density);
    this.scene.fog = this.fog;
    // Blend targets -- see update(). Initialized to match the live values
    // above so the very first frame has target === live (no blend-in from
    // black on load).
    this.targetFogColor = new Color(color);
    this.targetFogDensity = density;
  }

  /** Sets the *target* fog color -- update() eases the live fog toward it
   *  every frame rather than snapping. Signature unchanged from before the
   *  Cinematic Integration Phase; camera-sync.js calls this exactly as it
   *  always has. */
  setFogColor(color) {
    if (this.targetFogColor) this.targetFogColor.set(color);
  }

  /** Sets the *target* fog density -- same easing treatment as
   *  setFogColor() above. */
  setFogDensity(density) {
    this.targetFogDensity = density;
  }

  /** Restores the shared default fog (color and density both) -- called by
   *  camera-sync.js whenever the active chapter has no fog override of its
   *  own, so leaving a chapter that did override it always returns to the
   *  look every other chapter shares. Still routes through the two setters
   *  above, so the return trip blends just like any other fog change. */
  resetFog() {
    this.setFogColor(ROYAL_600);
    this.setFogDensity(DEFAULT_FOG_DENSITY);
  }

  /** Eases the live fog toward its target color/density (Cinematic
   *  Integration Phase, Commit 1) -- called once per frame from
   *  World.update(). Mutates `this.fog.color` in place via Color.lerp()
   *  (no per-frame allocation), matching the project's low-allocation
   *  easing convention used everywhere else in this phase. */
  update(time) {
    if (!this.fog) return;
    const t = dampFactor(FOG_HALF_LIFE_MS, time.delta);
    this.fog.color.lerp(this.targetFogColor, t);
    this.fog.density += (this.targetFogDensity - this.fog.density) * t;
  }

  /** Resolves once Resources has either loaded the world HDR or confirmed no
   *  such manifest entry exists yet -- the graceful fallback is `scene.environment`
   *  simply staying unset. */
  async setEnvironmentMap(id = WORLD_HDR_ID) {
    if (!this.resources.find(id)) return;

    const texture = await this.resources.load(id);
    if (!texture) return;

    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    this.scene.environment = texture;
  }
}
