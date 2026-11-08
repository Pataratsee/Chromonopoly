import * as THREE from 'three';
import { MODEL, MOTION } from '../config';
import type { BuildingType, PublicState } from '../game/types';
import { loadModel } from './models';
import { tilePose } from '../board/layout';
import { BOARD } from '../config';

interface BuildingVisual {
  tile: number;
  type: BuildingType;
  group: THREE.Group;
  born: number;
}

export class BuildingLayer {
  private readonly root = new THREE.Group();
  private readonly visuals = new Map<number, BuildingVisual>();

  constructor(scene: THREE.Scene) {
    this.root.name = 'buildings';
    scene.add(this.root);
  }

  sync(state: PublicState): void {
    for (const [idx, tile] of Object.entries(state.tiles)) {
      const index = Number(idx);
      const wanted = tile.building;
      const existing = this.visuals.get(index);
      if (!wanted) {
        if (existing) {
          this.root.remove(existing.group);
          this.visuals.delete(index);
        }
        continue;
      }
      if (existing?.type === wanted) continue;
      if (existing) {
        this.root.remove(existing.group);
        this.visuals.delete(index);
      }
      const lay = tilePose(index);
      // Sit on the inner half so the building never covers the tile name or price.
      const inner = -0.25;
      const group = new THREE.Group();
      group.position.set(lay.x + Math.sin(lay.rotY) * inner, BOARD.tileTop + 0.01, lay.z + Math.cos(lay.rotY) * inner);
      group.rotation.y = lay.rotY;
      group.scale.setScalar(0.01);
      this.root.add(group);
      const visual: BuildingVisual = { tile: index, type: wanted, group, born: performance.now() };
      this.visuals.set(index, visual);
      void this.populate(visual);
    }
  }

  private async populate(visual: BuildingVisual): Promise<void> {
    try {
      const model = await loadModel(visual.type, MODEL.buildingMaxDimension);
      if (this.visuals.get(visual.tile) !== visual) return;
      visual.group.add(model);
    } catch {
      this.root.remove(visual.group);
      this.visuals.delete(visual.tile);
    }
  }

  update(): void {
    const now = performance.now();
    for (const visual of this.visuals.values()) {
      const t = Math.min(1, (now - visual.born) / MOTION.pop);
      const eased = 1 - Math.pow(1 - t, 3);
      visual.group.scale.setScalar(THREE.MathUtils.lerp(0.01, 1, eased));
    }
  }
}
