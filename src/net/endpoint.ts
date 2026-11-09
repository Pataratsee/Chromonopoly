/**
 * One origin for the game server, used by HTTP and WebSocket alike.
 *
 * Local dev and `npm start` serve the client and server from one origin, so the
 * relative path is correct. A static deployment (GitHub Pages) sets
 * VITE_GAME_SERVER_URL to the server origin at build time.
 */
const configured = (): string => (import.meta.env.VITE_GAME_SERVER_URL ?? '').trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const origin = configured();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${suffix}` : suffix;
}

export function socketUrl(): string {
  const origin = configured();
  if (!origin) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${location.host}/ws`;
  }
  const url = new URL(origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws';
  return url.toString();
}

export async function apiFetch(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(apiUrl(path), { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The server took too long to answer.');
    }
    throw new Error('Cannot reach the game server.');
  } finally {
    window.clearTimeout(timeout);
  }
}
