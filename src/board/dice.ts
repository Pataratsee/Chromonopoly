import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type PipFace = 1 | 2 | 3 | 4 | 5 | 6;

const PIPS: Record<PipFace, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function faceTexture(value: PipFace): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#221b18';
  for (const [x, y] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(64 + x * 29, 64 + y * 29, 10.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const FACE_ORDER: PipFace[] = [3, 4, 1, 6, 2, 5];
const FACE_EULER: Record<PipFace, THREE.Euler> = {
  1: new THREE.Euler(0, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2),
};

interface Die {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  target: THREE.Quaternion;
  value: number;
  spin: THREE.Vector3;
}

/**
 * Two physical dice on the board centre. The cube is a licensed-free,
 * bevelled game die with painted pips; it is not assembled from a stack of
 * primitives and it only appears for the player who rolled.
 */
export class DiceLayer {
  readonly group = new THREE.Group();
  private readonly dice: Die[] = [];
  private readonly textureCache = new Map<PipFace, THREE.CanvasTexture>();
  private rolling = false;
  private started = 0;
  private settledAt = 0;
  private pending: [number, number] | null = null;
  private settleWaiters: Array<() => void> = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'table-dice';
    this.group.position.set(0, 0.02, 0.6);
    this.group.visible = false;
    scene.add(this.group);

    const geometry = new RoundedBoxGeometry(0.72, 0.72, 0.72, 5, 0.1);
    for (let i = 0; i < 2; i += 1) {
      this.textureCache.clear();
      const materials = FACE_ORDER.map((face) => {
        let texture = this.textureCache.get(face);
        if (!texture) {
          texture = faceTexture(face);
          this.textureCache.set(face, texture);
        }
        return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.02 });
      });
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.dice.push({
        mesh,
        base: new THREE.Vector3(i === 0 ? -0.48 : 0.48, 0.42, i === 0 ? 0.08 : -0.06),
        target: new THREE.Quaternion(),
        value: 1,
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
      });
    }

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false });
    for (const die of this.dice) {
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(die.base.x, 0.002, die.base.z);
      shadow.scale.set(1, 0.7, 1);
      this.group.add(shadow);
    }
  }

  start(): void {
    this.rolling = true;
    this.pending = null;
    this.started = performance.now();
    this.settledAt = 0;
    this.group.visible = true;
    for (const die of this.dice) {
      die.mesh.position.set(die.base.x, 1.6, die.base.z);
      die.mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
      die.spin.set(9 + Math.random() * 8, 8 + Math.random() * 9, 7 + Math.random() * 8);
    }
  }

  settle(values: [number, number]): void {
    this.pending = values;
    for (let i = 0; i < 2; i += 1) {
      const die = this.dice[i];
      if (!die) continue;
      const value = Math.max(1, Math.min(6, values[i] ?? 1)) as PipFace;
      die.value = value;
      die.target.setFromEuler(FACE_EULER[value]);
    }
    if (performance.now() - this.started > 850) {
      this.finish();
    }
  }

  private finish(): void {
    this.pending = null;
    this.rolling = false;
    this.settledAt = performance.now();
    for (const die of this.dice) {
      die.mesh.position.set(die.base.x, die.base.y, die.base.z);
      die.mesh.quaternion.copy(die.target);
    }
    const waiters = this.settleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }

  /** The turn sequencer waits for the physical dice, not a UI timer. */
  whenSettled(timeoutMs = 2500): Promise<void> {
    if (!this.rolling && this.settledAt) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        resolve();
      };
      this.settleWaiters.push(finish);
      window.setTimeout(finish, timeoutMs);
    });
  }

  update(dt: number, now: number): void {
    if (!this.group.visible) return;
    if (this.rolling) {
      const elapsed = (now - this.started) / 1000;
      const t = Math.min(1, elapsed / 0.9);
      if (t >= 1 && this.pending) {
        this.finish();
      } else {
        for (const die of this.dice) {
          const bounce = Math.abs(Math.sin(elapsed * 9 + die.base.x * 5)) * (1 - t);
          die.mesh.position.x = die.base.x + Math.sin(elapsed * 4 + die.base.z) * 0.16 * (1 - t);
          die.mesh.position.z = die.base.z + Math.cos(elapsed * 3.4 + die.base.x) * 0.16 * (1 - t);
          die.mesh.position.y = 0.42 + bounce * 1.25;
          die.mesh.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), die.spin.x * dt * (1 - t * 0.55));
          die.mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), die.spin.y * dt * (1 - t * 0.55));
          die.mesh.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), die.spin.z * dt * (1 - t * 0.55));
        }
      }
      return;
    }
    if (this.settledAt && now - this.settledAt > 1800) {
      this.group.visible = false;
      this.settledAt = 0;
    }
  }
}
