import { EquirectangularReflectionMapping, FogExp2, SRGBColorSpace } from 'three';
import { createBackgroundGradient } from './environment/background.js';

const ROYAL_600 = '#2540b0';
// Tuned to Origin's own spec (Section 23: "the lightest haze in the entire
// journey... maximum clarity") -- the shared default, adjustable at runtime
// via setFogDensity() once later chapters need a heavier reading.
const DEFAULT_FOG_DENSITY = 0.012;

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
  }

  setFogDensity(density) {
    if (this.fog) this.fog.density = density;
  }

  setFogColor(color) {
    if (this.fog) this.fog.color.set(color);
  }

  /** Restores the shared default fog (color and density both) -- called by
   *  camera-sync.js whenever the active chapter has no fog override of its
   *  own, so leaving a chapter that did override it always returns to the
   *  look every other chapter shares. */
  resetFog() {
    this.setFogColor(ROYAL_600);
    this.setFogDensity(DEFAULT_FOG_DENSITY);
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
