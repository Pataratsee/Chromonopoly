import * as THREE from 'three';

export interface SkyState {
  /** 0 at midnight, 0.5 at noon. */
  time: number;
  hour: number;
  daylight: number;
  night: number;
  phase: string;
  top: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  sunColor: THREE.Color;
}

const CYCLE_SECONDS = 8 * 60;

const KEYS: Array<{ t: number; top: string; horizon: string; light: number; sun: string; fog: string }> = [
  { t: 0.0, top: '#07132b', horizon: '#152945', light: 0.1, sun: '#ffd4a0', fog: '#13243b' },
  { t: 0.2, top: '#22335c', horizon: '#b66c57', light: 0.18, sun: '#ffb37a', fog: '#2a3854' },
  { t: 0.25, top: '#5b80ad', horizon: '#ffbe86', light: 0.55, sun: '#ffcf94', fog: '#8f9dab' },
  { t: 0.32, top: '#79c7eb', horizon: '#eaf8ff', light: 1, sun: '#fff2cf', fog: '#c4dfea' },
  { t: 0.68, top: '#6bbde8', horizon: '#f8f0d7', light: 1, sun: '#ffe6b0', fog: '#c5dde2' },
  { t: 0.76, top: '#687ca6', horizon: '#ff9d63', light: 0.62, sun: '#ff9d5d', fog: '#a4867e' },
  { t: 0.82, top: '#304268', horizon: '#c95d54', light: 0.3, sun: '#ff8b62', fog: '#5f5265' },
  { t: 0.88, top: '#07132b', horizon: '#152945', light: 0.1, sun: '#ffd4a0', fog: '#13243b' },
  { t: 1.0, top: '#07132b', horizon: '#152945', light: 0.1, sun: '#ffd4a0', fog: '#13243b' },
];

function lerpColor(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color): THREE.Color {
  return out.copy(a).lerp(b, t);
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,240,1)');
  gradient.addColorStop(0.28, 'rgba(255,245,205,0.8)');
  gradient.addColorStop(0.62, 'rgba(255,220,150,0.18)');
  gradient.addColorStop(1, 'rgba(255,210,130,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function cloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const blobs = [
    [62, 78, 42],
    [112, 62, 54],
    [166, 76, 38],
    [206, 86, 26],
    [88, 90, 30],
  ] as const;
  for (const [x, y, r] of blobs) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A real sky backdrop: gradient box, travelling sun and moon, drifting clouds
 * and stars. All geometry here is scene background, never a game object.
 */
export class Sky {
  readonly group = new THREE.Group();
  readonly state: SkyState = {
    time: 9 / 24,
    hour: 9,
    daylight: 1,
    night: 0,
    phase: 'Morning',
    top: new THREE.Color('#79c7eb'),
    horizon: new THREE.Color('#eaf8ff'),
    fog: new THREE.Color('#c4dfea'),
    sunColor: new THREE.Color('#fff2cf'),
  };
  private time = 9 / 24;
  private running = true;
  private readonly topColor = new THREE.Color();
  private readonly horizonColor = new THREE.Color();
  private readonly fogColor = new THREE.Color();
  private readonly sunTint = new THREE.Color();
  private readonly domeMaterial: THREE.ShaderMaterial;
  private readonly sun: THREE.Sprite;
  private readonly moon: THREE.Sprite;
  private readonly stars: THREE.Points;
  private readonly starMaterial: THREE.PointsMaterial;
  private readonly clouds: THREE.Sprite[] = [];
  private readonly cloudTexture: THREE.CanvasTexture;

  constructor() {
    this.group.name = 'sky';
    this.domeMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        topColor: { value: new THREE.Color('#79c7eb') },
        horizonColor: { value: new THREE.Color('#eaf8ff') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vDir;
        void main() {
          float h = smoothstep(-0.12, 0.72, vDir.y);
          vec3 color = mix(horizonColor, topColor, h);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(new THREE.BoxGeometry(300, 300, 300), this.domeMaterial);
    dome.frustumCulled = false;
    dome.renderOrder = -20;
    this.group.add(dome);

    const glow = glowTexture();
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff0c0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.sun.scale.setScalar(20);
    this.group.add(this.sun);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xdbe7ff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.moon.scale.setScalar(10);
    this.group.add(this.moon);

    const starPositions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * 0.95 + 0.03;
      const r = Math.sqrt(1 - y * y);
      starPositions[i * 3] = Math.cos(a) * r * 145;
      starPositions[i * 3 + 1] = y * 145;
      starPositions[i * 3 + 2] = Math.sin(a) * r * 145;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({ color: 0xf7f2df, size: 0.8, transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: true });
    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.cloudTexture = cloudTexture();
    for (let i = 0; i < 16; i += 1) {
      const material = new THREE.SpriteMaterial({ map: this.cloudTexture, transparent: true, depthWrite: false, fog: false, opacity: 0.42, color: 0xffffff });
      const cloud = new THREE.Sprite(material);
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.25;
      const radius = 80 + Math.random() * 40;
      cloud.position.set(Math.cos(angle) * radius, 22 + Math.random() * 12, Math.sin(angle) * radius);
      cloud.scale.set(30 + Math.random() * 25, 9 + Math.random() * 7, 1);
      cloud.userData.drift = 0.6 + Math.random() * 0.9;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }

    this.apply();
  }

  setRunning(running: boolean): void {
    this.running = running;
  }

  /** Read-only snapshot used by the all-angle sky audit. */
  audit(): {
    hour: number;
    sun: { x: number; y: number; z: number; opacity: number };
    moon: { x: number; y: number; z: number; opacity: number };
    stars: number;
    clouds: Array<{ x: number; y: number; z: number; opacity: number }>;
  } {
    return {
      hour: this.state.hour,
      sun: {
        x: this.sun.position.x,
        y: this.sun.position.y,
        z: this.sun.position.z,
        opacity: this.sun.material.opacity,
      },
      moon: {
        x: this.moon.position.x,
        y: this.moon.position.y,
        z: this.moon.position.z,
        opacity: this.moon.material.opacity,
      },
      stars: this.starMaterial.opacity,
      clouds: this.clouds.map((cloud) => ({
        x: cloud.position.x,
        y: cloud.position.y,
        z: cloud.position.z,
        opacity: cloud.material.opacity,
      })),
    };
  }

  setHour(hour: number): void {
    this.time = ((hour % 24) + 24) % 24 / 24;
    this.apply();
  }

  update(dt: number): SkyState {
    if (this.running) this.time = (this.time + dt / CYCLE_SECONDS) % 1;
    this.apply();
    for (const cloud of this.clouds) {
      cloud.position.x += dt * Number(cloud.userData.drift ?? 1) * 0.8;
      if (cloud.position.x > 125) cloud.position.x = -125;
    }
    return this.state;
  }

  private apply(): void {
    let a = KEYS[0]!;
    let b = KEYS[KEYS.length - 1]!;
    for (let i = 0; i < KEYS.length - 1; i += 1) {
      if (this.time >= KEYS[i]!.t && this.time <= KEYS[i + 1]!.t) {
        a = KEYS[i]!;
        b = KEYS[i + 1]!;
        break;
      }
    }
    const span = Math.max(1e-6, b.t - a.t);
    const t = THREE.MathUtils.clamp((this.time - a.t) / span, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    lerpColor(new THREE.Color(a.top), new THREE.Color(b.top), smooth, this.topColor);
    lerpColor(new THREE.Color(a.horizon), new THREE.Color(b.horizon), smooth, this.horizonColor);
    lerpColor(new THREE.Color(a.fog), new THREE.Color(b.fog), smooth, this.fogColor);
    lerpColor(new THREE.Color(a.sun), new THREE.Color(b.sun), smooth, this.sunTint);
    const daylight = THREE.MathUtils.lerp(a.light, b.light, smooth);
    this.domeMaterial.uniforms.topColor!.value.copy(this.topColor);
    this.domeMaterial.uniforms.horizonColor!.value.copy(this.horizonColor);

    const sunAngle = (this.time - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    this.sun.position.set(Math.cos(sunAngle) * 125, sunHeight * 125, -42);
    this.sun.material.color.copy(this.sunTint);
    this.sun.material.opacity = THREE.MathUtils.clamp((sunHeight + 0.18) * 1.5, 0, 1);
    // Keep the moon on the city-facing side of the sky; at 125 units it sat
    // behind the default camera and could never be seen at night.
    this.moon.position.set(-55, 24 + -sunHeight * 8, -95);
    this.moon.material.opacity = THREE.MathUtils.clamp((-sunHeight + 0.08) * 1.8, 0, 0.9);

    const night = THREE.MathUtils.clamp(1 - daylight * 1.45, 0, 1);
    this.starMaterial.opacity = night * 0.9;
    for (const cloud of this.clouds) {
      cloud.material.opacity = 0.12 + daylight * 0.2;
      cloud.material.color.copy(this.sunTint).lerp(new THREE.Color('#ffffff'), 0.7);
    }

    const hour = this.time * 24;
    let phase = 'Night';
    if (hour >= 5 && hour < 8) phase = 'Sunrise';
    else if (hour >= 8 && hour < 17) phase = 'Day';
    else if (hour >= 17 && hour < 20) phase = 'Sunset';
    else if (hour >= 20 || hour < 5) phase = 'Night';

    this.state.time = this.time;
    this.state.hour = hour;
    this.state.daylight = daylight;
    this.state.night = night;
    this.state.phase = phase;
    this.state.top.copy(this.topColor);
    this.state.horizon.copy(this.horizonColor);
    this.state.fog.copy(this.fogColor);
    this.state.sunColor.copy(this.sunTint);
  }
}
