import { CircleGeometry, Mesh, MeshPhysicalMaterial } from 'three';

const NAVY_800 = 0x101a6e;
const FLOOR_RADIUS = 42;

/** The Command Center's rotunda floor (Production Handbook Section 23,
 *  Scene 01). Clearcoat gives a wet-look glossy read under the two-source
 *  lighting without an environment map -- reflections stay tinted by the
 *  key/fill lights rather than a neutral mirror highlight. Base color sits
 *  one step up from the deepest navy so the two lights have something to
 *  reveal -- a pure navy-950 floor under a metallic finish reads as an
 *  unlit void rather than a legible reflective surface. */
export function createFloor() {
  const geometry = new CircleGeometry(FLOOR_RADIUS, 64);
  const material = new MeshPhysicalMaterial({
    color: NAVY_800,
    metalness: 0.3,
    roughness: 0.28,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });

  const floor = new Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}
