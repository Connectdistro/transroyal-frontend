/**
 * Feeds CameraRig's intra-chapter drift (Cinematic Integration Phase,
 * Commit 4b) a normalized scroll-progress value. This module computes a
 * number and hands it to the one method CameraRig exposes for it --
 * `experience.camera.setProgress(progress)` -- and never touches the
 * camera transform itself (the "CameraRig is the only class that mutates
 * the camera transform" rule stated in CameraRig.js's own class doc).
 *
 * Determines the active chapter independently of scene-state.js's own
 * IntersectionObserver, matching that module's own documented precedent of
 * intentionally independent observers per concern ("the two are
 * intentionally independent... so neither can break the other") -- this is
 * a third, equally independent one.
 */
export function mountScrollProgress(worldRoot, experience) {
  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  if (!sections.length || !experience?.camera) return;

  experience.time.on('tick', () => {
    const viewportCenter = window.innerHeight / 2;

    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
        const progress = (viewportCenter - rect.top) / rect.height;
        experience.camera.setProgress(progress);
        return;
      }
    }
  });
}
