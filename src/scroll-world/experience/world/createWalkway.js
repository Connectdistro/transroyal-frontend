import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

const STRUCTURE_COLOR = 0x565b66;
const WALKWAY_WIDTH = 14;
const WALKWAY_Y = 9;
const WALKWAY_Z = -34;

/** The distant suspended walkway (Section 23, Scene 01) -- a single deck
 *  held on two cables, deep in the atrium beyond the rib tunnel. */
export function createWalkway() {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: STRUCTURE_COLOR, roughness: 0.5, metalness: 0.4 });

  const deck = new Mesh(new BoxGeometry(WALKWAY_WIDTH, 0.25, 2.2), material);
  deck.position.set(0, WALKWAY_Y, WALKWAY_Z);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const cableGeometry = new CylinderGeometry(0.04, 0.04, 6, 8);
  [-WALKWAY_WIDTH / 2 + 1, WALKWAY_WIDTH / 2 - 1].forEach((x) => {
    const cable = new Mesh(cableGeometry, material);
    cable.position.set(x, WALKWAY_Y + 3, WALKWAY_Z);
    group.add(cable);
  });

  return group;
}
