/**
 * Track A6: Delivered's own decision moment -- "was the promise fulfilled?"
 * resolves when a `[data-status-badge]` element's own section reports
 * 'active' via the `scene:state-change` event scene-state.js already
 * dispatches on every `[data-scene-id]` section (the same lifecycle hook
 * camera-sync.js/scene-preload.js/route-rail.js all independently listen
 * for). Purely a text/class swap -- no animation timing of its own, no new
 * signal. Generic over any scene that opts in via config.js's
 * `statusTransition` field, not hardcoded to Delivered specifically.
 */
export function mountStatusBadge(worldRoot) {
  const badges = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-status-badge]')) : [];
  if (!badges.length) return;

  badges.forEach((badge) => {
    const section = badge.closest('[data-scene-id]');
    if (!section) return;

    section.addEventListener('scene:state-change', (event) => {
      const resolved = event.detail.state === 'active';
      badge.textContent = resolved ? badge.dataset.statusTo : badge.dataset.statusFrom;
      badge.classList.toggle('scene__status-badge--resolved', resolved);
    });
  });
}
