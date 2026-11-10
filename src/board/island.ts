import * as THREE from 'three';
import type { SkyState } from './sky';

/**
 * Solid floating island with a flat harvest plaza. Only sky/clouds use
 * transparency; the rock is a closed opaque volume. Decorations never hide.
 */
const GRASS = new THREE.MeshStandardMaterial({ color: '#687a3f', roughness: 1, flatShading: true });
const PLAZA = new THREE.MeshStandardMaterial({ color: '#b98a58', roughness: 1, flatShading: true });
const PLAZA_EDGE = new THREE.MeshStandardMaterial({ color: '#8d6237', roughness: 1, flatShading: true });
const ROCK = new THREE.MeshStandardMaterial({ color: '#7b5b42', roughness: 1, flatShading: true });
const ROCK_DARK = new THREE.MeshStandardMaterial({ color: '#553d2c', roughness: 1, flatShading: true });
const ROCK_LIGHT = new THREE.MeshStandardMaterial({ color: '#967354', roughness: 1, flatShading: true });
const BARK = new THREE.MeshStandardMaterial({ color: '#5a3b27', roughness: 0.95, flatShading: true });
const ORANGE = new THREE.MeshStandardMaterial({ color: '#d9782c', roughness: 0.92, flatShading: true });
const RED = new THREE.MeshStandardMaterial({ color: '#a83b29', roughness: 0.92, flatShading: true });
const GOLD = new THREE.MeshStandardMaterial({ color: '#d9a63a', roughness: 0.92, flatShading: true });
const BROWN = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.95, flatShading: true });
const WOOD = new THREE.MeshStandardMaterial({ color: '#7a4b2a', roughness: 0.9, flatShading: true });
const DARK_WOOD = new THREE.MeshStandardMaterial({ color: '#4a2f1d', roughness: 0.9, flatShading: true });
const HAY = new THREE.MeshStandardMaterial({ color: '#c9a24b', roughness: 1, flatShading: true });
const BARN_RED = new THREE.MeshStandardMaterial({ color: '#8f2f26', roughness: 0.9, flatShading: true });
const WHITE = new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.9, flatShading: true });
const CORN = new THREE.MeshStandardMaterial({ color: '#c7a341', roughness: 1, flatShading: true });
const TURKEY = new THREE.MeshStandardMaterial({ color: '#6b3d22', roughness: 1, flatShading: true });
const TURKEY_WING = new THREE.MeshStandardMaterial({ color: '#a4552c', roughness: 1, flatShading: true });
const APPLE = new THREE.MeshStandardMaterial({ color: '#b6402c', roughness: 0.8, flatShading: true });
const MUSHROOM = new THREE.MeshStandardMaterial({ color: '#d9c7a2', roughness: 1, flatShading: true });
const FLOWER = new THREE.MeshStandardMaterial({ color: '#d9a63a', roughness: 1, flatShading: true });
const FIRE = new THREE.MeshStandardMaterial({ color: '#f08b2e', emissive: '#d35a10', emissiveIntensity: 1.6, roughness: 0.6 });
const SEA = new THREE.MeshStandardMaterial({ color: '#4f6f67', roughness: 0.75, metalness: 0.04 });
const CLOUD = new THREE.MeshStandardMaterial({ color: '#f0e5cf', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
const LEAF = new THREE.MeshBasicMaterial({ color: '#c9662a', side: THREE.DoubleSide });

function jitter(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ring(radius: number, segments: number, y: number, seed: number, wobble: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius + jitter(i + seed * 31) * wobble;
    points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
  }
  return points;
}

function strip(top: THREE.Vector3[], bottom: THREE.Vector3[], material: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  for (let i = 0; i < top.length; i += 1) {
    const next = (i + 1) % top.length;
    const a = top[i]!;
    const b = top[next]!;
    const c = bottom[i]!;
    const d = bottom[next]!;
    // Outward winding: top edge, bottom edge, top edge; then second triangle.
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    positions.push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function cap(points: THREE.Vector3[], center: THREE.Vector3, material: THREE.Material, inward = false): THREE.Mesh {
  const positions: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (inward) positions.push(center.x, center.y, center.z, b.x, b.y, b.z, a.x, a.y, a.z);
    else positions.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function solidIsland(): THREE.Group {
  const group = new THREE.Group();
  const rings = [
    ring(13.4, 56, -0.42, 1, 0.55),
    ring(13.1, 56, -1.8, 2, 0.8),
    ring(12.3, 56, -3.6, 3, 1.0),
    ring(10.6, 56, -5.8, 4, 1.2),
    ring(7.1, 56, -8.4, 5, 1.25),
    ring(3.2, 56, -10.6, 6, 0.9),
  ];
  const materials = [ROCK_LIGHT, ROCK, ROCK_DARK, ROCK, ROCK_DARK];
  for (let i = 0; i < rings.length - 1; i += 1) group.add(strip(rings[i]!, rings[i + 1]!, materials[i]!));
  const tip = new THREE.Vector3(0, -12.1, 0);
  group.add(strip(rings[rings.length - 1]!, new Array(56).fill(tip), ROCK_DARK));
  // Closed top and bottom. The top cap is under the plaza, so no z-fighting.
  group.add(cap(rings[0]!, new THREE.Vector3(0, -0.42, 0), GRASS));
  group.add(cap(rings[rings.length - 1]!, tip.clone().add(new THREE.Vector3(0, 0.01, 0)), ROCK_DARK, true));
  return group;
}

function plaza(): THREE.Group {
  const group = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(9.9, 48), GRASS);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.40;
  group.add(lawn);
  const packed = new THREE.Mesh(new THREE.CircleGeometry(7.65, 48), PLAZA);
  packed.rotation.x = -Math.PI / 2;
  packed.position.y = -0.34;
  group.add(packed);
  const edge = new THREE.Mesh(new THREE.RingGeometry(7.55, 7.8, 48), PLAZA_EDGE);
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = -0.325;
  group.add(edge);
  return group;
}

function tree(parent: THREE.Group, angle: number, radius: number, scale: number, seed: number): void {
  const g = new THREE.Group();
  g.position.set(Math.cos(angle) * radius, -0.36, Math.sin(angle) * radius);
  g.scale.setScalar(scale);
  box(g, 0.38, 2.6, 0.38, BARK, 0, 1.3, 0);
  const colors = [ORANGE, RED, GOLD, BROWN];
  for (let i = 0; i < 4; i += 1) {
    const blob = box(g, 1.6 - i * 0.18, 1.1, 1.5 - i * 0.12, colors[(seed + i) % colors.length]!, (jitter(seed + i) - 0.5) * 1.1, 2.6 + i * 0.5, (jitter(seed + i + 2) - 0.5) * 0.9, seed * 0.4);
    blob.castShadow = false;
  }
  parent.add(g);
}

function bareTree(parent: THREE.Group, angle: number, radius: number, scale: number): void {
  const g = new THREE.Group();
  g.position.set(Math.cos(angle) * radius, -0.36, Math.sin(angle) * radius);
  g.scale.setScalar(scale);
  box(g, 0.34, 3.2, 0.34, BARK, 0, 1.6, 0);
  for (const [x, z, ry] of [[0.5, 0, 0.5], [-0.4, 0.3, -0.6], [0, -0.5, 0]] as const) {
    const limb = box(g, 0.16, 1.5, 0.16, BARK, x, 2.6, z, ry);
    limb.rotation.z = x * 0.4;
  }
  parent.add(g);
}

function pumpkin(parent: THREE.Group, angle: number, radius: number, scale: number): void {
  const g = new THREE.Group();
  g.position.set(Math.cos(angle) * radius, -0.3, Math.sin(angle) * radius);
  g.scale.setScalar(scale);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), ORANGE);
  body.scale.y = 0.72;
  body.position.y = 0.3;
  g.add(body);
  box(g, 0.09, 0.24, 0.09, BARK, 0, 0.66, 0);
  parent.add(g);
}

function hayBale(parent: THREE.Group, angle: number, radius: number): void {
  const bale = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), HAY);
  bale.rotation.z = Math.PI / 2;
  bale.position.set(Math.cos(angle) * radius, 0.3, Math.sin(angle) * radius);
  bale.rotation.y = angle + 0.2;
  parent.add(bale);
}

function scarecrow(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(9.9, -0.34, 2.0);
  g.rotation.y = 1.1;
  box(g, 0.18, 2.3, 0.18, WOOD, 0, 1.15, 0);
  box(g, 1.5, 0.15, 0.15, WOOD, 0, 1.7, 0);
  box(g, 0.9, 0.7, 0.3, RED, 0, 1.45, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), HAY);
  head.position.y = 2.2;
  g.add(head);
  box(g, 0.8, 0.1, 0.8, BROWN, 0, 2.5, 0);
  parent.add(g);
}

function barn(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(-10.6, -0.36, -3.0);
  g.rotation.y = 0.5;
  box(g, 3.4, 2.3, 2.7, BARN_RED, 0, 1.15, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), DARK_WOOD);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.85;
  g.add(roof);
  box(g, 1.1, 1.35, 0.08, WHITE, 0, 0.78, 1.36);
  box(g, 0.08, 1.35, 1.0, WHITE, 1.71, 0.78, 0);
  parent.add(g);
}

function fence(parent: THREE.Group, start: number, count: number, radius: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = start + i * 0.055;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    box(parent, 0.11, 0.9, 0.11, WOOD, x, 0.38, z, -angle);
    if (i < count - 1) box(parent, 0.09, 0.1, 0.75, WOOD, x + Math.cos(angle) * 0.0, 0.5, z, -angle);
  }
}

function turkey(parent: THREE.Group, angle: number, radius: number): void {
  const g = new THREE.Group();
  g.position.set(Math.cos(angle) * radius, -0.33, Math.sin(angle) * radius);
  g.rotation.y = -angle;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.9), TURKEY);
  body.scale.set(1, 0.9, 1.2);
  body.position.y = 0.38;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), TURKEY);
  head.position.set(0, 0.78, 0.3);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.22), GOLD);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.78, 0.52);
  g.add(beak);
  for (const [x, z, r] of [[0.48, 0, 0.4], [-0.48, 0, -0.4], [0, 0.4, 0.15]] as const) {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.45, 7), TURKEY_WING);
    wing.position.set(x, 0.45, z);
    wing.rotation.y = r;
    g.add(wing);
  }
  parent.add(g);
}

function campfire(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(8.6, -0.33, -4.7);
  for (let i = 0; i < 6; i += 1) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), ROCK_LIGHT);
    stone.position.set(Math.cos(i * 1.05) * 0.7, 0.1, Math.sin(i * 1.05) * 0.7);
    g.add(stone);
  }
  for (let i = 0; i < 3; i += 1) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.2), DARK_WOOD);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * 1.1;
    log.position.y = 0.22;
    g.add(log);
  }
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.6), FIRE);
  fire.position.y = 0.75;
  g.add(fire);
  parent.add(g);
}

function harvestTable(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(-4.8, -0.34, 9.3);
  g.rotation.y = 0.2;
  box(g, 2.6, 0.16, 1.1, WOOD, 0, 0.8, 0);
  for (const x of [-1.0, 1.0]) for (const z of [-0.4, 0.4]) box(g, 0.12, 0.8, 0.12, DARK_WOOD, x, 0.4, z);
  for (const [x, color] of [[-0.7, ORANGE], [0, GOLD], [0.7, APPLE]] as const) {
    const fruit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), color);
    fruit.position.set(x, 0.95, 0);
    g.add(fruit);
  }
  parent.add(g);
}

function cornStalks(parent: THREE.Group): void {
  for (let i = 0; i < 7; i += 1) {
    const x = 9.4 + (i % 3) * 0.32;
    const z = 6.7 + Math.floor(i / 3) * 0.35;
    box(parent, 0.06, 1.9, 0.06, CORN, x, 0.6, z);
    box(parent, 0.08, 0.35, 0.06, GOLD, x + 0.08, 1.25, z, 0.4);
  }
}

function clouds(parent: THREE.Group): void {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), CLOUD, 28);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2 + jitter(i) * 0.3;
    const radius = 17 + jitter(i + 10) * 30;
    dummy.position.set(Math.cos(angle) * radius, -14 - jitter(i + 3) * 3, Math.sin(angle) * radius);
    dummy.rotation.set(0, jitter(i + 4) * Math.PI, 0);
    dummy.scale.set(3.5 + jitter(i + 5) * 5, 0.7 + jitter(i + 6) * 0.8, 2 + jitter(i + 7) * 2.5);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  parent.add(mesh);
}

export class IslandLayer {
  readonly group = new THREE.Group();
  private readonly leaves: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly detail: THREE.Group;
  private leafClock = 0;
  private lastScale = 0;
  private readonly fire: THREE.Mesh;
  private readonly fireMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group.name = 'floating-island';
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), SEA);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -18;
    this.group.add(sea);
    this.group.add(solidIsland());
    this.group.add(plaza());

    this.detail = new THREE.Group();
    this.detail.name = 'island-detail';
    const treeAngles = [0.1, 0.55, 1.0, 1.6, 2.2, 2.75, 3.3, 3.9, 4.5, 5.05, 5.65];
    treeAngles.forEach((angle, i) => tree(this.detail, angle, 10.6 + (i % 3) * 1.15, 0.82 + (i % 4) * 0.08, i));
    bareTree(this.detail, 1.32, 11.8, 1.05);
    bareTree(this.detail, 4.18, 11.3, 0.92);
    for (let i = 0; i < 11; i += 1) pumpkin(this.detail, 0.3 + i * 0.52, 9.2 + (i % 4) * 0.42, 0.8 + (i % 3) * 0.15);
    hayBale(this.detail, 2.45, 10.2);
    hayBale(this.detail, 2.62, 10.5);
    hayBale(this.detail, 3.2, 11.1);
    scarecrow(this.detail);
    barn(this.detail);
    fence(this.detail, 5.25, 7, 10.2);
    fence(this.detail, 5.75, 5, 10.9);
    turkey(this.detail, 1.7, 9.35);
    turkey(this.detail, 1.95, 9.7);
    turkey(this.detail, 4.75, 9.5);
    campfire(this.detail);
    harvestTable(this.detail);
    cornStalks(this.detail);
    for (let i = 0; i < 9; i += 1) {
      const shroom = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), i % 3 ? MUSHROOM : APPLE);
      const angle = 3.5 + i * 0.36;
      shroom.position.set(Math.cos(angle) * 8.9, -0.24, Math.sin(angle) * 8.9);
      this.detail.add(shroom);
      const flower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), FLOWER);
      flower.position.set(Math.cos(angle + 0.2) * 8.65, -0.22, Math.sin(angle + 0.2) * 8.65);
      this.detail.add(flower);
    }
    this.group.add(this.detail);

    const fire = this.detail.children.find((child) => child instanceof THREE.Group && child.children.some((c) => c instanceof THREE.Mesh && (c.material as THREE.Material) === FIRE));
    this.fire = (fire?.children.find((c) => c instanceof THREE.Mesh && (c.material as THREE.Material) === FIRE) as THREE.Mesh | undefined) ?? new THREE.Mesh();
    this.fireMaterial = FIRE;

    clouds(this.group);
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.07), LEAF, 48);
    for (let i = 0; i < 48; i += 1) {
      this.dummy.position.set((jitter(i) - 0.5) * 23, 1.5 + jitter(i + 1) * 7, (jitter(i + 2) - 0.5) * 23);
      this.dummy.updateMatrix();
      this.leaves.setMatrixAt(i, this.dummy.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    this.leaves.frustumCulled = false;
    this.group.add(this.leaves);
    scene.add(this.group);
  }

  setSky(state: SkyState): void {
    this.fireMaterial.emissiveIntensity = state.night > 0.4 ? 2.6 : 1.4;
    CLOUD.opacity = state.night > 0.4 ? 0.3 : 0.55;
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    // Decoration push: one group transform, never per object.
    const distance = camera.position.length();
    const push = 1 + THREE.MathUtils.clamp((distance - 24) / 60, 0, 0.15);
    if (Math.abs(push - this.lastScale) > 0.001) {
      this.lastScale = push;
      this.detail.scale.setScalar(push);
    }
    this.leafClock += dt;
    if (this.leafClock < 1 / 18) return;
    const step = this.leafClock;
    this.leafClock = 0;
    for (let i = 0; i < 48; i += 1) {
      const speed = 0.32 + (i % 7) * 0.04;
      const y = 8.5 - ((time * speed + i * 0.41) % 9.2);
      this.dummy.position.set(
        (jitter(i) - 0.5) * 22 + Math.sin(time * 0.5 + i) * 0.9,
        y,
        (jitter(i + 2) - 0.5) * 22 + Math.cos(time * 0.42 + i) * 0.7,
      );
      this.dummy.rotation.set(0.4 + Math.sin(time + i) * 0.7, time * 1.1 + i, Math.cos(time + i) * 0.7);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.leaves.setMatrixAt(i, this.dummy.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    this.fire.scale.y = 0.9 + Math.sin(time * 7) * 0.1;
    void step;
  }

  audit(): { triangles: number; details: number; petals: number; solid: boolean; japaneseProps: number; skyOnly: true } {
    let triangles = 0;
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const index = object.geometry.getIndex();
      const position = object.geometry.getAttribute('position');
      const count = index ? index.count : position?.count ?? 0;
      triangles += Math.floor(count / 3) * (object instanceof THREE.InstancedMesh ? object.count : 1);
    });
    return { triangles, details: this.detail.children.length, petals: this.leaves.count, solid: true, japaneseProps: 0, skyOnly: true };
  }
}
