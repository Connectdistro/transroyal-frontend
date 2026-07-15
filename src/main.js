import './styles/tokens.css';
import './styles/base.css';
import './styles/nav.css';
import './styles/tracking.css';
import './styles/route-rail.css';
import './styles/world.css';
import './styles/footer.css';

import { SCENES } from './scroll-world/config.js';
import { mountSceneState } from './scroll-world/scene-state.js';
import { mountScenePreload } from './scroll-world/scene-preload.js';
import { mountNav } from './components/nav.js';
import { mountTrackingPanel } from './components/tracking-panel.js';
import { mountRouteRail } from './components/route-rail.js';
import { mountFooter } from './components/footer.js';

/**
 * Production still/video slot (Milestone M1C.3 scaffold, extended for Phase 4.1).
 * `scene.media` is `{ still, video, mobileStill, mobileVideo }`, every field `null`
 * today — no generated assets exist yet, so this always returns '' in practice.
 * Nothing here ever emits a broken/empty <img> or <video>; the populated branches
 * only run once config.js actually carries a real asset path — wiring a scene's
 * media is a config-only change, never a rendering rewrite.
 *
 * `isHero` (the opening scene, by position — never a scene-id check) gets eager,
 * high-priority image loading since it's the first thing painted; every other
 * scene lazy-loads since it's below the fold at initial paint.
 *
 * `mobileVideo`, once populated, is now picked via a <source media> query on the
 * <video> itself — the same declarative, JS-free mechanism <picture> already uses
 * for `mobileStill`. This selects the right encode on initial load; re-selecting
 * on a later resize/orientation change is still out of scope here (video, unlike
 * picture/img, doesn't re-run source selection reactively) — that remains the
 * future scroll-engine milestone's job, per this file's original scaffolding note.
 */
function renderSceneMedia(scene, isHero) {
  const { still, mobileStill, video, mobileVideo } = scene.media ?? {};
  const baseStill = still ?? mobileStill;
  if (!baseStill && !video) return '';

  if (video) {
    // `baseStill` doubles as the poster (pre-decode fallback + lazy-load frame).
    const mobileSource = mobileVideo
      ? `<source media="(max-width: 639px)" src="${mobileVideo}" type="video/mp4" />`
      : '';
    return `<video class="scene__media" muted loop playsinline preload="none"${
      baseStill ? ` poster="${baseStill}"` : ''
    }>${mobileSource}<source src="${video}" type="video/mp4" /></video>`;
  }

  // <picture> gives still images native, JS-free mobile substitution. Falls back to
  // mobileStill as the base image if a scene only ever ships that field.
  const mobileSource =
    mobileStill && mobileStill !== baseStill
      ? `<source media="(max-width: 639px)" srcset="${mobileStill}" />`
      : '';
  const loading = isHero ? 'eager' : 'lazy';
  const fetchPriority = isHero ? 'high' : 'low';
  return `<picture>${mobileSource}<img class="scene__media" src="${baseStill}" alt="" loading="${loading}" fetchpriority="${fetchPriority}" decoding="async" /></picture>`;
}

function renderSceneAtmosphere() {
  return `<div class="scene__atmosphere"></div>`;
}

function renderSceneLighting(isHero) {
  return isHero
    ? `<div class="scene__lighting scene__lighting--a"></div><div class="scene__lighting scene__lighting--b"></div>`
    : `<div class="scene__lighting scene__lighting--accent"></div>`;
}

function renderSceneDepth(scene, isHero) {
  if (!isHero && scene.pacing !== 'sparse') return '';
  return `
    <svg class="scene__depth" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
      <path d="M40 520 C 220 380, 260 200, 460 160 S 720 120, 760 40" />
      <path d="M20 200 C 180 260, 320 320, 420 300 S 640 260, 780 340" />
    </svg>`;
}

function renderSceneScrim() {
  return `<div class="scene__scrim"></div>`;
}

/**
 * The scene's decorative + media stack, in bottom-to-top paint order (documented
 * alongside the matching z-index scale in world.css): media -> atmosphere ->
 * lighting -> depth -> scrim. All five layers live inside one aria-hidden wrapper;
 * `.scene__copy` (rendered by the caller) is the only sibling outside it, always on
 * top. Sparse scenes (the journey's opening and closing beats) carry the depth
 * layer's animated route motif; denser scenes stay calmer so their heavier content
 * reads cleanly — the visual half of the sparse -> dense -> sparse pacing driven by
 * `scene.pacing` in config.js.
 */
function renderSceneArt(scene, isHero) {
  return `
    <div class="scene__art" aria-hidden="true">
      ${renderSceneMedia(scene, isHero)}
      ${renderSceneAtmosphere()}
      ${renderSceneLighting(isHero)}
      ${renderSceneDepth(scene, isHero)}
      ${renderSceneScrim()}
    </div>`;
}

function renderProofPoints(points) {
  if (!points?.length) return '';
  return `
    <ul class="scene__proof-points">
      ${points.map((point) => `<li>${point}</li>`).join('')}
    </ul>`;
}

function renderStats(stats) {
  if (!stats?.length) return '';
  return `
    <div class="scene__stats">
      ${stats
        .map(
          (stat) => `
        <div class="scene__stat">
          <span class="scene__stat-value">${stat.value}</span>
          <span class="scene__stat-label">${stat.label}</span>
        </div>`
        )
        .join('')}
    </div>`;
}

function renderCta(cta) {
  if (!cta) return '';
  return `<a class="scene__cta" href="${cta.href}">${cta.label}</a>`;
}

/**
 * One reusable scene template for all seven scenes — narrative-only, service/capability,
 * stat-bearing, and CTA-bearing scenes are all the same markup shape, differing only in
 * which optional config fields are present. Avoids seven hardcoded page sections; adding
 * an eighth scene or a new optional field (e.g. a real `media` still) is a config change,
 * not a template change.
 */
function renderScene(scene, isHero) {
  const HeadingTag = isHero ? 'h1' : 'h2';
  const sceneClass = isHero ? 'scene scene--hero' : 'scene scene--journey';
  const accentStyle = scene.accent ? ` style="--scene-accent: ${scene.accent}"` : '';

  return `
    <section id="scene-${scene.id}" data-scene-id="${scene.id}" data-pacing="${scene.pacing}" data-composition="${scene.composition}" class="${sceneClass}" aria-labelledby="scene-${scene.id}-title"${accentStyle}>
      ${renderSceneArt(scene, isHero)}
      <div class="scene__copy">
        <p class="scene__eyebrow">${scene.eyebrow}</p>
        <${HeadingTag} id="scene-${scene.id}-title">${scene.title}</${HeadingTag}>
        <p class="scene__body">${scene.body}</p>
        ${renderProofPoints(scene.proofPoints)}
        ${renderStats(scene.stats)}
        ${renderCta(scene.cta)}
      </div>
    </section>`;
}

function renderWorld() {
  const markup = SCENES.map((scene, i) => renderScene(scene, i === 0)).join('');
  return `<main id="world" class="world">${markup}</main>`;
}

document.querySelector('#app').innerHTML = `
  <a class="skip-link" href="#world">Skip to journey</a>
  <a class="skip-link" href="#contact">Skip to footer</a>
  <div id="nav-root"></div>
  <div id="tracking-root"></div>
  ${renderWorld()}
  <div id="route-rail-root"></div>
  <div id="footer-root"></div>
`;

mountNav(document.querySelector('#nav-root'));
mountTrackingPanel(document.querySelector('#tracking-root'));
mountRouteRail(document.querySelector('#route-rail-root'), {
  worldRoot: document.querySelector('#world'),
});
mountSceneState(document.querySelector('#world'));
mountScenePreload(document.querySelector('#world'));
mountFooter(document.querySelector('#footer-root'));
