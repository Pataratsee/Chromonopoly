import * as THREE from 'three';
import type { SkyState } from './sky';

/**
 * The floating island is background architecture, not a loadable game object.
 * It is built from low-poly vertex-coloured surfaces and one instanced petal
 * mesh. Nothing here samples a reflection or uploads a texture.
 */
const GRASS = new THREE.MeshStandardMaterial({ color: '#4f7b4a', roughness: 1, flatShading: true });
const GRASS_LIGHT = new THREE.MeshStandardMaterial({ color: '#6b9455', roughness: 1, flatShading: true });
const ROCK = new THREE.MeshStandardMaterial({ color: '#6e6656', roughness: 1, flatShading: true });
const ROCK_DARK = new THREE.MeshStandardMaterial({ color: '#514c42', roughness: 1, flatShading: true });
const STONE = new THREE.MeshStandardMaterial({ color: '#b6ad96', roughness: 0.92, flatShading: true });
const SAND = new THREE.MeshStandardMaterial({ color: '#cfc09a', roughness: 1 });
const WOOD = new THREE.MeshStandardMaterial({ color: '#7f3e2e', roughness: 0.72, flatShading: true });
const RED = new THREE.MeshStandardMaterial({ color: '#c84432', roughness: 0.58, flatShading: true });
const DARK_WOOD = new THREE.MeshStandardMaterial({ color: '#4e3428', roughness: 0.8, flatShading: true });
const PINK = new THREE.MeshStandardMaterial({ color: '#f2a5b8', roughness: 0.88, flatShading: true });
const PINK_LIGHT = new THREE.MeshStandardMaterial({ color: '#ffd0dc', roughness: 0.9, flatShading: true });
const BAMBOO = new THREE.MeshStandardMaterial({ color: '#7e9c48', roughness: 0.8, flatShading: true });
const GLOW = new THREE.MeshStandardMaterial({ color: '#f7c979', emissive: '#f0a33b', emissiveIntensity: 1.2, roughness: 0.5 });
const WATER = new THREE.MeshStandardMaterial({ color: '#3f7d87', roughness: 0.25, metalness: 0.05 });
const GRAVEL = new THREE.MeshStandardMaterial({ color: '#d7d0bd', roughness: 1 });
const SEA = new THREE.MeshStandardMaterial({ color: '#356b78', roughness: 0.55, metalness: 0.08 });
const CLOUD = new THREE.MeshStandardMaterial({ color: '#eef1e8', roughness: 1, transparent: true, opacity: 0.72, depthWrite: false });
const PETAL = new THREE.MeshBasicMaterial({ color: '#ffc0ce', side: THREE.DoubleSide });

function jitter(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function irregularRing(radius: number, segments: number, y: number, seed: number, wobble: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius + jitter(i + seed * 31) * wobble;
    out.push(new THREE.Vector3(Math.cos(angle) * r, y + jitter(i * 3 + seed) * 0.22, Math.sin(angle) * r));
  }
  return out;
}

function stripMesh(top: THREE.Vector3[], bottom: THREE.Vector3[], material: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  const segments = top.length;
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const a = top[i]!;
    const b = top[next]!;
    const c = bottom[i]!;
    const d = bottom[next]!;
    positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    positions.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function capMesh(ring: THREE.Vector3[], center: THREE.Vector3, material: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    positions.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function cliff(): THREE.Group {
  const group = new THREE.Group();
  const ring0 = irregularRing(14.6, 54, -0.32, 1, 0.75);
  const ring1 = irregularRing(14.25, 54, -1.8, 2, 0.95);
  const ring2 = irregularRing(13.3, 54, -3.5, 3, 1.25);
  const ring3 = irregularRing(11.1, 54, -5.9, 4, 1.5);
  const ring4 = irregularRing(7.2, 54, -8.3, 5, 1.6);
  const tip = irregularRing(1.4, 54, -11.2, 6, 0.6);
  group.add(stripMesh(ring0, ring1, GRASS));
  group.add(stripMesh(ring1, ring2, ROCK));
  group.add(stripMesh(ring2, ring3, ROCK_DARK));
  group.add(stripMesh(ring3, ring4, ROCK));
  group.add(stripMesh(ring4, tip, ROCK_DARK));
  return group;
}

function topSurface(): THREE.Mesh {
  // Three concentric shells: a grassy crown and a lighter inner lawn.
  const outer = irregularRing(14.4, 54, -0.34, 9, 0.6);
  const inner = irregularRing(10.5, 54, -0.28, 10, 0.45);
  const crown = capMesh(outer, new THREE.Vector3(0, -0.34, 0), GRASS);
  const lawn = capMesh(inner, new THREE.Vector3(0, -0.27, 0), GRASS_LIGHT);
  crown.add(lawn);
  return crown;
}

function sakura(parent: THREE.Group, radius: number, angle: number, scale: number, seed: number): void {
  const group = new THREE.Group();
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  group.position.set(x, -0.26, z);
  group.scale.setScalar(scale);
  box(group, 0.34, 2.4, 0.34, DARK_WOOD, 0, 1.2, 0);
  for (const [dx, dy, dz, size] of [
    [0, 2.75, 0, 1.7],
    [-0.9, 2.5, 0.25, 1.3],
    [0.85, 2.55, -0.2, 1.2],
    [0.25, 2.25, 0.95, 1.15],
    [-0.3, 2.2, -0.95, 1.05],
  ] as const) {
    const blossom = box(group, size, size * 0.65, size, seed % 2 ? PINK : PINK_LIGHT, dx, dy, dz, (seed + dx) * 0.6);
    blossom.castShadow = false;
  }
  parent.add(group);
}

function stoneLantern(parent: THREE.Group, radius: number, angle: number, scale: number): void {
  const group = new THREE.Group();
  group.position.set(Math.cos(angle) * radius, -0.25, Math.sin(angle) * radius);
  group.rotation.y = -angle;
  group.scale.setScalar(scale);
  box(group, 0.62, 0.22, 0.62, STONE, 0, 0.11, 0);
  box(group, 0.26, 1.05, 0.26, STONE, 0, 0.74, 0);
  box(group, 0.72, 0.18, 0.72, STONE, 0, 1.34, 0);
  box(group, 0.52, 0.6, 0.52, GLOW, 0, 1.7, 0);
  box(group, 0.92, 0.16, 0.92, STONE, 0, 2.06, 0);
  box(group, 0.16, 0.32, 0.16, STONE, 0, 2.3, 0);
  parent.add(group);
}

function torii(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(-8.6, -0.26, 7.9);
  g.rotation.y = -0.6;
  box(g, 0.56, 4.4, 0.56, RED, -1.9, 2.2, 0);
  box(g, 0.56, 4.4, 0.56, RED, 1.9, 2.2, 0);
  box(g, 4.9, 0.42, 0.55, RED, 0, 3.75, 0);
  box(g, 5.5, 0.3, 0.72, DARK_WOOD, 0, 4.15, 0);
  box(g, 4.3, 0.3, 0.4, RED, 0, 3.05, 0);
  parent.add(g);
}

function pagoda(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(9.4, -0.26, -7.5);
  g.rotation.y = 0.55;
  box(g, 2.8, 0.35, 2.8, STONE, 0, 0.18, 0);
  let y = 0.35;
  let size = 2.25;
  for (let tier = 0; tier < 4; tier += 1) {
    box(g, size * 0.72, 1.1, size * 0.72, DARK_WOOD, 0, y + 0.55, 0);
    box(g, size, 0.18, size, RED, 0, y + 1.18, 0);
    // Black roof edges make the silhouette read without a texture.
    box(g, size * 1.08, 0.1, size * 1.08, ROCK_DARK, 0, y + 1.3, 0);
    y += 1.4;
    size *= 0.83;
  }
  box(g, 0.16, 1.3, 0.16, STONE, 0, y + 0.6, 0);
  parent.add(g);
}

function koiPond(parent: THREE.Group): void {
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.4, 22), WATER);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-8.9, -0.19, -7.6);
  parent.add(pond);
  const rim = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.75, 22), SAND);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(-8.9, -0.18, -7.6);
  parent.add(rim);
  const bridge = new THREE.Group();
  bridge.position.set(-8.9, -0.12, -7.6);
  bridge.rotation.y = 0.45;
  for (let i = 0; i < 6; i += 1) box(bridge, 4.4, 0.14, 0.48, WOOD, 0, 0.38 + Math.sin((i / 5) * Math.PI) * 0.22, -1.15 + i * 0.46);
  for (const x of [-1.8, 1.8]) box(bridge, 0.12, 0.85, 0.12, RED, x, 0.85, 0);
  parent.add(bridge);
  // Koi are flat colour dabs, two per pond.
  for (const [x, z, c] of [[-9.7, -8.1, '#f0b24c'], [-8.2, -7.2, '#f2e5d4']] as const) {
    const fish = new THREE.Mesh(new THREE.CircleGeometry(0.34, 8), new THREE.MeshBasicMaterial({ color: c }));
    fish.rotation.x = -Math.PI / 2;
    fish.position.set(x, -0.16, z);
    parent.add(fish);
  }
}

function zenGarden(parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(8.6, -0.24, 8.1);
  box(g, 5.5, 0.16, 4.5, GRAVEL, 0, 0, 0);
  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42 + i * 0.35, 0.46 + i * 0.35, 18), STONE);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-0.8, 0.1, 0);
    g.add(ring);
  }
  box(g, 0.9, 0.6, 0.9, ROCK_DARK, 0.9, 0.3, 0.2);
  box(g, 0.45, 0.9, 0.45, ROCK, 1.5, 0.45, -0.6);
  parent.add(g);
}

function path(parent: THREE.Group): void {
  for (let i = 0; i < 26; i += 1) {
    const angle = -2.5 + i * 0.095;
    const radius = 7.2 + (i % 3) * 0.42;
    const stone = new THREE.Mesh(new THREE.CircleGeometry(0.42, 6), STONE);
    stone.rotation.x = -Math.PI / 2;
    stone.position.set(Math.cos(angle) * radius, -0.255, Math.sin(angle) * radius);
    parent.add(stone);
  }
}

function benchBonsaiChime(parent: THREE.Group): void {
  const bench = new THREE.Group();
  bench.position.set(6.7, -0.26, 11.2);
  bench.rotation.y = 0.35;
  box(bench, 1.8, 0.14, 0.5, WOOD, 0, 0.55, 0);
  box(bench, 0.16, 0.5, 0.16, DARK_WOOD, -0.68, 0.27, 0);
  box(bench, 0.16, 0.5, 0.16, DARK_WOOD, 0.68, 0.27, 0);
  parent.add(bench);

  const bonsai = new THREE.Group();
  bonsai.position.set(11.1, -0.26, 7.8);
  box(bonsai, 0.8, 0.28, 0.6, DARK_WOOD, 0, 0.14, 0);
  box(bonsai, 0.22, 0.85, 0.22, DARK_WOOD, 0.1, 0.65, 0);
  box(bonsai, 1.3, 0.5, 0.8, PINK, 0.05, 1.15, 0);
  box(bonsai, 0.8, 0.3, 0.6, PINK_LIGHT, -0.55, 1.2, 0.1);
  parent.add(bonsai);

  const chime = new THREE.Group();
  chime.position.set(10.2, -0.25, 10.6);
  box(chime, 0.12, 2.4, 0.12, DARK_WOOD, 0, 1.2, 0);
  box(chime, 1.5, 0.12, 0.12, DARK_WOOD, 0, 2.25, 0);
  for (const [x, z] of [[-0.6, 0], [0.6, 0], [0, 0.52]] as const) {
    box(chime, 0.03, 0.65, 0.03, DARK_WOOD, x, 1.9, z);
    box(chime, 0.22, 0.26, 0.22, GLOW, x, 1.52, z);
  }
  parent.add(chime);
}

function bamboo(parent: THREE.Group): void {
  const stems = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), BAMBOO, 18);
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.08, 0.18), BAMBOO, 36);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 18; i += 1) {
    const angle = -0.25 + (i % 9) * 0.13;
    const radius = 12.3 + Math.floor(i / 9) * 0.55;
    dummy.position.set(Math.cos(angle) * radius, 1.45, Math.sin(angle) * radius);
    dummy.rotation.set(0, angle + 0.4, (jitter(i) - 0.5) * 0.08);
    dummy.scale.set(1, 0.8 + jitter(i + 2) * 0.45, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    if (i < 36) {
      dummy.position.y = 2.3 + (i % 5) * 0.18;
      dummy.rotation.set(0.5, angle * 2, 0.45);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
  }
  stems.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  parent.add(stems, leaves);
}

function clouds(parent: THREE.Group): void {
  const count = 46;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), CLOUD, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + jitter(i) * 0.4;
    const radius = 12 + jitter(i + 10) * 30;
    dummy.position.set(Math.cos(angle) * radius, -13 - jitter(i + 3) * 5, Math.sin(angle) * radius);
    dummy.rotation.set(0, jitter(i + 4) * Math.PI, 0);
    dummy.scale.set(3 + jitter(i + 5) * 6, 0.8 + jitter(i + 6) * 1.2, 1.8 + jitter(i + 7) * 3);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  parent.add(mesh);
}

function mountainSilhouette(parent: THREE.Group): void {
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const radius = 58 + (i % 3) * 15;
    const height = 7 + jitter(i) * 11;
    const width = 7 + jitter(i + 1) * 7;
    const positions = [
      -width, 0, -width, width, 0, -width, 0, height, 0,
      width, 0, -width, width, 0, width, 0, height, 0,
      width, 0, width, -width, 0, width, 0, height, 0,
      -width, 0, width, -width, 0, -width, 0, height, 0,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const peak = new THREE.Mesh(geometry, i % 2 ? ROCK : ROCK_DARK);
    peak.position.set(Math.cos(angle) * radius, -19, Math.sin(angle) * radius);
    peak.rotation.y = angle;
    parent.add(peak);
  }
}

export class IslandLayer {
  readonly group = new THREE.Group();
  private readonly petals: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly detail: THREE.Group;
  private readonly lanterns: THREE.MeshStandardMaterial[] = [GLOW];
  private detailVisible = true;

  constructor(scene: THREE.Scene) {
    this.group.name = 'floating-island';
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), SEA);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -18;
    this.group.add(sea);

    this.group.add(cliff());
    this.group.add(topSurface());
    this.detail = new THREE.Group();
    this.detail.name = 'island-detail';
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * Math.PI * 2 + 0.16;
      sakura(this.detail, 9.2 + (i % 3) * 1.35, angle, 0.8 + (i % 4) * 0.09, i);
    }
    for (let i = 0; i < 8; i += 1) stoneLantern(this.detail, 8.2 + (i % 2) * 1.5, (i / 8) * Math.PI * 2 + 0.38, 0.68);
    torii(this.detail);
    pagoda(this.detail);
    koiPond(this.detail);
    zenGarden(this.detail);
    path(this.detail);
    benchBonsaiChime(this.detail);
    bamboo(this.detail);
    this.group.add(this.detail);

    mountainSilhouette(this.group);
    clouds(this.group);

    this.petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.06), PETAL, 90);
    for (let i = 0; i < 90; i += 1) {
      this.dummy.position.set((jitter(i) - 0.5) * 24, 2 + jitter(i + 1) * 8, (jitter(i + 2) - 0.5) * 24);
      this.dummy.updateMatrix();
      this.petals.setMatrixAt(i, this.dummy.matrix);
    }
    this.petals.instanceMatrix.needsUpdate = true;
    this.petals.frustumCulled = false;
    this.group.add(this.petals);
    scene.add(this.group);
  }

  setSky(state: SkyState): void {
    // Cosmetic only: lantern emitted light and cloud brightness, never board lights.
    const night = state.night > 0.4;
    const glow = night ? 2.2 : 0.85;
    for (const mat of this.lanterns) mat.emissiveIntensity = glow;
    CLOUD.opacity = night ? 0.38 : 0.72;
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const distance = camera.position.length();
    const near = distance < 31;
    if (near !== this.detailVisible) {
      this.detailVisible = near;
      this.detail.visible = near;
    }
    for (let i = 0; i < 90; i += 1) {
      const speed = 0.16 + (i % 7) * 0.018;
      const y = 8 - ((time * speed + i * 0.37) % 9);
      const x = (jitter(i) - 0.5) * 24 + Math.sin(time * 0.35 + i) * 0.8;
      const z = (jitter(i + 2) - 0.5) * 24 + Math.cos(time * 0.28 + i) * 0.5;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(0.3 + Math.sin(time + i) * 0.4, time * 0.8 + i, Math.cos(time + i) * 0.4);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.petals.setMatrixAt(i, this.dummy.matrix);
    }
    this.petals.instanceMatrix.needsUpdate = true;
    void dt;
  }

  audit(): { triangles: number; details: number; petals: number; skyOnly: true } {
    let triangles = 0;
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry;
      const index = geometry.getIndex();
      const position = geometry.getAttribute('position');
      const count = index ? index.count : position?.count ?? 0;
      triangles += Math.floor(count / 3) * (object instanceof THREE.InstancedMesh ? object.count : 1);
    });
    return { triangles, details: this.detail.children.length, petals: this.petals.count, skyOnly: true };
  }
}
