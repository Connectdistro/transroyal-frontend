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

function renderWorld() {
  const [hero, ...rest] = SCENES;

  const heroMarkup = `
    <section id="scene-${hero.id}" data-scene-id="${hero.id}" class="scene scene--hero" aria-labelledby="scene-${hero.id}-title">
      <div class="scene__art" aria-hidden="true">
        <div class="scene__art-grid"></div>
        <div class="scene__art-glow scene__art-glow--a"></div>
        <div class="scene__art-glow scene__art-glow--b"></div>
        <svg class="scene__art-routes" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
          <path d="M40 520 C 220 380, 260 200, 460 160 S 720 120, 760 40" />
          <path d="M20 200 C 180 260, 320 320, 420 300 S 640 260, 780 340" />
        </svg>
      </div>
      <div class="scene__copy">
        <p class="scene__eyebrow">${hero.eyebrow}</p>
        <h1 id="scene-${hero.id}-title">${hero.title}</h1>
        <p class="scene__body">${hero.body}</p>
        <a class="scene__cta" href="#scene-${rest[0].id}">Continue the journey &darr;</a>
      </div>
    </section>
  `;

  const pendingMarkup = rest
    .map(
      (scene) => `
      <section id="scene-${scene.id}" data-scene-id="${scene.id}" class="scene scene--pending" aria-labelledby="scene-${scene.id}-title">
        <div class="scene__copy scene__copy--pending">
          <p class="scene__eyebrow">${scene.eyebrow}</p>
          <h2 id="scene-${scene.id}-title">${scene.title}</h2>
          <p class="scene__body">${scene.body}</p>
          <p class="scene__status">Cinematic scene in production</p>
        </div>
      </section>`
    )
    .join('');

  return `<main id="world" class="world">${heroMarkup}${pendingMarkup}</main>`;
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
