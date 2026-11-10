import * as THREE from 'three';
import { MODEL, MOTION } from '../config';
import { BUILDING_META } from '../game/buildings';
import type { Building, BuildingType, PublicState } from '../game/types';
import { loadModel } from './models';
import { tilePose } from '../board/layout';
import { BOARD } from '../config';

interface BuildingVisual {
  tile: number;
  type: BuildingType;
  rank: number;
  group: THREE.Group;
  born: number;
}

export class BuildingLayer {
  private readonly root = new THREE.Group();
  private readonly visuals = new Map<string, BuildingVisual>();

  constructor(scene: THREE.Scene) {
    this.root.name = 'buildings';
    scene.add(this.root);
  }

  sync(state: PublicState): void {
    const wanted = new Map<string, { tile: number; building: Building; slot: number }>();
    for (const [idx, tile] of Object.entries(state.tiles)) {
      tile.buildings.forEach((building, slot) => {
        wanted.set(`${idx}:${building.type}`, { tile: Number(idx), building, slot });
      });
    }
    for (const [key, visual] of this.visuals) {
      if (wanted.has(key)) continue;
      this.root.remove(visual.group);
      this.visuals.delete(key);
    }
    for (const [key, entry] of wanted) {
      const existing = this.visuals.get(key);
      if (existing?.rank === entry.building.rank) continue;
      if (existing) {
        this.root.remove(existing.group);
        this.visuals.delete(key);
      }
      const lay = tilePose(entry.tile);
      const inner = -0.25;
      const side = (entry.slot - 1.5) * 0.16;
      const group = new THREE.Group();
      group.position.set(
        lay.x + Math.sin(lay.rotY) * inner + Math.cos(lay.rotY) * side,
        BOARD.tileTop + 0.01,
        lay.z + Math.cos(lay.rotY) * inner - Math.sin(lay.rotY) * side,
      );
      group.rotation.y = lay.rotY;
      group.scale.setScalar(0.01);
      this.root.add(group);
      const visual: BuildingVisual = {
        tile: entry.tile,
        type: entry.building.type,
        rank: entry.building.rank,
        group,
        born: performance.now(),
      };
      this.visuals.set(key, visual);
      void this.populate(visual);
    }
  }

  private async populate(visual: BuildingVisual): Promise<void> {
    try {
      const model = await loadModel(BUILDING_META[visual.type].model, MODEL.buildingMaxDimension);
      if (![...this.visuals.values()].includes(visual)) return;
      // Rank is readable as uniform height and a small cap, never stretched.
      visual.group.scale.setScalar(0.82 + visual.rank * 0.12);
      visual.group.add(model);
      visual.born = performance.now();
    } catch (error) {
      console.error('[building] model failed', visual.type, error);
      this.root.remove(visual.group);
      for (const [key, value] of this.visuals) if (value === visual) this.visuals.delete(key);
    }
  }

  update(): void {
    const now = performance.now();
    for (const visual of this.visuals.values()) {
      const t = Math.min(1, (now - visual.born) / MOTION.pop);
      const eased = 1 - Math.pow(1 - t, 3);
      visual.group.scale.setScalar(THREE.MathUtils.lerp(0.01, 0.82 + visual.rank * 0.12, eased));
    }
  }
}
