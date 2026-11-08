import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loadModel } from '../render/models';
import type { PlayerPublic } from '../game/types';

interface CageView {
  playerId: string;
  group: THREE.Group;
  target: THREE.Vector3;
  dropAt: number;
  liftAt: number | null;
}

const BAR = new THREE.MeshStandardMaterial({ color: '#3b3d42', roughness: 0.35, metalness: 0.7 });
const STONE = new THREE.MeshStandardMaterial({ color: '#d7cdb9', roughness: 0.8, metalness: 0.02 });
const GOLD = new THREE.MeshStandardMaterial({ color: '#d9a63b', roughness: 0.3, metalness: 0.55 });

function easeOutBounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

function signTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7a2f22';
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = '#d9a63b';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 72);
  ctx.fillStyle = '#fff0c9';
  ctx.font = '700 42px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JAIL', 128, 44);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class JailCageLayer {
  private readonly root = new THREE.Group();
  private readonly cages = new Map<string, CageView>();
  private readonly signMap = signTexture();
  private readonly signMat = new THREE.MeshBasicMaterial({ map: this.signMap });

  constructor(scene: THREE.Scene) {
    this.root.name = 'jail-cages';
    scene.add(this.root);
  }

  sync(players: Record<string, PlayerPublic>, jailPoint: THREE.Vector3): void {
    const jailed = Object.values(players)
      .filter((p) => p.inJail && !p.bankrupt)
      .sort((a, b) => a.id.localeCompare(b.id));
    const slots = this.slots(jailed.length);
    const alive = new Set(jailed.map((p) => p.id));
    const now = performance.now();

    for (const [id, cage] of this.cages) {
      if (!alive.has(id) && cage.liftAt === null) cage.liftAt = now;
    }

    jailed.forEach((player, index) => {
      const offset = slots[index] ?? { x: 0, z: 0 };
      const target = new THREE.Vector3(jailPoint.x + offset.x, jailPoint.y + 0.02, jailPoint.z + offset.z);
      let cage = this.cages.get(player.id);
      if (!cage) {
        const group = this.buildCage();
        group.position.set(target.x, target.y + 2.2, target.z);
        group.scale.setScalar(0.01);
        this.root.add(group);
        cage = { playerId: player.id, group, target, dropAt: now, liftAt: null };
        this.cages.set(player.id, cage);
      } else {
        cage.target.copy(target);
        if (cage.liftAt !== null) {
          cage.liftAt = null;
          cage.dropAt = now;
        }
      }
    });
  }

  private slots(count: number): Array<{ x: number; z: number }> {
    if (count <= 1) return [{ x: 0, z: 0 }];
    if (count === 2) return [{ x: -0.27, z: 0 }, { x: 0.27, z: 0 }];
    if (count === 3) return [{ x: -0.26, z: 0.12 }, { x: 0.26, z: 0.12 }, { x: 0, z: -0.26 }];
    if (count === 4) return [{ x: -0.25, z: -0.25 }, { x: 0.25, z: -0.25 }, { x: -0.25, z: 0.25 }, { x: 0.25, z: 0.25 }];
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return { x: Math.cos(a) * 0.3, z: Math.sin(a) * 0.3 };
    });
  }

  private buildCage(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.06, 0.54, 2, 0.04), STONE);
    base.position.y = 0.03;
    base.castShadow = true;
    group.add(base);
    const roof = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.045, 0.56, 2, 0.04), BAR);
    roof.position.y = 0.57;
    group.add(roof);
    const cornerGeo = new RoundedBoxGeometry(0.045, 0.52, 0.045, 2, 0.012);
    for (const [x, z] of [
      [-0.23, -0.23],
      [0.23, -0.23],
      [-0.23, 0.23],
      [0.23, 0.23],
    ]) {
      const post = new THREE.Mesh(cornerGeo, BAR);
      post.position.set(x, 0.31, z);
      group.add(post);
    }
    const barGeo = new RoundedBoxGeometry(0.028, 0.44, 0.028, 2, 0.008);
    for (const side of [-1, 1]) {
      for (let i = -2; i <= 2; i += 1) {
        const a = new THREE.Mesh(barGeo, BAR);
        a.position.set(side * 0.235, 0.31, i * 0.085);
        group.add(a);
        const b = new THREE.Mesh(barGeo, BAR);
        b.position.set(i * 0.085, 0.31, side * 0.235);
        group.add(b);
      }
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.094), this.signMat);
    sign.position.set(0, 0.39, 0.276);
    group.add(sign);
    const lock = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.11, 0.05, 2, 0.014), GOLD);
    lock.position.set(0, 0.24, 0.276);
    group.add(lock);

    void loadModel('jailbars', 0.52)
      .then((model) => {
        for (const [x, z, rot] of [
          [0, -0.235, 0],
          [0, 0.235, Math.PI],
          [-0.235, 0, Math.PI / 2],
          [0.235, 0, -Math.PI / 2],
        ] as Array<[number, number, number]>) {
          const bars = model.clone(true);
          bars.position.set(x, 0.05, z);
          bars.rotation.y = rot;
          group.add(bars);
        }
      })
      .catch((error: unknown) => console.error('[jail] cage model failed', error));
    return group;
  }

  update(now: number): void {
    for (const [id, cage] of this.cages) {
      if (cage.liftAt !== null) {
        const t = Math.min(1, (now - cage.liftAt) / 620);
        cage.group.position.set(cage.target.x, cage.target.y + t * 1.5, cage.target.z);
        cage.group.scale.setScalar(Math.max(0.01, 1 - t));
        if (t >= 1) {
          cage.group.removeFromParent();
          this.cages.delete(id);
        }
        continue;
      }
      const t = Math.min(1, (now - cage.dropAt) / 900);
      const eased = easeOutBounce(t);
      cage.group.position.set(cage.target.x, cage.target.y + (1 - eased) * 2.2, cage.target.z);
      cage.group.scale.setScalar(t < 0.02 ? 0.01 : 1);
    }
  }
}
