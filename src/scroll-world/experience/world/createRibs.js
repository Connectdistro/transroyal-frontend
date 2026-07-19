import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { varyMaterial } from './materialVariation.js';

const STRUCTURE_COLOR = 0x565b66;
const ELECTRIC_500 = 0x2f8bff;

const RIB_COUNT = 7;
const RIB_SPACING = 6;
const RIB_BASE_WIDTH = 9;
const RIB_BASE_HEIGHT = 7;
const RIB_GROWTH = 0.35;

/** The atrium's repeating structural ribs (Section 23, Scene 01: "soaring
 *  structural volume, illuminated ribs"). A receding row of arches, each
 *  slightly larger than the last, carrying a thin illuminated strip along
 *  its top beam -- the repeating rhythm the Material Bible calls for. */
export function createRibs() {
  const group = new Group();
  const baseStructureMaterial = new MeshStandardMaterial({ color: STRUCTURE_COLOR, roughness: 0.55, metalness: 0.35 });
  const glowMaterial = new MeshBasicMaterial({ color: ELECTRIC_500 });

  for (let i = 0; i < RIB_COUNT; i += 1) {
    const width = RIB_BASE_WIDTH + i * RIB_GROWTH;
    const height = RIB_BASE_HEIGHT + i * RIB_GROWTH * 0.6;
    const z = -i * RIB_SPACING - 4;

    // Choreography Refinement Pass: previously one shared material across
    // all seven arches -- the one repeating element in the project with no
    // per-instance variation at all. Cloned + varied per rib, the same
    // technique Ground's hub silhouettes and Sorting's parcels already use.
    const structureMaterial = baseStructureMaterial.clone();
    varyMaterial(structureMaterial, 960 + i);

    const post = new BoxGeometry(0.5, height, 0.5);
    const leftPost = new Mesh(post, structureMaterial);
    leftPost.position.set(-width / 2, height / 2, z);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;

    const rightPost = new Mesh(post, structureMaterial);
    rightPost.position.set(width / 2, height / 2, z);
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;

    const beam = new Mesh(new BoxGeometry(width + 0.5, 0.5, 0.5), structureMaterial);
    beam.position.set(0, height, z);
    beam.castShadow = true;

    const glow = new Mesh(new BoxGeometry(width - 0.6, 0.06, 0.12), glowMaterial);
    glow.position.set(0, height - 0.32, z + 0.32);

    group.add(leftPost, rightPost, beam, glow);
  }

  return group;
}
