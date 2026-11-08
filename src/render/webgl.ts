import * as THREE from 'three';

export interface WebGLRendererOptions {
  alpha?: boolean;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: WebGLPowerPreference;
  stencil?: boolean;
}

function contextAttributes(options: WebGLRendererOptions, conservative: boolean): WebGLContextAttributes {
  return {
    alpha: options.alpha ?? true,
    depth: true,
    stencil: options.stencil ?? false,
    antialias: conservative ? false : options.antialias ?? false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    powerPreference: conservative ? 'default' : options.powerPreference ?? 'default',
    failIfMajorPerformanceCaveat: false,
  };
}

/**
 * Three r181 has a broken error path when WebGL context creation fails: it
 * calls the caught exception as if it were console.error, producing the
 * misleading "L is not a function". Create the context first and hand it to
 * Three so context failures become a useful message instead.
 */
export function createWebGLRenderer(
  canvas: HTMLCanvasElement,
  options: WebGLRendererOptions = {},
): THREE.WebGLRenderer {
  let context = canvas.getContext('webgl2', contextAttributes(options, false)) as WebGL2RenderingContext | null;
  if (!context) {
    // Some GPUs/browsers reject high-performance or antialiased contexts but
    // still provide a plain WebGL2 context. Try one conservative fallback.
    context = canvas.getContext('webgl2', contextAttributes(options, true)) as WebGL2RenderingContext | null;
  }
  if (!context) {
    throw new Error(
      'WebGL 2 is unavailable. Enable hardware acceleration in your browser, close other 3D tabs, and reload.',
    );
  }

  try {
    return new THREE.WebGLRenderer({
      canvas,
      context: context as unknown as WebGLRenderingContext,
      alpha: options.alpha ?? true,
      antialias: options.antialias ?? false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      powerPreference: options.powerPreference ?? 'default',
      stencil: options.stencil ?? false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`The 3D renderer could not start: ${detail}`);
  }
}
