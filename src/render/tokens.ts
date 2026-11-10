import * as THREE from 'three';
import { BOARD, MODEL } from '../config';
import { SPACES } from '../game/board';
import type { PlayerPublic } from '../game/types';
import { loadModel } from './models';
import { createPedestal } from '../board/pedestal';
import { tilePose } from '../board/layout';

interface TokenVisual {
  id: string;
  group: THREE.Group;
  pedestal: THREE.Mesh;
  model: THREE.Object3D | null;
  tile: number;
  nextTile: number;
  targetTile: number;
  path: number[];
  progress: number;
  bob: number;
  scale: number;
  targetScale: number;
  seed: number;
  heading: number;
  slot: number;
  slotCount: number;
  inJail: boolean;
  landedLogged: boolean;
  idleWaiters: Array<() => void>;
}

export interface MoveLogEntry {
  playerId: string;
  logicTileIndex: number;
  tileName: string;
  pieceWorldPosition: { x: number; y: number; z: number };
  tileCenterWorldPosition: { x: number; y: number; z: number };
  distance: number;
  inJail: boolean;
  at: number;
}

declare global {
  interface Window {
    __moveLog?: MoveLogEntry[];
  }
}

const HOP = MODEL.hopMs / 1000;
const TOKEN_Y = BOARD.tileTop + 0.02;

/** Spread co-located pieces in a tiny ring; one piece sits exactly on center. */
function positionFor(tile: number, slot: number, slots: number): THREE.Vector3 {
  const pose = tilePose(tile);
  const angle = (slot / Math.max(1, slots)) * Math.PI * 2;
  const ring = slots > 1 ? 0.2 : 0;
  return new THREE.Vector3(pose.x + Math.cos(angle) * ring, TOKEN_Y, pose.z + Math.sin(angle) * ring);
}

export class TokenLayer {
  private readonly tokens = new Map<string, TokenVisual>();
  private readonly paused = new Set<string>();
  private readonly root = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.root.name = 'tokens';
    scene.add(this.root);
  }

  async sync(players: Record<string, PlayerPublic>): Promise<void> {
    const byTile = new Map<number, string[]>();
    for (const p of Object.values(players)) {
      if (p.bankrupt) continue;
      const list = byTile.get(p.position) ?? [];
      list.push(p.id);
      byTile.set(p.position, list);
    }

    for (const player of Object.values(players)) {
      if (player.bankrupt) {
        const dead = this.tokens.get(player.id);
        if (dead) {
          this.root.remove(dead.group);
          this.tokens.delete(player.id);
          this.flushIdle(dead);
        }
        continue;
      }
      let visual = this.tokens.get(player.id);
      const slots = byTile.get(player.position) ?? [player.id];
      const slot = Math.max(0, slots.indexOf(player.id));

      if (!visual) {
        const group = new THREE.Group();
        const pedestal = createPedestal(player.color);
        group.add(pedestal);
        const base = new THREE.Group();
        group.add(base);
        this.root.add(group);
        visual = {
          id: player.id,
          group,
          pedestal,
          model: null,
          tile: player.position,
          nextTile: player.position,
          targetTile: player.position,
          path: [],
          progress: 1,
          bob: Math.random() * Math.PI * 2,
          scale: 0.01,
          targetScale: 1,
          seed: Math.random(),
          heading: Math.PI / 4,
          slot,
          slotCount: slots.length,
          inJail: player.inJail,
          landedLogged: true,
          idleWaiters: [],
        };
        this.tokens.set(player.id, visual);
        this.snap(visual);
        void this.attachModel(visual, player.tokenId);
      } else {
        const moved = player.position !== visual.targetTile;
        visual.targetTile = player.position;
        visual.inJail = player.inJail;
        visual.slot = slot;
        visual.slotCount = slots.length;
        if (moved) visual.landedLogged = false;
      }
      (visual.pedestal.material as THREE.MeshStandardMaterial).color.set(player.color);
      this.startPath(visual);
    }
  }

  /** The turn sequencer pauses only the acting piece until the dice settle. */
  pause(id: string): void {
    this.paused.add(id);
  }

  resume(id: string): void {
    this.paused.delete(id);
    const visual = this.tokens.get(id);
    if (visual) this.startPath(visual);
  }

  setMovementPaused(paused: boolean): void {
    for (const id of this.tokens.keys()) {
      if (paused) this.pause(id);
      else this.paused.delete(id);
    }
    if (!paused) {
      for (const visual of this.tokens.values()) this.startPath(visual);
    }
  }

  isIdle(id: string): boolean {
    const visual = this.tokens.get(id);
    return !visual || (visual.path.length === 0 && visual.progress >= 1 && visual.nextTile === visual.targetTile);
  }

  waitForIdle(id: string): Promise<void> {
    const visual = this.tokens.get(id);
    if (!visual || this.isIdle(id)) return Promise.resolve();
    return new Promise((resolve) => visual.idleWaiters.push(resolve));
  }

  positionOf(id: string): THREE.Vector3 | null {
    return this.tokens.get(id)?.group.position.clone() ?? null;
  }

  /** End any in-flight path at the exact logic tile centre (turn guard). */
  snapTo(id: string, tile: number): void {
    const visual = this.tokens.get(id);
    if (!visual) return;
    visual.path = [];
    visual.progress = 1;
    visual.tile = tile;
    visual.nextTile = tile;
    visual.targetTile = tile;
    visual.landedLogged = false;
    this.snap(visual);
    this.land(visual);
  }

  private startPath(visual: TokenVisual): void {
    if (this.paused.has(visual.id) || visual.path.length) return;
    if (visual.progress < 1) return;
    if (visual.nextTile === visual.targetTile) return;
    if (visual.inJail && visual.targetTile === 10) {
      // Jail is a direct jump, not a lap of the board.
      visual.path = [visual.targetTile];
    } else {
      visual.path = this.pathBetween(visual.nextTile, visual.targetTile);
    }
    if (!visual.path.length) return;
    visual.tile = visual.nextTile;
    visual.nextTile = visual.path.shift()!;
    visual.progress = 0;
    visual.landedLogged = false;
  }

  private pathBetween(from: number, to: number): number[] {
    if (from === to) return [];
    const out: number[] = [];
    let cur = from;
    for (let i = 0; i < SPACES.length; i += 1) {
      cur = (cur + 1) % SPACES.length;
      out.push(cur);
      if (cur === to) return out;
    }
    return [to];
  }

  private async attachModel(visual: TokenVisual, tokenId: string): Promise<void> {
    try {
      const model = await loadModel(tokenId, MODEL.tokenMaxDimension);
      if (!this.tokens.has(visual.id)) return;
      const holder = visual.group.children[1];
      if (!holder) return;
      holder.add(model);
      visual.model = model;
      model.rotation.y = 0;
    } catch {
      visual.targetScale = 0.0001;
    }
  }

  private snap(visual: TokenVisual): void {
    const p = positionFor(visual.nextTile, visual.slot, visual.slotCount);
    visual.group.position.x = p.x;
    visual.group.position.z = p.z;
    visual.group.position.y = TOKEN_Y;
  }

  private land(visual: TokenVisual): void {
    visual.progress = 1;
    // A state update can retarget a piece while its current hop is still in
    // flight. Landing on the stale hop would snap it back and report a false
    // centre mismatch, so queue the remaining path to the authoritative tile.
    if (visual.nextTile !== visual.targetTile) {
      this.startPath(visual);
      return;
    }
    this.snap(visual);
    if (visual.landedLogged) return;
    visual.landedLogged = true;
    const logic = visual.targetTile;
    const pose = tilePose(logic);
    const center = { x: pose.x, y: TOKEN_Y, z: pose.z };
    const actual = visual.group.position;
    const distance = Math.hypot(actual.x - center.x, actual.z - center.z);
    const entry: MoveLogEntry = {
      playerId: visual.id,
      logicTileIndex: logic,
      tileName: SPACES[logic]?.name ?? 'unknown',
      pieceWorldPosition: { x: Number(actual.x.toFixed(4)), y: Number(actual.y.toFixed(4)), z: Number(actual.z.toFixed(4)) },
      tileCenterWorldPosition: { x: Number(center.x.toFixed(4)), y: center.y, z: Number(center.z.toFixed(4)) },
      distance: Number(distance.toFixed(4)),
      inJail: visual.inJail,
      at: performance.now(),
    };
    window.__moveLog ??= [];
    window.__moveLog.push(entry);
    if (new URLSearchParams(location.search).has('e2e') || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.debug('[move]', entry);
    }
    if (visual.slotCount === 1 && distance > 0.05) {
      console.error('[move] piece did not land on its logic tile center', entry);
    }
    this.flushIdle(visual);
  }

  private flushIdle(visual: TokenVisual): void {
    if (visual.path.length || visual.progress < 1 || visual.nextTile !== visual.targetTile) return;
    const waiters = visual.idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }

  update(dt: number, activeId: string | null): void {
    for (const visual of this.tokens.values()) {
      visual.bob += dt * ((Math.PI * 2) / MODEL.idlePeriod);
      visual.scale += (visual.targetScale - visual.scale) * Math.min(1, dt * 10);
      this.startPath(visual);

      if (visual.path.length || visual.progress < 1) {
        visual.progress = Math.min(1, visual.progress + dt / HOP);
        if (visual.progress >= 1) {
          visual.tile = visual.nextTile;
          if (visual.path.length) {
            visual.nextTile = visual.path.shift()!;
            visual.progress = 0;
          } else {
            this.land(visual);
          }
        }
      }

      const from = positionFor(visual.tile, visual.slot, visual.slotCount);
      const to = positionFor(visual.nextTile, visual.slot, visual.slotCount);
      const t = visual.progress;
      const moving = visual.path.length > 0 || t < 1;
      const x = THREE.MathUtils.lerp(from.x, to.x, t);
      const z = THREE.MathUtils.lerp(from.z, to.z, t);
      const hop = moving ? Math.sin(t * Math.PI) * MODEL.hopHeight : 0;
      const idle = moving ? 0 : Math.sin(visual.bob) * MODEL.idleBob;
      if (moving) {
        visual.group.position.x = x;
        visual.group.position.z = z;
      } else {
        visual.group.position.x = to.x;
        visual.group.position.z = to.z;
      }
      visual.group.position.y = TOKEN_Y + hop + idle;
      const emph = activeId === visual.id ? 1 : 0.86;
      visual.group.scale.setScalar(visual.scale * emph);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const wanted = moving && Math.abs(dx) + Math.abs(dz) > 0.0001 ? Math.atan2(dx, dz) : Math.PI / 4;
      let turn = ((wanted - visual.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      visual.heading += turn * Math.min(1, dt * 10);
      const holder = visual.group.children[1];
      if (holder) holder.rotation.y = visual.heading;
    }
  }

  remove(id: string): void {
    const v = this.tokens.get(id);
    if (!v) return;
    this.root.remove(v.group);
    this.tokens.delete(id);
    this.flushIdle(v);
  }
}
