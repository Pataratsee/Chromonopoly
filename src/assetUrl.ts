/**
 * Resolve a bundled public asset against the page's base URL.
 * The Node server serves `dist/` at `/`; a plain static server at the project
 * root redirects to `/dist/`, so absolute paths would miss the files.
 */
export function assetUrl(path: string): string {
  // Unit tests run in Node, where there is no document. They never fetch it.
  const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
  return new URL(path.replace(/^\/+/, ''), base).href;
}
