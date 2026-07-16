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
  },
};

export const DEFAULT_SHOT_ID = 'origin';
