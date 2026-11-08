import type { Settings } from '../game/types';

const KEY = 'chromonopoly.settings';

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  sfxOn: true,
  musicOn: true,
  cameraSpeed: 1,
  invertOrbit: false,
  shake: false,
  quality: 'high',
  reducedMotion: false,
  uiScale: 1,
  colorblind: false,
  showPrices: true,
  darkMode: false,
  followCamera: false,
  skyRunning: true,
  skyHour: 9,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
  applySettings(settings);
}

export function applySettings(settings: Settings): void {
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(settings.uiScale));
  document.body.dataset.theme = settings.darkMode ? 'dark' : 'light';
  document.body.dataset.reducedMotion = settings.reducedMotion ? 'on' : 'off';
  const ui = document.getElementById('ui');
  if (ui) ui.dataset.colorblind = settings.colorblind ? 'on' : 'off';
}

export function isRestarting(): boolean {
  return sessionStorage.getItem('chromonopoly.restart') === '1';
}

export function clearRestartFlag(): void {
  sessionStorage.removeItem('chromonopoly.restart');
}
