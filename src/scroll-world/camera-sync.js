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
 */
export function mountCameraSync(worldRoot, experience) {
  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  if (!sections.length || !experience?.camera) return;

  sections.forEach((el) => {
    el.addEventListener('scene:state-change', (event) => {
      if (event.detail.state !== 'active') return;
      experience.camera.setShot(el.dataset.sceneId, { instant: false });
    });
  });
}
