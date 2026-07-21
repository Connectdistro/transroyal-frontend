import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';

// Matches Pickup/Ground/Air's own hero-cargo hex exactly (0x2f5fae) --
// "the same shipment," here at its very first chapter. Only Sorting's own
// decision-moment parcel shares this convention too (fixed in the
// Cinematic Cohesion pass) -- this is the one remaining chapter that had
// no shipment object of any kind before this.
const PARCEL_COLOR = 0x2f5fae;

/** The one physical object in the Command Center that isn't structure,
 *  light, or a data conduit -- resting beside the primary route line's own
 *  second curve vertex (createRouteLines.js), reading as "about to begin
 *  its journey" rather than mid-motion, matching this chapter's own
 *  economy of motion (ambient particle drift and route-line pulse only,
 *  no interactive beats). Static, like Delivered's own createParcel() --
 *  the two bookend chapters both hold their shipment at rest rather than
 *  mid-handoff. Deliberately NOT at the route line's first vertex
 *  (-9, 0.05, 12) -- confirmed via a live screenshot of the actual `origin`
 *  camera shot (shots.js: position {4.2,4,19}, target {-6,0.6,-14}) that
 *  point sits far outside the frustum (~45deg off the camera's own look
 *  vector); the second vertex sits only ~12deg off-axis and is genuinely
 *  in frame. */
export function createOriginParcel() {
  const material = new MeshStandardMaterial({ color: PARCEL_COLOR, roughness: 0.5, metalness: 0.2 });
  const parcel = new Mesh(new BoxGeometry(0.9, 0.7, 0.7), material);
  parcel.position.set(-4, 0.35, 2);
  parcel.castShadow = true;
  parcel.receiveShadow = true;
  return parcel;
}
