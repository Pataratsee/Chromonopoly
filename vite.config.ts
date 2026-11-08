import { defineConfig, type Plugin } from 'vite';

/** The source-tree redirect is only for a plain static server; never ship it. */
const stripStaticSourceRedirect: Plugin = {
  name: 'strip-static-source-redirect',
  apply: 'build',
  transformIndexHtml(html) {
    const built = html.replace(/\s*<script id="static-source-redirect">[\s\S]*?<\/script>/, '');
    const head = [
      '    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />',
      '    <link rel="preload" href="./fonts/Inter-var.ttf" as="font" type="font/ttf" crossorigin />',
      '    <link rel="preload" href="./fonts/Outfit-var.ttf" as="font" type="font/ttf" crossorigin />',
    ].join('\n');
    return built.replace('  </head>', `${head}\n  </head>`);
  },
};

export default defineConfig({
  plugins: [stripStaticSourceRedirect],
  // Relative assets let the same build run at / (Node) or /dist/ (static server).
  base: './',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
});
