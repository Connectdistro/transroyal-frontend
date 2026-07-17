import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { CustomEase } from 'gsap/CustomEase';

/**
 * The project's single, shared programmatic-scroll navigation service
 * (Cinematic Integration Phase, Commit 2). Every nav surface -- route-rail,
 * the nav overlay, the footer, every scene CTA -- already renders plain,
 * real `<a href="#scene-id">`/`<a href="#contact">` anchors; none of those
 * files change. This module is the one place smooth-scroll navigation
 * behavior lives, delegated from a single listener (mountScrollNav) so
 * every current and future nav control routes through exactly the same
 * code path -- no duplicated scrolling logic anywhere.
 *
 * Deliberately does not touch `experience.camera` or dispatch any scene
 * event itself: it only moves the DOM scroll position. GSAP's
 * ScrollToPlugin animates `window.scrollTo` in many small per-frame steps,
 * so the existing scene-state.js IntersectionObserver fires continuously
 * during a programmatic scroll exactly as it does during organic
 * scrolling, and camera-sync.js reacts to each resulting
 * `scene:state-change` exactly as today -- a long nav click therefore
 * visibly flies the camera through intermediate shots as an emergent
 * result of routing through the *existing* pipeline, not new camera code.
 */

gsap.registerPlugin(ScrollToPlugin, CustomEase);

// The exact four control points of tokens.css's `--ease-standard:
// cubic-bezier(0.22, 1, 0.36, 1)` -- kept in sync with that token by hand;
// update both together if the token ever changes.
CustomEase.create('scroll-standard', '0.22, 1, 0.36, 1');

// Mirrors tokens.css's `--duration-slow` (420ms) as the per-hop baseline;
// MAX_DURATION caps how long even the longest cross-journey jump
// (Origin -> Delivered) takes, so it still reads as a deliberate flight,
// never sluggish. PIXELS_PER_SECOND is tuned so a single-viewport hop lands
// close to MIN_DURATION.
const MIN_DURATION = 0.42;
const MAX_DURATION = 1.4;
const PIXELS_PER_SECOND = 2200;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** SPA-route-change focus-management pattern: preventDefault() on the
 *  intercepted click suppresses the browser's native fragment-navigation
 *  focus/AT-announcement behavior, so this restores it explicitly rather
 *  than silently regressing accessibility versus a plain anchor jump.
 *  `tabindex="-1"` makes an otherwise non-interactive section
 *  programmatically focusable without adding it to the natural tab order. */
function focusTarget(target) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

function syncHash(id, updateHistory) {
  if (!updateHistory) return;
  const hash = '#' + id;
  if (location.hash !== hash) history.pushState(null, '', hash);
}

let activeTween = null;

/**
 * Smooth-scrolls to the element matching `idOrHash` (a scene section or
 * `#contact`). Returns `false` (no-op, native browser behavior applies) if
 * no matching element exists -- this is what correctly preserves
 * nav.js's `href="#top"` brand link, which has no matching id.
 */
export function scrollToTarget(idOrHash, { updateHistory = true } = {}) {
  const id = idOrHash.replace(/^#/, '');
  const target = document.getElementById(id);
  if (!target) return false;

  // A new destination cleanly cancels any in-flight scroll and starts
  // immediately -- explicit and deterministic, not left to GSAP's default
  // tween-overwrite heuristics.
  activeTween?.kill();

  const finish = () => {
    activeTween = null;
    syncHash(id, updateHistory);
    focusTarget(target);
  };

  if (reducedMotion.matches) {
    const currentTop = target.getBoundingClientRect().top;
    window.scrollTo(0, window.scrollY + currentTop);
    finish();
    return true;
  }

  const distance = Math.abs(target.getBoundingClientRect().top);
  const duration = clamp(distance / PIXELS_PER_SECOND, MIN_DURATION, MAX_DURATION);

  activeTween = gsap.to(window, {
    duration,
    ease: 'scroll-standard',
    scrollTo: { y: target, autoKill: true },
    onComplete: finish,
    // Fires on any early termination (autoKill from user-driven scroll, or
    // the explicit activeTween.kill() above from a new click). No code
    // path anywhere resumes toward the old destination after this --
    // autoKill itself is what stops the programmatic scroll the instant
    // the user takes over; this callback is just bookkeeping so the next
    // scrollToTarget() call's own `activeTween?.kill()` has nothing stale
    // to kill.
    onInterrupt: () => {
      activeTween = null;
    },
  });
  return true;
}

/**
 * Attaches one delegated click listener to `root` that intercepts every
 * in-page hash link (`a[href^="#..."]`) and routes it through
 * scrollToTarget() above. Ignores modified clicks so opening in a new tab
 * stays native; `Track Shipment` buttons are `<button>`s, not anchors, so
 * they're untouched by this listener.
 */
export function mountScrollNav(root) {
  root.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    if (scrollToTarget(link.getAttribute('href'))) event.preventDefault();
  });
}
