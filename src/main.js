import './styles/tokens.css';
import './styles/base.css';
import './styles/nav.css';
import './styles/tracking.css';
import './styles/route-rail.css';
import './styles/world.css';
import './styles/footer.css';

import { SCENES } from './scroll-world/config.js';
import { mountNav } from './components/nav.js';
import { mountTrackingPanel } from './components/tracking-panel.js';
import { mountRouteRail } from './components/route-rail.js';
import { mountFooter } from './components/footer.js';

const HERO_ART = `
  <div class="scene__art-grid"></div>
  <div class="scene__art-glow scene__art-glow--a"></div>
  <div class="scene__art-glow scene__art-glow--b"></div>
  ${routeSVG()}
`;

function routeSVG() {
  return `
    <svg class="scene__art-routes" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
      <path d="M40 520 C 220 380, 260 200, 460 160 S 720 120, 760 40" />
      <path d="M20 200 C 180 260, 320 320, 420 300 S 640 260, 780 340" />
    </svg>`;
}

/**
 * CSS/SVG-authored decorative environment layer, standing in for a real generated
 * still/video until Milestone M1c wires `scene.media`. Sparse scenes (the journey's
 * opening and closing beats) carry the fuller, animated treatment; denser scenes stay
 * calmer so their heavier content reads cleanly — this is the visual half of the
 * sparse -> dense -> sparse pacing driven by `scene.pacing` in config.js.
 */
function renderSceneArt(scene, isHero) {
  if (isHero) {
    return `<div class="scene__art" aria-hidden="true">${HERO_ART}</div>`;
  }

  if (scene.pacing === 'sparse') {
    return `
      <div class="scene__art" aria-hidden="true">
        <div class="scene__art-grid"></div>
        <div class="scene__art-glow scene__art-glow--accent"></div>
        ${routeSVG()}
      </div>`;
  }

  return `
    <div class="scene__art" aria-hidden="true">
      <div class="scene__art-grid"></div>
      <div class="scene__art-glow scene__art-glow--accent"></div>
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
mountFooter(document.querySelector('#footer-root'));
