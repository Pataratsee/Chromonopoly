import * as THREE from 'three';
import { createCityGround } from '../board/cityGround';
import type { SkyState } from '../board/sky';
import {
  BUILDING_SLOTS,
  CAR_ROUTES,
  CITY_HALF,
  PARK_RECTS,
  PARKED_CAR_SLOTS,
  TREE_SLOTS,
  WALK_ROUTES,
  pointOutsideBoardZone,
} from '../board/cityPlan';
import { loadModel } from './models';

// All 32 city models, each used at its own proportions. Height comes from
// choosing a different model, never from scaling one model taller.
const BUILDING_IDS = [
  'city-a', 'city-b', 'city-c', 'city-d', 'city-e', 'city-f', 'city-g', 'city-h', 'city-i',
  'suburb-a', 'suburb-b', 'suburb-c', 'suburb-d', 'city-far-a', 'city-far-b', 'city-far-c', 'city-far-d',
  'house', 'apartments', 'shop', 'restaurant', 'office', 'hotel', 'landmark',
  'building-e', 'building-g', 'building-i', 'building-j', 'building-l', 'skyscraper-a', 'type-c', 'type-d',
];
const OUTER_IDS = ['city-b', 'city-d', 'city-f', 'city-far-b', 'suburb-a', 'suburb-c', 'house', 'suburb-d', 'city-e', 'city-far-d'];
const SKYLINE_IDS = ['city-g', 'city-h', 'city-i', 'skyscraper-a', 'type-c', 'type-d', 'building-i', 'building-j', 'building-l', 'hotel', 'landmark'];
const ROOF_COLORS = ['#B4503F', '#4E6E7A', '#8A6A45', '#5C7A55', '#7A5A7E', '#C08A3E'];

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const CARS = ['sedan', 'taxi', 'van', 'police', 'delivery', 'luxurysuv'];
const WALKERS = ['character-a', 'character-b', 'character-c', 'character-d', 'character-e', 'character-f', 'character-g', 'character-h', 'dog', 'cat', 'panda', 'fox'];

interface Mover {
  group: THREE.Group;
  axis: 'x' | 'z';
  road: number;
  lane: number;
  dir: 1 | -1;
  speed: number;
  distance: number;
  kind: 'car' | 'walker';
}

interface CityDebug {
  requested: number;
  loaded: number;
  failed: number;
  buildings: number;
  props: number;
  visible: number;
  ok: boolean;
}

declare global {
  interface Window {
    __cityDebug?: CityDebug;
    __cityGroup?: THREE.Group;
    __cityStats?: (camera?: THREE.Camera) => unknown;
  }
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,238,180,0.95)');
  gradient.addColorStop(0.3, 'rgba(255,206,107,0.45)');
  gradient.addColorStop(1, 'rgba(255,180,70,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/**
 * A dense grid city around the board: fourteen blocks of continuous frontage,
 * eight streets each way, parks, traffic and pedestrians. The distant skyline
 * is a separate two-row wall, so the ground grid never becomes a ring.
 */
export class CityLayer {
  readonly group = new THREE.Group();
  private readonly movers: Mover[] = [];
  private readonly glowSprites: THREE.Sprite[] = [];
  private readonly lampTexture = glowTexture();
  private readonly buildingMaterials = new Set<THREE.MeshStandardMaterial>();
  private readonly buildingGroups: THREE.Group[] = [];
  private readonly padMaterial = new THREE.MeshStandardMaterial({ color: '#8f8a7c', roughness: 0.97 });
  private readonly debug: CityDebug = { requested: 0, loaded: 0, failed: 0, buildings: 0, props: 0, visible: 0, ok: false };

  constructor(scene: THREE.Scene) {
    this.group.name = 'living-city';
    this.group.add(createCityGround());
    scene.add(this.group);
    this.group.traverse((o) => o.layers.set(2));
    window.__cityDebug = this.debug;
    if (new URLSearchParams(location.search).has('e2e')) window.__cityGroup = this.group;

    this.populateBuildings();
    this.populateSkyline();
    this.populateStreetLife();
    this.populateMovers();
    this.report();
    if (new URLSearchParams(location.search).has('e2e')) {
      window.__cityStats = (camera?: THREE.Camera) =>
        this.buildingGroups.map((g) => {
          const box = new THREE.Box3().setFromObject(g);
          const size = new THREE.Vector3();
          box.getSize(size);
          const p = new THREE.Vector3();
          g.getWorldPosition(p);
          const top = new THREE.Vector3(p.x, box.max.y, p.z);
          if (camera) camera.updateMatrixWorld();
          const ndc = camera ? top.clone().project(camera) : null;
          let meshes = 0;
          let meshVisible = 0;
          g.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              meshes += 1;
              if (o.visible) meshVisible += 1;
            }
          });
          return {
            x: Number(p.x.toFixed(1)),
            z: Number(p.z.toFixed(1)),
            y: Number(box.min.y.toFixed(2)),
            top: Number(box.max.y.toFixed(2)),
            w: Number(size.x.toFixed(1)),
            h: Number(size.y.toFixed(1)),
            screen: ndc ? { x: Number(ndc.x.toFixed(2)), y: Number(ndc.y.toFixed(2)), z: Number(ndc.z.toFixed(2)) } : null,
            gVisible: g.visible,
            meshes,
            meshVisible,
            children: g.children.length,
          };
        });
    }
  }

  private setLayer(object: THREE.Object3D): void {
    object.traverse((o) => o.layers.set(2));
  }

  private requestModel(
    id: string,
    size: number,
    holder: THREE.Group,
    kind: 'building' | 'prop',
    tune?: (model: THREE.Group) => void,
  ): void {
    this.debug.requested += 1;
    if (!Number.isFinite(size) || size <= 0) {
      this.debug.failed += 1;
      console.error('[city] invalid size', { id, size });
      holder.removeFromParent();
      this.report();
      return;
    }
    void loadModel(id, size)
      .then((model) => {
        if (!holder.parent) return;
        tune?.(model);
        holder.add(model);
        this.setLayer(holder);
        this.debug.loaded += 1;
        if (kind === 'building') {
          this.debug.buildings += 1;
          this.prepareBuilding(model);
        } else {
          this.debug.props += 1;
        }
        this.report();
      })
      .catch((error: unknown) => {
        this.debug.failed += 1;
        console.error(`[city] failed to load ${id} at ${size}:`, error);
        holder.removeFromParent();
        this.report();
      });
  }

  private prepareBuilding(model: THREE.Group): void {
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = false;
      node.receiveShadow = false;
      const source = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of source) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.emissive.setHex(0xffc276);
        material.emissiveMap = material.map ?? null;
        material.emissiveIntensity = 0;
        this.buildingMaterials.add(material);
      }
    });
  }

  /**
   * Roof colour, wall tint and rooftop clutter: varied but deterministic.
   * Only loaded models may become 3D objects in this file, so rooftop props
   * are small manifest models, never primitive geometry.
   */
  private decorate(model: THREE.Group, seed: number, detailed: boolean): void {
    const rng = seeded(seed * 2654435761);
    if (detailed) {
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const source = Array.isArray(node.material) ? node.material : [node.material];
        const tinted = source.map((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return material;
          const clone = material.clone();
          clone.color.offsetHSL((rng() - 0.5) * 0.02, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.12);
          return clone;
        });
        node.material = Array.isArray(node.material) ? tinted : tinted[0]!;
      });
    }
    // Tint the highest mesh as the roof (whole model when the kit is one mesh).
    let topMesh: THREE.Mesh | null = null;
    let topY = -Infinity;
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const box = new THREE.Box3().setFromObject(node);
      if (box.max.y > topY) {
        topY = box.max.y;
        topMesh = node;
      }
    });
    if (topMesh) {
      const mesh = topMesh as THREE.Mesh;
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const roofColor = new THREE.Color(ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)]!);
      const tinted = source.map((material) => {
        const clone = material.clone();
        if ('color' in clone) (clone as THREE.MeshStandardMaterial).color.lerp(roofColor, 0.55);
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0]!;
    }
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (!Number.isFinite(size.x) || size.x <= 0 || size.y <= 0) return;
    const props = ['barrel', 'crate', 'satellite', 'tree-small'];
    const pick = props[Math.floor(rng() * props.length)]!;
    const propSize = Math.min(size.x, size.z) * (pick === 'tree-small' ? 0.28 : 0.16);
    if (propSize < 0.18) return;
    void loadModel(pick, propSize)
      .then((prop) => {
        prop.position.set(
          (rng() - 0.5) * size.x * 0.45,
          box.max.y,
          (rng() - 0.5) * size.z * 0.45,
        );
        prop.rotation.y = rng() * Math.PI * 2;
        model.add(prop);
        this.setLayer(prop);
      })
      .catch(() => {
        // A missing rooftop prop must not break the building itself.
      });
  }

  private placeBuilding(
    id: string,
    x: number,
    z: number,
    size: number,
    rotY: number,
    variant: number,
    withPads: boolean,
    seed: number,
  ): void {
    const holder = new THREE.Group();
    holder.position.set(x, -0.228, z);
    holder.rotation.y = rotY;
    this.group.add(holder);
    this.buildingGroups.push(holder);
    if (withPads) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.1, size * 1.1), this.padMaterial);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.005;
      pad.receiveShadow = true;
      holder.add(pad);
      this.setLayer(pad);
    }
    // Uniform scale only: loadModel already normalises the model's largest
    // dimension to `size`. Different heights come from different models.
    this.requestModel(id, size, holder, 'building', (model) => {
      this.decorate(model, seed + Math.round(variant * 100), withPads);
    });
  }

  private populateBuildings(): void {
    for (const slot of BUILDING_SLOTS) {
      const pool = slot.outer ? [...OUTER_IDS, ...BUILDING_IDS] : BUILDING_IDS;
      const id = pool[(slot.index * 7 + (slot.outer ? 3 : 0)) % pool.length]!;
      this.placeBuilding(id, slot.x, slot.z, slot.size, slot.rotY, slot.height, true, slot.index);
    }
  }

  private populateSkyline(): void {
    // Three overlapping ranks make a continuous wall. Uniform size per rank:
    // height variety comes from the model mix, never from a vertical stretch.
    const rows = [
      { radius: 66, count: 96, size: 7, ids: SKYLINE_IDS },
      { radius: 82, count: 84, size: 10, ids: SKYLINE_IDS },
      { radius: 98, count: 72, size: 13, ids: SKYLINE_IDS },
    ];
    let seed = 9000;
    for (const row of rows) {
      for (let i = 0; i < row.count; i += 1) {
        const a = (i / row.count) * Math.PI * 2 + 0.03;
        const x = Math.cos(a) * row.radius;
        const z = Math.sin(a) * row.radius;
        seed += 1;
        this.placeBuilding(
          row.ids[(i * 3 + row.radius) % row.ids.length]!,
          x,
          z,
          row.size,
          Math.atan2(x, z),
          1 + (i % 4) * 0.1,
          false,
          seed,
        );
      }
    }
  }

  private placeProp(id: string, x: number, z: number, size: number, rotY: number, materialY = -0.224): void {
    if (!pointOutsideBoardZone(x, z, 0.3)) {
      console.error('[city] prop would enter the board zone', { id, x, z });
      return;
    }
    const holder = new THREE.Group();
    holder.position.set(x, materialY, z);
    holder.rotation.y = rotY;
    this.group.add(holder);
    this.requestModel(id, size, holder, 'prop');
  }

  private placeLamp(x: number, z: number, cross: boolean): void {
    if (!pointOutsideBoardZone(x, z, 0.3)) return;
    const holder = new THREE.Group();
    holder.position.set(x, -0.224, z);
    holder.rotation.y = Math.atan2(-x, -z);
    this.group.add(holder);
    this.requestModel(cross ? 'streetlight-cross' : 'streetlight', 1.1, holder, 'prop');
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.lampTexture,
        color: 0xffcf8a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    glow.position.set(x, 0.48, z);
    glow.scale.setScalar(1.1);
    glow.layers.set(2);
    this.group.add(glow);
    this.glowSprites.push(glow);
  }

  private populateStreetLife(): void {
    for (const [i, tree] of TREE_SLOTS.entries()) {
      this.placeProp(i % 3 === 0 ? 'tree-large' : 'tree-small', tree.x, tree.z, tree.size, (i * 0.7) % Math.PI, -0.208);
    }
    for (const [i, park] of PARK_RECTS.entries()) {
      for (let j = 0; j < 4; j += 1) {
        const a = (j / 4) * Math.PI * 2 + 0.35 + i;
        this.placeProp('bench-city', park.x + Math.cos(a) * 2.1, park.z + Math.sin(a) * 2.1, 0.62, -a, -0.208);
      }
      this.placeProp('lantern-city', park.x, park.z, 1.2, 0, -0.208);
    }

    // The first two rings of intersections get modelled crossing lights.
    for (const x of [-20.8, -10.4, 10.4, 20.8]) {
      for (const z of [-20.8, -10.4, 10.4, 20.8]) {
        this.placeLamp(x + (x > 0 ? -1.9 : 1.9), z + (z > 0 ? -1.9 : 1.9), true);
      }
    }
    for (const x of [-31.2, -20.8, -10.4, 10.4, 20.8, 31.2]) {
      for (const z of [-32, -19, -7, 7, 19, 32]) {
        this.placeLamp(x + (x > 0 ? -2.45 : 2.45), z, false);
      }
    }
    for (const car of PARKED_CAR_SLOTS) {
      this.placeProp(CARS[Math.abs(Math.round(car.x + car.z)) % CARS.length]!, car.x, car.z, 0.84, car.rotY, -0.225);
    }
  }

  private addMover(
    id: string,
    route: { axis: 'x' | 'z'; road: number; lane: number; dir: 1 | -1; speed: number; offset: number },
    kind: Mover['kind'],
  ): void {
    const holder = new THREE.Group();
    this.group.add(holder);
    const mover: Mover = {
      group: holder,
      axis: route.axis,
      road: route.road,
      lane: route.lane,
      dir: route.dir,
      speed: route.speed,
      distance: route.offset * CITY_HALF * 2,
      kind,
    };
    this.movers.push(mover);
    this.placeMover(mover);
    this.requestModel(id, kind === 'car' ? 0.95 : 0.46, holder, 'prop', (model) => {
      if (kind === 'walker') model.scale.y *= 1.02;
    });
  }

  private populateMovers(): void {
    const carRoutes = [
      ...CAR_ROUTES,
      { axis: 'z' as const, road: 41.6, lane: 0.7, dir: -1 as const, speed: 4.4, offset: 0.75 },
      { axis: 'x' as const, road: -41.6, lane: 0.7, dir: 1 as const, speed: 4.0, offset: 0.82 },
    ];
    for (const [i, route] of carRoutes.entries()) {
      for (let j = 0; j < 2; j += 1) {
        this.addMover(CARS[(i + j) % CARS.length]!, { ...route, offset: route.offset + j * 0.5 }, 'car');
      }
    }
    const walkRoutes = [
      ...WALK_ROUTES,
      { axis: 'z' as const, road: -31.2, lane: 2.0, dir: 1 as const, speed: 1.2, offset: 0.2 },
      { axis: 'x' as const, road: 31.2, lane: -2.0, dir: -1 as const, speed: 1.1, offset: 0.8 },
    ];
    for (const [i, route] of walkRoutes.entries()) {
      for (let j = 0; j < 3; j += 1) {
        this.addMover(WALKERS[(i * 3 + j) % WALKERS.length]!, { ...route, offset: route.offset + j * 0.29 }, 'walker');
      }
    }
  }

  private placeMover(mover: Mover): void {
    const span = CITY_HALF * 2;
    const along = (((mover.distance % span) + span) % span) - CITY_HALF;
    if (mover.axis === 'z') {
      mover.group.position.set(mover.road + mover.lane, mover.kind === 'car' ? -0.225 : -0.214, along);
      mover.group.rotation.y = mover.dir > 0 ? 0 : Math.PI;
    } else {
      mover.group.position.set(along, mover.kind === 'car' ? -0.225 : -0.214, mover.road + mover.lane);
      mover.group.rotation.y = mover.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  private report(): void {
    this.debug.visible = this.buildingGroups.filter((g) => g.visible && g.children.length > 1).length;
    this.debug.ok = this.debug.loaded > 0 && this.debug.buildings > 0;
    window.__cityDebug = this.debug;
    // Only judge the startup check once every request has settled; the first
    // reports fire while models are still streaming in.
    const settled = this.debug.requested > 0 && this.debug.loaded + this.debug.failed >= this.debug.requested;
    if (!settled) return;
    console.log(
      `[city] buildings loaded ${this.debug.buildings}, visible ${this.debug.visible}, props ${this.debug.props}, failed ${this.debug.failed} / ${this.debug.requested}`,
    );
    if (!this.debug.ok) {
      console.error('[city] STARTUP CHECK FAILED: no buildings loaded. The city would be invisible.');
    }
  }

  setSky(sky: SkyState): void {
    const glow = 1 - sky.daylight;
    for (const material of this.buildingMaterials) material.emissiveIntensity = glow * 0.62;
    for (const sprite of this.glowSprites) {
      sprite.material.opacity = glow * 0.85;
      sprite.scale.setScalar(0.5 + glow * 1.1);
    }
  }

  update(dt: number, _time: number): void {
    for (const mover of this.movers) {
      mover.distance += mover.speed * mover.dir * dt;
      this.placeMover(mover);
    }
  }
}

