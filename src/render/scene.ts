import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAMERA, QUALITY, RENDER, type QualityKey } from '../config';
import { createWebGLRenderer } from './webgl';

export class CameraRig {
  yaw: number = CAMERA.yaw;
  pitch: number = CAMERA.pitch;
  radius: number = CAMERA.radius;
  target = new THREE.Vector3(0, CAMERA.framingY, 0);

  private wantYaw: number = CAMERA.yaw;
  private wantPitch: number = CAMERA.pitch;
  private wantRadius: number = CAMERA.radius;
  private wantTarget = new THREE.Vector3(0, CAMERA.framingY, 0);
  private snapFrom: { yaw: number; pitch: number; radius: number; target: THREE.Vector3 } | null = null;
  private snapStart = 0;
  private snapDuration = 0;
  manualUntil = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    public speed = 1,
  ) {}

  orbit(dx: number, dy: number): void {
    this.wantYaw -= dx * 0.005;
    this.wantPitch = THREE.MathUtils.clamp(this.wantPitch + dy * 0.004, CAMERA.minPitch, CAMERA.maxPitch);
    this.manualUntil = performance.now() + CAMERA.followResumeMs;
  }

  /** Zoom toward the point under the cursor, not toward the screen centre. */
  zoom(delta: number, toward?: THREE.Vector3): void {
    this.wantRadius = THREE.MathUtils.clamp(this.wantRadius * (1 + delta * 0.0012), CAMERA.minRadius, CAMERA.maxRadius);
    if (toward) this.wantTarget.lerp(new THREE.Vector3(toward.x, 0.1, toward.z), 0.34);
    this.manualUntil = performance.now() + CAMERA.followResumeMs;
  }

  /** Rotate by ±90° with an eased 300 ms transition that never fights a drag. */
  snap(direction: 1 | -1): void {
    this.snapFrom = { yaw: this.wantYaw, pitch: this.wantPitch, radius: this.wantRadius, target: this.wantTarget.clone() };
    this.wantYaw = this.snapFrom.yaw + (Math.PI / 2) * direction;
    this.snapStart = performance.now();
    this.snapDuration = CAMERA.snapDuration;
    this.manualUntil = performance.now() + CAMERA.followResumeMs;
  }

  focus(point: THREE.Vector3, radius?: number): void {
    // Keep the subject in the middle: the old framingY deliberately pushed a
    // followed piece above centre, which is the complaint this fixes.
    this.wantTarget.set(point.x, point.y + 0.12, point.z);
    if (radius) this.wantRadius = THREE.MathUtils.clamp(radius, CAMERA.minRadius, CAMERA.maxRadius);
    this.manualUntil = performance.now() + CAMERA.followResumeMs * 2;
  }

  /** Tight framing of the centre dice pad before a roll. */
  focusDice(): void {
    this.wantTarget.set(0, 0.25, 0.62);
    this.wantPitch = 0.76;
    this.wantRadius = 8.4;
    this.manualUntil = performance.now() + 3800;
  }

  reset(): void {
    this.wantYaw = CAMERA.yaw;
    this.wantPitch = CAMERA.pitch;
    this.wantRadius = CAMERA.radius;
    this.wantTarget.set(0, CAMERA.framingY, 0);
    this.manualUntil = performance.now() + CAMERA.followResumeMs;
  }

  /** Explicitly follow a moving token without the manual-camera cooldown. */
  track(point: THREE.Vector3): void {
    this.wantTarget.set(point.x, point.y + 0.12, point.z);
  }

  /** Resolves after the camera has really reached its requested framing. */
  whenSettled(timeoutMs = 1800): Promise<void> {
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = (): void => {
        const d =
          Math.abs(this.wantRadius - this.radius) +
          Math.abs(this.wantPitch - this.pitch) * 2 +
          Math.abs(this.wantYaw - this.yaw) +
          this.wantTarget.distanceTo(this.target);
        if (d < 0.012 || performance.now() - start > timeoutMs) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** Camera follows a point unless the player just orbited manually. */
  follow(point: THREE.Vector3, dt: number): void {
    if (performance.now() < this.manualUntil) return;
    this.wantTarget.lerp(new THREE.Vector3(point.x, point.y + 0.12, point.z), Math.min(1, dt * CAMERA.followLerp));
    // Follow is a close three-quarter shot: damp toward the tight radius so a
    // piece is large and centred, never a dot in the middle of the board.
    this.wantRadius = THREE.MathUtils.damp(this.wantRadius, CAMERA.followRadius, CAMERA.followLerp, dt);
  }

  update(dt: number): void {
    if (this.snapFrom) {
      const t = Math.min(1, (performance.now() - this.snapStart) / this.snapDuration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      this.yaw = THREE.MathUtils.lerp(this.snapFrom.yaw, this.wantYaw, eased);
      this.pitch = THREE.MathUtils.lerp(this.snapFrom.pitch, this.wantPitch, eased);
      this.radius = THREE.MathUtils.lerp(this.snapFrom.radius, this.wantRadius, eased);
      this.target.lerpVectors(this.snapFrom.target, this.wantTarget, eased);
      if (t >= 1) this.snapFrom = null;
    } else {
      const k = 1 - Math.pow(1 - CAMERA.damping, dt * 60 * this.speed);
      this.yaw += (this.wantYaw - this.yaw) * k;
      this.pitch += (this.wantPitch - this.pitch) * k;
      this.radius += (this.wantRadius - this.radius) * k;
      this.target.lerp(this.wantTarget, k);
    }
    const sin = Math.sin(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.radius,
      this.target.y + sin * this.radius,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.radius,
    );
    this.camera.lookAt(this.target);
  }
}

export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly rig: CameraRig;
  private readonly renderer: THREE.WebGLRenderer;
  private quality: QualityKey;
  private width = 1;
  private height = 1;

  constructor(
    canvas: HTMLCanvasElement,
    quality: QualityKey,
  ) {
    this.quality = quality;
    this.renderer = createWebGLRenderer(canvas, {
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = RENDER.exposure;
    this.renderer.shadowMap.enabled = QUALITY[quality].shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearAlpha(0);
    this.scene.fog = new THREE.FogExp2(0x11160f, 0.006);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, CAMERA.near, CAMERA.far);
    this.camera.layers.enable(2);
    this.rig = new CameraRig(this.camera);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();

    this.addLights();
  }

  private addLights(): void {
    const key = new THREE.DirectionalLight(0xffe3bb, 1.15);
    key.layers.set(0);
    key.position.set(15, 24, 13);
    key.castShadow = true;
    key.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 70;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.022;
    key.shadow.radius = 3;
    this.scene.add(key);

    const fill = new THREE.HemisphereLight(0xbfe2ff, 0x6b5a3f, 0.35);
    fill.layers.set(0);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffcf9a, 0.3);
    rim.layers.set(0);
    rim.position.set(-12, 9, -15);
    this.scene.add(rim);

    const front = new THREE.DirectionalLight(0xffffff, 0.12);
    front.layers.set(0);
    front.position.set(-3, 6, 16);
    this.scene.add(front);

    // City time-of-day variation lives in CityLayer's materials. A second
    // "city-only" light rig cannot work: real-time lights are scene-global,
    // so changing them also relit the board (the Round 7 U11 failure).
  }

  setQuality(quality: QualityKey): void {
    this.quality = quality;
    const q = QUALITY[quality];
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio, RENDER.maxPixelRatio));
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio, RENDER.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Distance the camera must sit at to frame the board with the 6% margin. */
  frameBoard(): void {
    this.rig.reset();
  }

  render(): void {
    // No composer and no bloom pass: the board is rendered directly so no
    // post-processing halo can touch tiles, frame or pieces at any hour.
    this.renderer.render(this.scene, this.camera);
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  worldPoint(ndc: THREE.Vector2): THREE.Vector3 {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    ray.ray.intersectPlane(plane, out);
    return out;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
