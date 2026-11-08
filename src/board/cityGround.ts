import * as THREE from 'three';
import {
  BLOCK_RECTS,
  CITY_HALF,
  PARK_HALF,
  ROAD_LINES,
  ROAD_RECTS,
  ROAD_WIDTH,
  SIDEWALK_RECTS,
  isParkRect,
} from './cityPlan';

const ASPHALT = new THREE.MeshStandardMaterial({ color: '#353b3c', roughness: 0.94, metalness: 0 });
const PAVEMENT = new THREE.MeshStandardMaterial({ color: '#b8b3a8', roughness: 0.9, metalness: 0 });
const CURB = new THREE.MeshStandardMaterial({ color: '#ddd4c2', roughness: 0.84, metalness: 0 });
const PAINT = new THREE.MeshStandardMaterial({ color: '#eee9d9', roughness: 0.78, metalness: 0 });
const GRASS = new THREE.MeshStandardMaterial({ color: '#5c7d4f', roughness: 0.98, metalness: 0 });
const BLOCK = new THREE.MeshStandardMaterial({ color: '#8b877c', roughness: 0.95, metalness: 0 });
const PARK = new THREE.MeshStandardMaterial({ color: '#507a47', roughness: 0.98, metalness: 0 });
const STONE = new THREE.MeshStandardMaterial({ color: '#d7cdb9', roughness: 0.82, metalness: 0 });

function flatPlane(
  group: THREE.Group,
  w: number,
  d: number,
  material: THREE.Material,
  x: number,
  z: number,
  y: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * Ground, roads and park platform only. The plan itself has a tested hard
 * exclusion zone, so no asphalt, sidewalk, marking or path can reach the board.
 */
export function createCityGround(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'city-ground';

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), GRASS);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.31;
  ground.receiveShadow = true;
  group.add(ground);

  // A raised park plot reads as the centrepiece, with a low stone border.
  const base = new THREE.Mesh(new THREE.BoxGeometry(PARK_HALF * 2, 0.1, PARK_HALF * 2), STONE);
  base.position.set(0, -0.265, 0);
  base.receiveShadow = true;
  group.add(base);
  flatPlane(group, PARK_HALF * 2 - 0.3, PARK_HALF * 2 - 0.3, PARK, 0, 0, -0.213);
  const wallY = -0.17;
  for (const [x, z, w, d] of [
    [0, -PARK_HALF, PARK_HALF * 2 + 0.16, 0.16],
    [0, PARK_HALF, PARK_HALF * 2 + 0.16, 0.16],
    [-PARK_HALF, 0, 0.16, PARK_HALF * 2],
    [PARK_HALF, 0, 0.16, PARK_HALF * 2],
  ] as Array<[number, number, number, number]>) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), CURB);
    wall.position.set(x, wallY, z);
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);
  }

  for (const rect of BLOCK_RECTS) {
    if (isParkRect(rect)) flatPlane(group, rect.w, rect.d, PARK, rect.x, rect.z, -0.237);
    else flatPlane(group, rect.w, rect.d, BLOCK, rect.x, rect.z, -0.238);
  }

  for (const rect of ROAD_RECTS) flatPlane(group, rect.w, rect.d, ASPHALT, rect.x, rect.z, -0.244);
  for (const rect of SIDEWALK_RECTS) flatPlane(group, rect.w, rect.d, PAVEMENT, rect.x, rect.z, -0.239);

  const dashMatrices: THREE.Matrix4[] = [];
  const stripeMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  const addMatrix = (list: THREE.Matrix4[], x: number, z: number, rotY: number): void => {
    dummy.position.set(x, -0.233, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.updateMatrix();
    list.push(dummy.matrix.clone());
  };

  for (const x of ROAD_LINES) {
    for (let z = -CITY_HALF + 3; z < CITY_HALF; z += 4) addMatrix(dashMatrices, x, z, 0);
  }
  for (const z of ROAD_LINES) {
    for (let x = -CITY_HALF + 3; x < CITY_HALF; x += 4) addMatrix(dashMatrices, x, z, Math.PI / 2);
  }
  // Crosswalks at street corners, all well outside the board plot.
  for (const x of ROAD_LINES) {
    if (Math.abs(x) < 9) continue;
    for (const z of ROAD_LINES) {
      if (Math.abs(z) < 9) continue;
      for (const offset of [-1.05, -0.35, 0.35, 1.05]) addMatrix(stripeMatrices, x, z + offset, 0);
    }
  }

  const dashGeo = new THREE.BoxGeometry(0.1, 0.006, 0.7);
  const dashes = new THREE.InstancedMesh(dashGeo, PAINT, dashMatrices.length);
  dashMatrices.forEach((matrix, i) => dashes.setMatrixAt(i, matrix));
  dashes.instanceMatrix.needsUpdate = true;
  dashes.frustumCulled = false;
  group.add(dashes);

  const stripeGeo = new THREE.BoxGeometry(ROAD_WIDTH * 0.92, 0.007, 0.16);
  const stripes = new THREE.InstancedMesh(stripeGeo, PAINT, stripeMatrices.length);
  stripeMatrices.forEach((matrix, i) => stripes.setMatrixAt(i, matrix));
  stripes.instanceMatrix.needsUpdate = true;
  stripes.frustumCulled = false;
  group.add(stripes);

  // The sidewalk strips are slightly wider than the road at every junction;
  // this soft curb line keeps the grid readable from above.
  for (const x of ROAD_LINES) {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, CITY_HALF * 2), CURB);
      curb.position.set(x + side * (ROAD_WIDTH / 2 + 0.035), -0.231, 0);
      group.add(curb);
    }
  }
  for (const z of ROAD_LINES) {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(CITY_HALF * 2, 0.045, 0.07), CURB);
      curb.position.set(0, -0.231, z + side * (ROAD_WIDTH / 2 + 0.035));
      group.add(curb);
    }
  }

  return group;
}
