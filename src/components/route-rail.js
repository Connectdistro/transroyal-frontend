import { SCENES } from '../scroll-world/config.js';

/**
 * The side navigation / scene progress indicator. Rebuilt from scratch
 * against the approved design reference (reference/*.png, screenshots 2-6):
 * a plain, always-legible label list -- not a dot-per-item list where every
 * label stays hidden until hover. Every label is visible at a dimmed
 * weight; only the active chapter brightens, and a single marker slides to
 * sit beside it -- the reference's own active-state treatment, translated
 * to an animated indicator rather than a static per-item dot.
 *
 * Hidden while Origin is active, visible for every other chapter -- Origin
 * is a cinematic introduction the interface stays out of (Handbook Section
 * 23) -- driven by the existing scene-state system (`scene:state-change`
 * events on each `[data-scene-id]` section, the same mechanism
 * camera-sync.js already uses), never a scroll-position threshold. Also
 * hidden once the footer scrolls into view -- it carries the same journey
 * links (footer.js's own "The Journey" column), so the rail would just be
 * duplicating navigation the visitor is already looking at.
 */
export function mountRouteRail(container, { worldRoot, footerEl }) {
  container.innerHTML = `
    <nav class="route-rail" aria-label="Shipment journey">
      <span class="route-rail__indicator" aria-hidden="true"></span>
      <ol>
        ${SCENES.map(
          (scene) => `
          <li>
            <a href="#scene-${scene.id}" data-route-link data-scene-id="${scene.id}">${scene.label}</a>
          </li>`
        ).join('')}
      </ol>
    </nav>
  `;

  const rail = container.querySelector('.route-rail');
  const list = container.querySelector('ol');
  const indicator = container.querySelector('.route-rail__indicator');
  const links = Array.from(container.querySelectorAll('[data-route-link]'));

  function positionIndicator(link) {
    const listTop = list.getBoundingClientRect().top;
    const linkRect = link.getBoundingClientRect();
    const offset = linkRect.top - listTop + linkRect.height / 2;
    // Rotation must be re-declared here, not left to route-rail.css's own
    // base rule -- this assignment replaces the element's whole inline
    // `transform`, which would otherwise silently drop the diamond's
    // rotate(45deg) the first time this runs.
    indicator.style.transform = `translateY(${offset}px) rotate(45deg)`;
  }

  function setActive(sceneId) {
    links.forEach((link) => {
      const isActive = link.dataset.sceneId === sceneId;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
        positionIndicator(link);
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  // Two independent conditions gate visibility -- Origin being active, and
  // the footer being in view -- tracked separately since either one alone
  // must be able to hide the rail regardless of the other's state.
  let isOriginActive = true;
  let isFooterVisible = false;
  function updateVisibility() {
    rail.classList.toggle('route-rail--visible', !isOriginActive && !isFooterVisible);
  }

  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  sections.forEach((section) => {
    section.addEventListener('scene:state-change', (event) => {
      const sceneId = section.dataset.sceneId;
      if (event.detail.state === 'active') setActive(sceneId);
      if (sceneId === 'origin') {
        isOriginActive = event.detail.state === 'active';
        updateVisibility();
      }
    });
  });

  if (footerEl && 'IntersectionObserver' in window) {
    const footerObserver = new IntersectionObserver(
      (entries) => {
        isFooterVisible = entries[0].isIntersecting;
        updateVisibility();
      },
      { threshold: 0.1 }
    );
    footerObserver.observe(footerEl);
  }

  window.addEventListener('resize', () => {
    const active = links.find((link) => link.classList.contains('is-active'));
    if (active) positionIndicator(active);
  });

  setActive(SCENES[0].id);

  return { setActive };
}
