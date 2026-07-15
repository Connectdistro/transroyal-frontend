import { SCENES } from './config.js';

const MOBILE_QUERY = '(max-width: 639px)';

/**
 * Progressive, one-scene-ahead media preloading. Listens for the
 * `scene:state-change` event scene-state.js already dispatches on each scene
 * section (that module is not modified here) and, the moment a scene becomes
 * `active`, preloads only the *next* scene's media — determined purely by
 * array position in `SCENES`, never a scene-id branch, so this works
 * unchanged for any scene count or order.
 *
 * A no-op today: every scene's `media` fields are null, so `preloadScene`
 * finds nothing to do for any scene. Wiring a real still/video into
 * config.js is enough to make this start preloading it — no code change.
 *
 * `scene:state-change` doesn't bubble (see scene-state.js), so this attaches
 * one listener per section rather than delegating from `worldRoot`.
 */
export function mountScenePreload(worldRoot) {
  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  if (!sections.length) return;

  const preloaded = new Set();
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  // Mirrors renderSceneMedia's own still/mobileStill fallback in main.js (not
  // imported from there, since that file's render pipeline isn't touched by
  // this milestone) — picks whichever asset the current viewport would
  // actually render, so a desktop still is never fetched on a phone or vice
  // versa.
  function pickUrl(media, mobileField, desktopField) {
    if (!media) return null;
    if (isMobile() && media[mobileField]) return media[mobileField];
    return media[desktopField] ?? media[mobileField] ?? null;
  }

  function preloadUrl(url, as) {
    if (!url || preloaded.has(url)) return;
    preloaded.add(url);
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.href = url;
    if (as === 'video') link.type = 'video/mp4';
    document.head.appendChild(link);
  }

  function preloadScene(scene) {
    if (!scene?.media) return;
    const stillUrl = pickUrl(scene.media, 'mobileStill', 'still');
    const videoUrl = pickUrl(scene.media, 'mobileVideo', 'video');
    if (videoUrl) {
      preloadUrl(videoUrl, 'video');
      // A video scene ships `still` only as that video's poster — still worth
      // preloading so the poster paints instantly before the video buffers.
      if (stillUrl) preloadUrl(stillUrl, 'image');
    } else if (stillUrl) {
      preloadUrl(stillUrl, 'image');
    }
  }

  sections.forEach((section, index) => {
    section.addEventListener('scene:state-change', (event) => {
      if (event.detail?.state !== 'active') return;
      preloadScene(SCENES[index + 1]);
    });
  });
}
