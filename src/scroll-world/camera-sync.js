import { SHOTS } from './experience/camera/shots.js';

// Cinematic Polish Phase, Commit 1: fallback when a shot omits its own
// `environmentIntensity` -- mirrors the fog block's own `?? default`
// shape below.
const DEFAULT_ENVIRONMENT_INTENSITY = 1;

/**
 * The minimal Scroll Engine entry point (Production Handbook Section 16) --
 * maps a scene's lifecycle state (scene-state.js) onto the Production
 * Camera's shot list (experience/camera/shots.js). Whichever
 * `[data-scene-id]` section becomes "active" gets its matching shot eased
 * into via `camera.setShot(sceneId, { instant: false })`; CameraRig.setShot()
 * already no-ops for any scene id without a shot yet defined, so this stays
 * correct as chapters are added one at a time -- no id-to-shot mapping table,
 * since config.js's scene ids and shots.js's shot ids are the same string by
 * convention.
 *
 * This is deliberately not the full continuous scroll-progress camera path
 * Section 16 ultimately describes (a single 0-1 master value driving
 * position/target interpolation within a chapter, not just between them) --
 * that remains a later milestone. This module only guarantees every chapter
 * with a real environment is actually reachable by the camera today.
 *
 * Also applies a shot's optional `fog` override (Section 10: atmosphere
 * "tuned per world region"), if the shot declares one -- the single global
 * fog (Environment.js) is tuned for the close-range chapters and needs a
 * lighter touch for chapters spanning much greater distances (Global
 * Logistics' continental landmass, at full density, fully saturates to flat
 * fog color well before the horizon). Falls back to Environment's own
 * default for any scene without an override, so leaving such a chapter
 * always restores the shared look.
 */
export function mountCameraSync(worldRoot, experience) {
  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  if (!sections.length || !experience?.camera) return;

  sections.forEach((el) => {
    el.addEventListener('scene:state-change', (event) => {
      const sceneId = el.dataset.sceneId;

      // Cinematic Integration Phase, Commit 1: pushes this section's
      // lifecycle state into its matching region's own activity-weight
      // easing (World.js's per-region setActivity(), see
      // experience/world/*.js) -- runs on every state, not just 'active',
      // since a region needs to know when it's *leaving* too. Independent
      // of the shot/fog logic below, which keeps its own 'active'-only
      // guard unchanged.
      experience.world?.getRegion(sceneId)?.setActivity(event.detail.state);

      if (event.detail.state !== 'active') return;
      experience.camera.setShot(sceneId, { instant: false });

      const fog = SHOTS[sceneId]?.fog;
      const environment = experience.world?.environment;
      if (!environment) return;
      if (fog) {
        environment.setFogColor(fog.color);
        environment.setFogDensity(fog.density);
      } else {
        environment.resetFog();
      }

      environment.setEnvironmentIntensity(SHOTS[sceneId]?.environmentIntensity ?? DEFAULT_ENVIRONMENT_INTENSITY);
    });
  });
}
