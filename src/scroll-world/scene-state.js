/**
 * Generic scene lifecycle state, derived entirely from IntersectionObserver ratios
 * on whatever `[data-scene-id]` sections exist inside `worldRoot` — no scene-id
 * branching, no scroll listeners. Each scene cycles:
 *
 *   inactive -> entering -> active -> leaving -> inactive
 *
 * "active" is the single scene with the highest intersection ratio right now
 * (same selection rule route-rail.js already uses for its own, separate
 * observer — the two are intentionally independent, not shared, so neither can
 * break the other). A scene that loses "active" status is always "leaving,"
 * regardless of its own ratio trend, so it can't flicker back to "entering" on
 * small scroll jitter; a scene that was never active reads its own rising ratio
 * as "entering."
 *
 * Exposed two ways, so future consumers (a still/video swap, parallax, a Motion
 * Camera) can attach without importing this module at all:
 *   - a `data-state` attribute on the scene section
 *   - a `scene:state-change` CustomEvent dispatched on that same section
 *
 * No visual effect is wired to any of this yet — this milestone only exposes the
 * state.
 */
export function mountSceneState(worldRoot) {
  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  const noop = { getState: () => 'inactive' };
  if (!sections.length || !('IntersectionObserver' in window)) return noop;

  const ratios = new Map(sections.map((el) => [el, 0]));
  const states = new Map(sections.map((el) => [el, 'inactive']));

  sections.forEach((el) => {
    el.dataset.state = 'inactive';
  });

  function setState(el, next) {
    const previousState = states.get(el);
    if (previousState === next) return;
    states.set(el, next);
    el.dataset.state = next;
    el.dispatchEvent(new CustomEvent('scene:state-change', { detail: { state: next, previousState } }));
  }

  function recompute() {
    let activeEl = null;
    let bestRatio = 0;
    for (const el of sections) {
      const ratio = ratios.get(el);
      if (ratio > 0 && ratio >= bestRatio) {
        bestRatio = ratio;
        activeEl = el;
      }
    }

    for (const el of sections) {
      const ratio = ratios.get(el);
      if (ratio <= 0) {
        setState(el, 'inactive');
        continue;
      }
      if (el === activeEl) {
        setState(el, 'active');
        continue;
      }
      // Not the dominant scene right now. Having been active and losing that
      // status always reads as leaving; anything else rising into view (or
      // already mid-approach) reads as entering.
      setState(el, states.get(el) === 'active' ? 'leaving' : states.get(el) === 'leaving' ? 'leaving' : 'entering');
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      recompute();
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
  );

  sections.forEach((el) => observer.observe(el));

  return {
    getState(sceneId) {
      const el = sections.find((s) => s.dataset.sceneId === sceneId);
      return el ? states.get(el) : 'inactive';
    },
  };
}
