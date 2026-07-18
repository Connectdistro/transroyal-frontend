import { Color, Vector3 } from 'three';
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

// Choreography Refinement Pass: scratch Vector3s for the camera position/
// target blend below -- same zero-per-frame-allocation shape as the Color
// scratches above.
const scratchPosition = new Vector3();
const scratchAdjacentPosition = new Vector3();
const scratchTarget = new Vector3();
const scratchAdjacentTarget = new Vector3();

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
    // Which corridor branch we're in also determines the *direction* of
    // travel (Commit 4's setNeighborInfluence below): the top-of-section
    // branch means the current chapter just entered from the previous one;
    // the bottom-of-section branch means the current chapter is about to
    // leave toward the next one. Same `t`/`adjacentId` shape as before this
    // commit -- this flag is additive, not a behavior change to fog/
    // environmentIntensity/activity-boost/light-tint below.
    let adjacentIsNext = false;
    if (progress < CORRIDOR && currentIndex > 0) {
      t = 1 - progress / CORRIDOR;
      adjacentId = SCENES[currentIndex - 1].id;
    } else if (progress > 1 - CORRIDOR && currentIndex < SCENES.length - 1) {
      t = (progress - (1 - CORRIDOR)) / CORRIDOR;
      adjacentId = SCENES[currentIndex + 1].id;
      adjacentIsNext = true;
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

    // Choreography Refinement Pass: the one piece this phase's own doc
    // comment (top of file) left as camera-sync.js's "later milestone" --
    // camera position/target/fov now blend continuously across the exact
    // same corridor as fog/light-tint above, computing lerp(current,
    // adjacent, t) unconditionally every tick (not only while t > 0),
    // which collapses to exactly the current shot's own resting values
    // once t reaches 0 -- no separate restore branch, same reasoning the
    // fog block above already documents. camera-sync.js's own discrete
    // setShot() call keeps firing exactly as before on scene-state
    // 'active'; it becomes a harmless, immediately-superseded coarse
    // nudge once this runs every tick (CameraRig.setCorridorBlend()'s own
    // doc has the full "continuous always wins" reasoning).
    if (experience.camera) {
      const currentShot = SHOTS[currentId];
      if (currentShot) {
        const adjacentShot = adjacentId ? SHOTS[adjacentId] : currentShot;
        scratchPosition.set(currentShot.position.x, currentShot.position.y, currentShot.position.z);
        scratchAdjacentPosition.set(adjacentShot.position.x, adjacentShot.position.y, adjacentShot.position.z);
        scratchPosition.lerp(scratchAdjacentPosition, t);

        scratchTarget.set(currentShot.target.x, currentShot.target.y, currentShot.target.z);
        scratchAdjacentTarget.set(adjacentShot.target.x, adjacentShot.target.y, adjacentShot.target.z);
        scratchTarget.lerp(scratchAdjacentTarget, t);

        const fov = currentShot.fov + (adjacentShot.fov - currentShot.fov) * t;
        experience.camera.setCorridorBlend(scratchPosition, scratchTarget, fov);
      }
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
      if (!region) continue;

      // Cinematic Motion Refinement Phase, Commit 4: an optional, no-op-by-
      // default hook letting a region react to an upcoming/departing
      // neighbor -- today only AirEnvironment.js implements it (see its
      // own doc). Called every tick for every region, including an
      // explicit (0, null, null) reset once a region is neither the
      // current nor adjacent scene, the same explicit-reset shape the
      // light-tint loop below already uses (no automatic collapse-at-t=0
      // here, since unlike fog/environmentIntensity there's no other
      // continuously-running owner of this value). Direction depends on
      // which corridor branch produced adjacentId (adjacentIsNext above),
      // not just the current/adjacent role -- the current chapter is
      // 'entering' (just arrived from the previous one) in the top-of-
      // section branch, or 'leaving' (about to hand off to the next one)
      // in the bottom-of-section branch; the adjacent chapter always gets
      // the opposite label.
      if (region.setNeighborInfluence) {
        if (scene.id === currentId && adjacentId) {
          region.setNeighborInfluence(t, adjacentId, adjacentIsNext ? 'leaving' : 'entering');
        } else if (scene.id === adjacentId) {
          region.setNeighborInfluence(t, currentId, adjacentIsNext ? 'entering' : 'leaving');
        } else {
          region.setNeighborInfluence(0, null, null);
        }
      }

      if (!region.setLightTint) continue;

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
