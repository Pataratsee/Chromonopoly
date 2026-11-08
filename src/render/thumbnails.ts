import * as THREE from 'three';
import { MODEL, PALETTE } from '../config';
import { loadModel } from './models';
import { createWebGLRenderer } from './webgl';

/**
 * Renders one real 3D thumbnail per model once at boot into a cached canvas.
 * The selector and the preview pane both read from this studio, so the card
 * you click is the model you get.
 */
export class ThumbnailStudio {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cache = new Map<string, string>();
  private readonly canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MODEL.thumbnailSize;
    this.canvas.height = MODEL.thumbnailSize;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    this.camera.position.set(0.72, 0.6, 1.05);
    this.camera.lookAt(0, 0.16, 0);
  }

  /** Cold load stays cheap: no second WebGL context until a thumbnail is needed. */
  private ensureRenderer(): THREE.WebGLRenderer {
    if (this.renderer) return this.renderer;
    const renderer = createWebGLRenderer(this.canvas, {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(MODEL.thumbnailSize, MODEL.thumbnailSize, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    const key = new THREE.DirectionalLight(0xffe6c4, 2.6);
    key.position.set(1.4, 2.2, 1.6);
    this.scene.add(key);
    const fill = new THREE.HemisphereLight(0xcfe6ff, 0x6d5a3e, 1.15);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd2a1, 1.1);
    rim.position.set(-1.6, 1.0, -1.2);
    this.scene.add(rim);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(MODEL.pedestalRadius * 1.5, 36),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.55 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.001;
    this.scene.add(disc);
    return renderer;
  }

  /** Renders and caches a thumbnail data URL for `id`. */
  async thumb(id: string, kind: 'token' | 'building' = 'token'): Promise<string> {
    const key = `${id}:${kind}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const renderer = this.ensureRenderer();
    const size = kind === 'building' ? MODEL.buildingMaxDimension : MODEL.tokenMaxDimension;
    const model = await loadModel(id, size);
    if (kind === 'building') model.position.y = 0;
    const holder = new THREE.Group();
    holder.add(model);
    this.scene.add(holder);
    holder.rotation.y = 0.6;
    renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(key, url);
    this.scene.remove(holder);
    return url;
  }

  /** Live rotating preview on a visible canvas; returns a stop function. */
  preview(canvas: HTMLCanvasElement, id: string, kind: 'token' | 'building' = 'token', onReady?: () => void): () => void {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createWebGLRenderer(canvas, { antialias: true, alpha: true });
    } catch (error) {
      // The preview is decorative. A browser that refuses a second WebGL
      // context should still be able to play on the main board.
      console.warn('Token preview unavailable:', error);
      return () => undefined;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const camera = this.camera.clone();
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6d5a3e, 1.2));
    const key = new THREE.DirectionalLight(0xffe6c4, 2.6);
    key.position.set(1.4, 2.2, 1.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd2a1, 1.1);
    rim.position.set(-1.6, 1.0, -1.2);
    scene.add(rim);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(MODEL.pedestalRadius * 1.5, 36),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.5 }),
    );
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);

    const holder = new THREE.Group();
    scene.add(holder);
    let raf = 0;
    let alive = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    resize();

    void loadModel(id, kind === 'building' ? MODEL.buildingMaxDimension : MODEL.tokenMaxDimension).then((model) => {
      if (!alive) return;
      holder.add(model);
      onReady?.();
    });

    const loop = () => {
      if (!alive) return;
      holder.rotation.y += 0.012;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.cache.clear();
  }
}
