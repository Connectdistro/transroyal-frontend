import { CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, TubeGeometry, Vector3 } from 'three';

const ELECTRIC_400 = 0x4fa3ff;
const OFFWHITE_200 = 0xd7deff;

/** Illuminated route-line conduits (Section 23, Scene 01: "abstract light
 *  conduits threading through the space like the network's own data made
 *  physical"). Two paths tracing the Camera Bible's dominant bottom-left to
 *  top-right sightline, echoing the site's existing SVG route motif in 3D. */
export function createRouteLines() {
  const group = new Group();

  const primaryCurve = new CatmullRomCurve3([
    new Vector3(-9, 0.05, 12),
    new Vector3(-4, 0.05, 2),
    new Vector3(1, 0.05, -10),
    new Vector3(6, 0.05, -22),
    new Vector3(9, 0.05, -34),
  ]);
  const primaryMaterial = new MeshBasicMaterial({ color: ELECTRIC_400, transparent: true, opacity: 0.85 });
  primaryMaterial.userData.baseOpacity = primaryMaterial.opacity;
  const primary = new Mesh(new TubeGeometry(primaryCurve, 120, 0.05, 8, false), primaryMaterial);

  const secondaryCurve = new CatmullRomCurve3([
    new Vector3(-11, 0.05, 6),
    new Vector3(-5, 0.05, -4),
    new Vector3(0, 0.05, -16),
    new Vector3(5, 0.05, -28),
  ]);
  const secondaryMaterial = new MeshBasicMaterial({ color: OFFWHITE_200, transparent: true, opacity: 0.4 });
  secondaryMaterial.userData.baseOpacity = secondaryMaterial.opacity;
  const secondary = new Mesh(new TubeGeometry(secondaryCurve, 100, 0.035, 8, false), secondaryMaterial);

  group.add(primary, secondary);
  group.userData.pulseMaterials = [primary.material, secondary.material];
  return group;
}
