import { SCENES } from '../scroll-world/config.js';

/**
 * Mounts the journey route-rail: a secondary "which scene am I in" indicator.
 * In Milestone 0 this observes the semantic scene sections directly (no video
 * engine exists yet) via IntersectionObserver, so `aria-current` already reflects
 * real scroll position. The future scroll-scrub engine (Milestone 3) can drive this
 * from its own progress value instead — see mountRouteRail's returned `setActive`.
 */
export function mountRouteRail(container, { worldRoot }) {
  container.innerHTML = `
    <nav class="route-rail" aria-label="Shipment journey">
      <ol>
        ${SCENES.map(
          (scene) => `
          <li>
            <a href="#scene-${scene.id}" data-route-link data-scene-id="${scene.id}">
              <span class="route-rail__dot" aria-hidden="true"></span>
              <span class="route-rail__label">${scene.index}. ${scene.label}</span>
            </a>
          </li>`
        ).join('')}
      </ol>
    </nav>
  `;

  const links = Array.from(container.querySelectorAll('[data-route-link]'));

  function setActive(sceneId) {
    links.forEach((link) => {
      const isActive = link.dataset.sceneId === sceneId;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  if (worldRoot) {
    const sections = Array.from(worldRoot.querySelectorAll('[data-scene-id]'));
    if (sections.length && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible) setActive(visible.target.dataset.sceneId);
        },
        { threshold: [0.25, 0.5, 0.75] }
      );
      sections.forEach((section) => observer.observe(section));
    }
  }

  setActive(SCENES[0].id);

  return { setActive };
}
