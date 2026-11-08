declare module 'troika-three-text' {
  import { Object3D } from 'three';

  export class Text extends Object3D {
    text: string;
    fontSize: number;
    color: string | number;
    font: string | null;
    fontWeight: number | string;
    anchorX: number | string;
    anchorY: number | string;
    maxWidth: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    letterSpacing: number;
    material: {
      depthWrite: boolean;
      color: { set(value: unknown): void };
      dispose(): void;
      [key: string]: unknown;
    };
    renderOrder: number;
    visible: boolean;
    sync(callback?: () => void): Promise<void>;
    dispose(): void;
  }
}
