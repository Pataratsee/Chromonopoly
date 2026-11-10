import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA } from '../src/config';
import { CameraRig } from '../src/render/scene';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('W7 camera pivot', () => {
  it('survives 1,000 random orbit/zoom/focus sequences without drifting off the board', () => {
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.06, 400);
    const rig = new CameraRig(camera);
    const random = rng(7419);
    for (let i = 0; i < 1000; i += 1) {
      // Pinch is two zoom deltas per frame; resize never touches the rig.
      if (i % 7 === 0) {
        rig.zoom(-80 - random() * 300);
        rig.zoom(80 + random() * 300);
      }
      rig.orbit((random() - 0.5) * 500, (random() - 0.5) * 260);
      rig.zoom((random() - 0.5) * 900);
      const point = new THREE.Vector3((random() - 0.5) * 80, (random() - 0.5) * 20, (random() - 0.5) * 80);
      if (i % 11 === 0) rig.snap(random() > 0.5 ? 1 : -1);
      else if (i % 17 === 0) rig.reset();
      else if (i % 3 === 0) rig.focus(point, 7 + random() * 40);
      else if (i % 3 === 1) rig.track(point);
      else rig.follow(point, 1 / 60);
      rig.update(1 / 60);
      expect(Number.isFinite(rig.target.x + rig.target.y + rig.target.z + rig.radius)).toBe(true);
      expect(Math.hypot(rig.target.x, rig.target.z)).toBeLessThanOrEqual(CAMERA.pivotRadius + 1e-6);
      expect(rig.target.y).toBeGreaterThanOrEqual(-2.4 - 1e-6);
      expect(rig.target.y).toBeLessThanOrEqual(0.4 + 1e-6);
      expect(rig.radius).toBeGreaterThanOrEqual(CAMERA.minRadius - 1e-6);
      expect(rig.radius).toBeLessThanOrEqual(CAMERA.maxRadius + 1e-6);
    }
  });

  it('zoom changes distance only, never the pivot', () => {
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.06, 400);
    const rig = new CameraRig(camera);
    rig.reset();
    rig.update(1);
    const before = rig.target.clone();
    rig.zoom(-600);
    rig.update(1 / 60);
    expect(rig.target.distanceTo(before)).toBeLessThan(1e-9);
    expect(rig.radius).toBeLessThan(CAMERA.radius);
  });

  it('focus beyond an edge is clamped to the same small board-centred radius', () => {
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.06, 400);
    const rig = new CameraRig(camera);
    rig.focus(new THREE.Vector3(500, 5, -500), CAMERA.followRadius);
    expect(Math.hypot(rig['wantTarget'].x, rig['wantTarget'].z)).toBeCloseTo(CAMERA.pivotRadius, 8);
    expect(rig['wantTarget'].y).toBe(0.4);
  });
});
