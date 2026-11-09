import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { assetUrl } from '../assetUrl';

export interface ModelAsset {
  id: string;
  name: string;
  kind: 'token' | 'building' | 'prop';
  category: string;
  file: string;
  kit: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  sha256: string;
  bytes: number;
}

export interface Manifest {
  generatedAt: string;
  license: string;
  author: string;
  assets: ModelAsset[];
}

let manifest: Manifest | null = null;
const cache = new Map<string, THREE.Group>();
let loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(assetUrl('assets/draco/'));
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

/** Bump when the asset list changes; also bypasses stale browser manifests. */
const MANIFEST_VERSION = 'round8-2026-11-09';

export async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  const res = await fetch(assetUrl(`assets/models/manifest.json?v=${MANIFEST_VERSION}`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const loaded = (await res.json()) as Manifest;
  if (!loaded.assets.some((a) => a.kind === 'building')) {
    throw new Error('The model manifest is stale: it contains no buildings. Reload the page; if it persists, restart the server.');
  }
  manifest = loaded;
  return manifest;
}

export function assetsOf(kind: ModelAsset['kind']): ModelAsset[] {
  return manifest?.assets.filter((a) => a.kind === kind) ?? [];
}

export function assetById(id: string): ModelAsset {
  const found = manifest?.assets.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown model asset "${id}"`);
  return found;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const restyleCache = new Map<string, THREE.Material>();

/**
 * Keeps each model's own colour map but pulls roughness/metalness into the
 * shared family, so 14 Kenney kits read as one art direction.
 */
function restyleMaterial(source: THREE.Material): THREE.Material {
  const hit = restyleCache.get(source.uuid);
  if (hit) return hit;
  const textured = source as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null };
  const mat = new THREE.MeshStandardMaterial({
    color: textured.color ? textured.color.clone() : new THREE.Color(0xffffff),
    map: textured.map ?? null,
    roughness: 0.62,
    metalness: 0.05,
    envMapIntensity: 0.35,
  });
  if (textured.map) textured.map.anisotropy = 4;
  restyleCache.set(source.uuid, mat);
  return mat;
}

/**
 * One material family for every loaded model. The model keeps its own colour;
 * only roughness, metalness and shading are unified.
 */
export function familyMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const hex = new THREE.Color(color).getHexString();
  let mat = materialCache.get(hex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.62,
      metalness: 0.05,
      envMapIntensity: 0.35,
    });
    materialCache.set(hex, mat);
  }
  return mat;
}

/** Loads, normalises (pivot at base centre, max dimension = size) and caches. */
export async function loadModel(id: string, size: number): Promise<THREE.Group> {
  const key = `${id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit.clone(true);

  const asset = assetById(id);
  const gltf = await getLoader().loadAsync(assetUrl(`assets/models/${asset.file}`));
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  // Re-material into the shared family without dropping any colour map.
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = false;
    obj.material = Array.isArray(obj.material)
      ? obj.material.map(restyleMaterial)
      : restyleMaterial(obj.material);
  });

  const box = new THREE.Box3().setFromObject(root);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
  const scale = size / maxDim;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const scaled = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  scaled.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;
  root.updateMatrixWorld(true);

  root.name = id;
  cache.set(key, root.clone(true));
  return root;
}

export function modelBounds(obj: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(obj);
}

export function disposeModelCache(): void {
  cache.clear();
  materialCache.clear();
  restyleCache.clear();
}
