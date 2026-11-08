import * as THREE from 'three';
import { MODEL } from '../config';

/** Flat display disc under thin tokens — a flat shape, never a modelled object. */
export function createPedestal(color: THREE.ColorRepresentation): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(MODEL.pedestalRadius, 32),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.9 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.006;
  mesh.receiveShadow = false;
  return mesh;
}

