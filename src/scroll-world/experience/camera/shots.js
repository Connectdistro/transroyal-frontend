// Shot definitions for the Production Camera (Production Handbook Section 11:
// "one camera... it never cuts", and Section 23's per-chapter framing specs).
// The camera rig (CameraRig.js) never hard-codes a scene's numbers -- it only
// knows how to look up a shot by id and ease toward it. Adding a chapter's
// shot, once that chapter's world exists, is a config-only change here.
//
// Each shot: `fov` (degrees, Section 11's lens spec), `near`/`far` clip, and
// `position`/`target` (world-space meters) -- the camera's eye and the point
// it looks at, kept as separate authored values per the rig's position/target
// split.
// Cinematic Integration Phase, Commit 4: the intra-chapter drift/parallax
// every shot gets by default (CameraRig.js resolves this once per shot
// change, merging any per-shot `drift` override over these fields
// individually -- a shot may override just `amplitude` and still inherit
// the default `speed`/`axis`). `amplitude` is in world units (this scene's
// human scale runs close to meters -- see delivered's camera `y: 1.9`
// below); `speed` is a multiplier on CameraRig's own oscillation period;
// `axis` is a direction (normalized by CameraRig, not here) the sway
// travels along -- biased slightly more horizontal than vertical by
// default. Applied only to the live camera position (see CameraRig.js),
// never to `shots.js`'s own authored position/target/fov values below,
// which stay exactly as specified regardless of drift.
export const DEFAULT_DRIFT = { amplitude: 0.25, speed: 1, axis: { x: 1, y: 0.6, z: 0 } };

// Cinematic Polish Phase, Commit 1: per-chapter target key/fill light tint,
// crossfaded continuously by scene-blend.js as the visitor approaches or
// leaves a chapter (Goal 6's "lighting evolves, never switches"). Values
// are deliberately still within the brand's existing electric/royal-blue
// family (createLights.js's own "two sources... never a third" doctrine is
// a fixed identity constraint, not something this phase repaints) --
// "sunrise/golden/sunset" is expressed as a subtle warm bias within that
// family, "cool blue atmosphere" as a subtle cool bias, rather than a
// literal orange-to-blue repaint. `air`'s tint intentionally matches its
// own existing fog override color (0x4a63a8) for continuity between the
// two already-related atmospheric properties.
export const LIGHT_TINTS = {
  origin: { key: 0x5a8fff, fill: 0x3a52c2 }, // warm sunrise
  pickup: { key: 0x4fa3ff, fill: 0x2f4fc0 }, // bright morning
  sorting: { key: 0x3f6fe0, fill: 0x2540b0 }, // industrial neutral
  ground: { key: 0x5a8fe0, fill: 0x3654d6 }, // golden afternoon
  air: { key: 0x4a63a8, fill: 0x2540b0 }, // cool blue atmosphere
  'final-mile': { key: 0x4a7fe0, fill: 0x2f4fc0 }, // late-afternoon warmth
  delivered: { key: 0x5a8fff, fill: 0x2f4fc0 }, // warm sunset, echoes origin
};

export const SHOTS = {
  origin: {
    // Section 23, Scene 01: "Elevated command-deck vantage... 35mm baseline,
    // 5-12deg downward tilt." Numbers unchanged from the original
    // OriginEnvironment.frameCamera() -- moved here, not re-tuned.
    fov: 35,
    near: 0.1,
    far: 1000,
    position: { x: 4.2, y: 4, z: 19 },
    target: { x: -6, y: 0.6, z: -14 },
    // Calm opening beat -- slower and smaller than the default sway.
    drift: { amplitude: 0.12, speed: 0.7 },
    environmentIntensity: 1,
  },
  pickup: {
    // Section 23, Scene 02: "Ground-adjacent elevated vantage, roughly 2.5
    // meters, looking outward from the dock toward the vehicle and street
    // beyond." 35mm baseline (no exception for this chapter). Pulled back
    // further from the dock than a literal 2.5m read would suggest -- the
    // Art Direction Bible (Addendum 32.2) calls for negative space as most
    // of the frame; a closer position let the dock geometry fill the frame
    // edge-to-edge with no breathing room. Shot ids match config.js scene
    // ids 1:1 -- see camera-sync.js.
    fov: 35,
    near: 0.1,
    far: 1000,
    position: { x: -14, y: 3.4, z: -68 },
    target: { x: 7, y: 1, z: -100 },
    environmentIntensity: 0.9,
  },
  sorting: {
    // Section 23, Scene 03: "Elevated mezzanine vantage, roughly 3.5 meters,
    // tilted 8-10 down a sorting line, held in a wide, steady frame."
    fov: 35,
    near: 0.1,
    far: 1000,
    position: { x: -16, y: 4.6, z: -150 },
    target: { x: 6, y: 1.5, z: -205 },
    environmentIntensity: 0.8,
  },
  ground: {
    // Section 23, Scene 04: "Full elevated establishing height, roughly 3.5
    // meters, 28-35mm, low horizon carried through the frame." Pulled well
    // back from the highway's own near edge (fleet spans roughly z -240 to
    // -340) so a moving truck can never loom into the foreground and
    // overwhelm the frame -- the first attempt at this distance put a truck
    // only ~7 units from camera at load, reading as a cluttered mass of
    // boxes rather than a legible fleet on a highway.
    fov: 38,
    near: 0.1,
    far: 1000,
    position: { x: -26, y: 6.5, z: -225 },
    target: { x: 12, y: 1.5, z: -340 },
    environmentIntensity: 1,
  },
  air: {
    // Section 23, Scene 05: "True aerial altitude, 60 meters equivalent or
    // higher... 24mm wide lens... near-level tilt, 3-5, matching a
    // cruising-altitude read." The one chapter permitted both exceptions
    // (Section 11).
    fov: 62,
    near: 0.1,
    far: 2000,
    position: { x: -10, y: 72, z: -380 },
    target: { x: 30, y: 66, z: -560 },
    // The shared global fog (Environment.js) is tuned for the close-range
    // chapters; at full density it fully saturates this chapter's much
    // larger distances to flat fog color well before the horizon. Lighter
    // and less dense here reads as true-altitude haze instead of a solid
    // wash -- restored to the shared default by camera-sync.js on leaving.
    fog: { color: 0x4a63a8, density: 0.006 },
    // The journey's most expansive beat -- larger, slightly quicker sway,
    // matching this shot's own already-larger scale.
    drift: { amplitude: 0.5, speed: 1.2 },
    // True altitude, brightest open sky of the journey -- the strongest
    // environment-reflection read of any chapter.
    environmentIntensity: 1.5,
  },
  'final-mile': {
    // Section 23, Scene 06: "Elevated operational vantage, roughly 2.5-3
    // meters -- the same height and lens family as Pickup, closing the
    // journey's human-scale bracket." Same relative offsets as Pickup's own
    // shot, applied to this chapter's REGION_Z.
    fov: 35,
    near: 0.1,
    far: 1000,
    position: { x: -14, y: 3.2, z: -673 },
    target: { x: 7, y: 1.3, z: -705 },
    environmentIntensity: 0.9,
  },
  delivered: {
    // Section 23, Scene 07: "The lowest vantage in the entire journey, just
    // under 2 meters, near eye-level, held perfectly static -- no tilt, no
    // residual drift." Target y matches camera y exactly -- level, not
    // tilted, unlike every other chapter's shot.
    fov: 35,
    near: 0.1,
    far: 1000,
    position: { x: -6, y: 1.9, z: -782 },
    target: { x: 4, y: 1.9, z: -806 },
    // This shot's own framing above already calls for "held perfectly
    // static... no residual drift" -- amplitude 0 makes that literal
    // rather than incidental.
    drift: { amplitude: 0 },
    // Warm, settled resolution -- closes the loop toward origin's own tint.
    environmentIntensity: 1.1,
  },
};

export const DEFAULT_SHOT_ID = 'origin';
