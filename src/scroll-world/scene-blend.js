import { Color } from 'three';
import { SCENES } from './config.js';
import { SHOTS, LIGHT_TINTS } from './experience/camera/shots.js';

/**
 * Cinematic Polish Phase, Commit 1 -- turns the existing four-state soft
 * snap (inactive/entering/active/leaving, from scene-state.js) into a
 * genuinely continuous cross-fade between adjacent chapters, WITHOUT
 * touching scene-state.js, camera-sync.js's existing logic, Environment.js,
 * World.js, or any region's existing methods.
 *
 * The mechanism: `Environment.js` and every region already ease toward
 * whatever target they were last given (Cinematic Integration Phase). This
 * module simply drives those existing targets continuously, every tick,
 * with a continuously-interpolated value, instead of once per discrete
 * scene-state transition -- that's the entire difference between "soft
 * snap" and "true cross-fade." camera-sync.js's own discrete calls keep
 * firing exactly as before; they become harmless, infrequent, immediately-
 * superseded coarse nudges, since this module's continuous calls run every
 * frame and always win.
 *
 * A fourth intentionally independent observer, matching scene-state.js's
 * own documented precedent ("intentionally independent... so neither can
 * break the other") -- reuses scroll-progress.js's exact
 * viewport-center-vs-section-rect technique via its own small copy rather
 * than importing shared internals, the same duplication already tolerated
 * between camera-sync.js and scroll-progress.js.
 *
 * Camera *position* is untouched here -- shot easing and drift stay fully
 * discrete/additive, owned entirely by CameraRig (Cinematic Polish Phase,
 * Commit 3 layers cursor parallax the same way, never here).
 */

// How much of a chapter's own scroll span, at each end, counts as a
// "transition corridor" where cross-fading toward the adjacent chapter is
// live. Outside this window (the large middle of every chapter), every
// blended value collapses to exactly that chapter's own resting value --
// the formulas below are written so this happens automatically at t=0,
// with no separate "restore" branch needed.
const CORRIDOR = 0.18;

// Mirrors Environment.js's own DEFAULT_FOG (ROYAL_600 / DEFAULT_FOG_DENSITY)
// -- duplicated rather than imported since those are private module consts
// there, matching this phase's existing tolerance for small, documented
// duplication (e.g. shots.js's drift/light-tint tables).
const DEFAULT_FOG = { color: '#2540b0', density: 0.012 };
const DEFAULT_ENVIRONMENT_INTENSITY = 1;

// How strongly a region's activityWeight target is lifted while it's in a
// transition corridor (Math.max'd against whatever camera-sync.js's own
// discrete state logic already set) -- keeps an approaching/departing
// region from sagging toward its own activityFloor while still in frame.
const CORRIDOR_ACTIVITY_BOOST = 0.9;

// Pre-allocated scratch Color instances -- every lerp below mutates one of
// these in place, zero per-frame allocation.
const scratchColorA = new Color();
const scratchColorB = new Color();
const scratchKey = new Color();
const scratchFill = new Color();

function resolveFog(sceneId) {
  return SHOTS[sceneId]?.fog ?? DEFAULT_FOG;
}

function resolveIntensity(sceneId) {
  return SHOTS[sceneId]?.environmentIntensity ?? DEFAULT_ENVIRONMENT_INTENSITY;
}

export function mountScrollBlend(worldRoot, experience) {
  const sections = worldRoot ? Array.from(worldRoot.querySelectorAll('[data-scene-id]')) : [];
  if (!sections.length || !experience?.world) return;

  let lastActiveSection = null;

  experience.time.on('tick', () => {
    const viewportCenter = window.innerHeight / 2;

    let activeSection = null;
    let progress = 0;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
        activeSection = section;
        progress = (viewportCenter - rect.top) / rect.height;
        break;
      }
    }
    if (!activeSection) return;

    if (lastActiveSection && lastActiveSection !== activeSection) {
      lastActiveSection.style.setProperty('--scene-blend', '0');
    }
    lastActiveSection = activeSection;

    const currentId = activeSection.dataset.sceneId;
    const currentIndex = SCENES.findIndex((scene) => scene.id === currentId);

    let t = 0;
    let adjacentId = null;
    if (progress < CORRIDOR && currentIndex > 0) {
      t = 1 - progress / CORRIDOR;
      adjacentId = SCENES[currentIndex - 1].id;
    } else if (progress > 1 - CORRIDOR && currentIndex < SCENES.length - 1) {
      t = (progress - (1 - CORRIDOR)) / CORRIDOR;
      adjacentId = SCENES[currentIndex + 1].id;
    }

    activeSection.style.setProperty('--scene-blend', String(t));

    // Fog and environment intensity are single global values -- computing
    // `lerp(current, adjacent, t)` every tick (not only while t > 0)
    // naturally collapses to exactly the current chapter's own resting
    // value once t reaches 0, so there is no separate "restore" branch.
    const environment = experience.world.environment;
    if (environment) {
      const currentFog = resolveFog(currentId);
      const adjacentFog = adjacentId ? resolveFog(adjacentId) : currentFog;
      scratchColorA.set(currentFog.color);
      scratchColorB.set(adjacentFog.color);
      scratchColorA.lerp(scratchColorB, t);
      environment.setFogColor(scratchColorA);
      environment.setFogDensity(currentFog.density + (adjacentFog.density - currentFog.density) * t);

      const currentIntensity = resolveIntensity(currentId);
      const adjacentIntensity = adjacentId ? resolveIntensity(adjacentId) : currentIntensity;
      environment.setEnvironmentIntensity(currentIntensity + (adjacentIntensity - currentIntensity) * t);
    }

    // Activity boost: additive on top of camera-sync.js's own continuously-
    // correct per-region baseline (it reacts to every scene-state change,
    // not just 'active') -- only ever lifts, never overrides, and only for
    // the 1-2 regions actually in the corridor. No restore needed: once a
    // region leaves the corridor, camera-sync.js's own baseline is still
    // governing it every tick regardless.
    if (t > 0 && adjacentId) {
      const currentRegion = experience.world.getRegion(currentId);
      const adjacentRegion = experience.world.getRegion(adjacentId);
      if (currentRegion) currentRegion.targetActivityWeight = Math.max(currentRegion.targetActivityWeight, CORRIDOR_ACTIVITY_BOOST);
      if (adjacentRegion) adjacentRegion.targetActivityWeight = Math.max(adjacentRegion.targetActivityWeight, CORRIDOR_ACTIVITY_BOOST);
    }

    // Light-tint crossfade (Goal 6): unlike activity weight, no other
    // system maintains a resting target for light color, so every region
    // needs an explicit target every tick -- either its own home tint, or
    // a blend toward/from whichever chapter it's paired with in the
    // current corridor. Regions without setLightTint (only Delivered,
    // deliberately excluded -- see DeliveredEnvironment.js's own
    // intentional static-update() decision) are skipped gracefully.
    for (const scene of SCENES) {
      const region = experience.world.getRegion(scene.id);
      if (!region?.setLightTint) continue;

      const home = LIGHT_TINTS[scene.id];
      if (!home) continue;

      if (scene.id === currentId && adjacentId) {
        const away = LIGHT_TINTS[adjacentId] ?? home;
        scratchKey.set(home.key).lerp(scratchColorA.set(away.key), t);
        scratchFill.set(home.fill).lerp(scratchColorB.set(away.fill), t);
        region.setLightTint(scratchKey, scratchFill);
      } else if (scene.id === adjacentId) {
        const from = LIGHT_TINTS[currentId] ?? home;
        scratchKey.set(home.key).lerp(scratchColorA.set(from.key), t);
        scratchFill.set(home.fill).lerp(scratchColorB.set(from.fill), t);
        region.setLightTint(scratchKey, scratchFill);
      } else {
        region.setLightTint(home.key, home.fill);
      }
    }
  });
}
