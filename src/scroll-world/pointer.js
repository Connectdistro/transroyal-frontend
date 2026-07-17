import { dampFactor } from './experience/utils/damp.js';

/**
 * Cinematic Polish Phase, Commit 2 -- the cursor as a lightweight
 * interaction field. Deliberately NOT a Raycaster-based 3D picking system
 * (forbidden by this phase's own performance rules, and unnecessary: the
 * interactive elements are DOM buttons/CTAs, not literal meshes to pick).
 * Tracks pointer position as a plain 2D signal, eases it via the shared
 * dampFactor() utility, and drives one DOM cursor-follower element.
 *
 * "3D-ness" comes from Commit 3 layering the eased value onto camera
 * parallax (CameraRig.setCursorInfluence) -- this file only computes
 * numbers and moves a DOM element; it never touches the camera or the
 * Three.js scene graph itself.
 *
 * One shared `experience.time` tick subscription, matching every other
 * tick-consumer in this codebase -- no second requestAnimationFrame loop.
 * Every per-tick value lives in a plain closed-over primitive, never a
 * per-frame allocation.
 */

const FOLLOWER_HALF_LIFE_MS = 90;
// Caps how far the follower's stretch can go, so fast pointer motion never
// reads as a wild elastic snap -- "no abrupt movement."
const MAX_STRETCH = 0.55;
const STRETCH_SENSITIVITY = 0.035;

export function mountPointer(worldRoot, experience) {
  // No-op entirely on touch/coarse-pointer devices -- no listeners, no DOM
  // element, nothing for Commit 3's camera parallax to ever receive either.
  if (!window.matchMedia('(pointer: fine)').matches) return;

  let rawX = 0;
  let rawY = 0;

  window.addEventListener(
    'pointermove',
    (event) => {
      rawX = (event.clientX / window.innerWidth) * 2 - 1;
      rawY = (event.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  const follower = document.createElement('div');
  follower.className = 'cursor-follower';
  follower.setAttribute('aria-hidden', 'true');
  document.body.appendChild(follower);

  let magnetX = 0;
  let magnetY = 0;
  let isMagnetized = false;

  // Event delegation on worldRoot -- one listener pair, not one per CTA.
  // pointerenter/pointerleave don't bubble, so useCapture: true is what
  // lets a single ancestor listener still observe them for any descendant.
  worldRoot.addEventListener(
    'pointerenter',
    (event) => {
      const cta = event.target.closest?.('.scene__cta');
      if (!cta) return;
      const rect = cta.getBoundingClientRect();
      magnetX = rect.left + rect.width / 2;
      magnetY = rect.top + rect.height / 2;
      isMagnetized = true;
      follower.classList.add('cursor-follower--magnetized');
    },
    true
  );
  worldRoot.addEventListener(
    'pointerleave',
    (event) => {
      if (!event.target.closest?.('.scene__cta')) return;
      isMagnetized = false;
      follower.classList.remove('cursor-follower--magnetized');
    },
    true
  );

  let followerX = window.innerWidth / 2;
  let followerY = window.innerHeight / 2;
  let prevFollowerX = followerX;
  let prevFollowerY = followerY;

  experience.time.on('tick', () => {
    const dt = experience.time.delta;

    const targetX = isMagnetized ? magnetX : ((rawX + 1) / 2) * window.innerWidth;
    const targetY = isMagnetized ? magnetY : ((rawY + 1) / 2) * window.innerHeight;

    const ft = dampFactor(FOLLOWER_HALF_LIFE_MS, dt);
    followerX += (targetX - followerX) * ft;
    followerY += (targetY - followerY) * ft;

    // Velocity-based stretch: the follower elongates along its direction of
    // travel while moving, and relaxes back to circular as it settles --
    // "stretch slightly with velocity... compress while stopping."
    const vx = followerX - prevFollowerX;
    const vy = followerY - prevFollowerY;
    prevFollowerX = followerX;
    prevFollowerY = followerY;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const stretch = Math.min(speed * STRETCH_SENSITIVITY, MAX_STRETCH);
    const angle = speed > 0.01 ? Math.atan2(vy, vx) : 0;

    follower.style.transform =
      `translate3d(${followerX}px, ${followerY}px, 0) translate(-50%, -50%) ` +
      `rotate(${angle}rad) scaleX(${1 + stretch}) scaleY(${1 - stretch * 0.4}) rotate(${-angle}rad)`;
  });
}
