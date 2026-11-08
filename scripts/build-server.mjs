#!/usr/bin/env node
/** Bundles server/index.ts (and the shared board data) into one runnable ESM file. */
import { build } from 'esbuild';

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist-server/index.js',
  external: ['node:*'],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
console.log('server bundled to dist-server/index.js');
