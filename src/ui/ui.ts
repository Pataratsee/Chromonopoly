import { PALETTE, money, QUALITY, type QualityKey } from '../config';
import { SPACES, spaceAt } from '../game/board';
import { BUILDING_CATEGORIES, BUILDING_META, buildingCost, buildingInvested, buildingRent, buildingTypesForMode, buildSlots, canBuild, evadeChance, mortgageValue, multiplayerRent, rentFor, robberyAmountIssues, robberyChance, suitChance, unmortgageCost, upgradeCost, RULES } from '../game/rules';
import { perksForOwner } from '../game/perks';
import type { Candle, ChanceRoll, CrimeOutcome, GameEvent, GameMode, PrivateState, PublicState, Settings, Suit, TradeOffer } from '../game/types';
import { maxBuyShares } from '../game/market';
import { CandleChart } from './marketChart';
import { soloKey } from '../net/client';
import { apiFetch } from '../net/endpoint';
import { normalizeUsername, usernameIssue } from '../game/username';
import type { ModelAsset } from '../render/models';
import type { ThumbnailStudio } from '../render/thumbnails';
import { audio } from '../audio/audio';
import { DEFAULT_SETTINGS, clearRestartFlag, isRestarting, loadSettings, saveSettings } from './settings';
import type { NetClient } from '../net/client';
import { intentKey } from '../net/client';
import { rotationAt, segmentsForDisplay, segmentAtRotation, spinPlan, wheelColor, wheelZones, WheelStateMachine } from './chanceWheel';
import './styles.css';

void PALETTE;

declare global {
  interface Window {
    __chanceWheel?: WheelStateMachine;
    __chanceTransitions?: Array<{ state: string; at: number }>;
  }
}

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const ICONS: Record<string, string> = {
  roller: '<path d="M4 8h9a3 3 0 0 1 3 3v2a2 2 0 0 0 2 2h2"/><rect x="2" y="5" width="12" height="6" rx="2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
  bank: '<path d="M3 10h18"/><path d="M5 10v8"/><path d="M9 10v8"/><path d="M15 10v8"/><path d="M19 10v8"/><path d="M3 21h18"/><path d="M12 3l9 4H3z"/>',
  mask: '<path d="M4 6h16v6a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M8 10h2"/><path d="M14 10h2"/>',
  gavel: '<g transform="rotate(45 16 6)"><rect x="10" y="2.8" width="10.5" height="6.4" rx="1.6"/><path d="M13 3v6M17.5 3v6"/></g><path d="M11.5 11.5L4 19" stroke-width="3"/><path d="M2.8 21h7"/>',
  scroll: '<path d="M5 4h11a2 2 0 0 1 0 4h-2v12H6a2 2 0 0 1-2-2z"/><path d="M9 8h5"/><path d="M9 12h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  token: '<circle cx="9" cy="7" r="3"/><path d="M6 21h7"/><path d="M7 18h5l-1-5"/><path d="M6 13c-1.8 1.4-2.8 3-2.8 5h11.6c0-2-1-3.6-2.8-5"/><path d="M18 5v6M15 8h6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  rotateL: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  rotateR: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  home: '<path d="M3 10l9-7 9 7"/><path d="M5 9v11h14V9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 8h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
};

function icon(name: string, size = 20): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = ICONS[name] ?? ICONS.info!;
  return svg;
}

const GROUP_LABEL: Record<string, string> = {
  brown: 'Brown',
  lightblue: 'Light blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  darkblue: 'Dark blue',
  railroad: 'Railroad',
  utility: 'Utility',
  corner: 'Corner',
};

const CATEGORY_ORDER = ['vehicle', 'animal', 'food', 'object', 'fantasy'];

export interface UIDeps {
  net: NetClient;
  studio: ThumbnailStudio;
  assets: ModelAsset[];
  onSettings: (settings: Settings) => void;
}

export class UI {
  private readonly root: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly sheetLayer: HTMLElement;
  private readonly scrim: HTMLElement;
  private sheet: HTMLElement | null = null;
  private state: PublicState | null = null;
  private priv: PrivateState | null = null;
  private settings: Settings = loadSettings();
  private selectedToken = 'cat';
  private currentSheet = '';
  private history = new Map<number, number[]>();
  private moneyEls = new Map<HTMLElement, { shown: number; target: number }>();
  private menuOpen = false;
  private gameOverShown = false;
  private raf = 0;
  private stopPreview: (() => void) | null = null;
  private tableStage: HTMLElement | null = null;
  private chanceQueue: Promise<void> = Promise.resolve();
  private lastBustedAt = 0;
  private logBody: HTMLElement | null = null;
  private tutorialStep = 0;
  private tutorialPending = false;
  private promptsBlocked = false;
  private logTab: 'main' | 'players' | 'market' = 'main';
  private logPlayer: string | null = null;
  private marketLive: (() => void) | null = null;
  private sheetTile: number | null = null;
  private menuPanel: HTMLElement | null = null;
  private menuError = '';

  constructor(private readonly deps: UIDeps) {
    this.root = document.getElementById('ui') as HTMLElement;
    this.toasts = h('div', { class: 'toast-layer' });
    this.scrim = h('div', { class: 'sheet-scrim', onclick: () => this.closeSheet() });
    this.sheetLayer = h('div', { class: 'sheet-layer' }, this.scrim);
    document.body.append(this.toasts, this.sheetLayer);
    this.selectedToken = localStorage.getItem('chromonopoly.token') ?? 'cat';
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.currentSheet) this.closeSheet();
        else if (this.menuOpen) return;
      }
    });
    this.animate();
  }

  get settingsValue(): Settings {
    return this.settings;
  }

  mount(): void {
    this.deps.net.onJoinRejected = (reason) => {
      this.menuError = reason;
      document.getElementById('hud')?.classList.add('hidden');
      this.renderMenu();
      this.toast(reason, 'bad');
    };
    this.deps.net.onStatus = (status, reason) => {
      const dot = document.getElementById('net-dot');
      dot?.classList.toggle('off', status !== 'online');
      const offline = document.getElementById('offline-banner');
      if (offline instanceof HTMLElement) offline.hidden = status === 'online';
      if (status === 'offline') this.ribbon('Connection lost — retrying', reason ?? 'Your seat is held while the browser reconnects.');
      else if (status === 'online') {
        this.ribbon(this.state?.mode === 'solo' ? 'Your table is ready' : 'Shared world');
        this.deps.net.resync();
      }
    };
    this.root.append(this.buildHud());
    this.tableStage = h('div', { class: 'table-stage', id: 'table-stage' });
    this.root.append(this.tableStage);
    document.getElementById('hud')?.classList.add('hidden');
    this.renderMenu();
    this.applySettings();
    if (isRestarting()) {
      clearRestartFlag();
      this.join(localStorage.getItem('chromonopoly.name') ?? 'Tycoon', 'solo', true);
    } else if (sessionStorage.getItem('chromonopoly.tutorial') === '1') {
      this.tutorialPending = true;
      this.join(localStorage.getItem('chromonopoly.name') ?? 'Tycoon', 'solo');
    }
  }

  applySettings(): void {
    saveSettings(this.settings);
    this.deps.onSettings(this.settings);
    const ui = document.getElementById('ui');
    if (ui) ui.dataset.colorblind = this.settings.colorblind ? 'on' : 'off';
    document.documentElement.style.setProperty('--ui-scale', String(this.settings.uiScale));
    document.body.dataset.theme = this.settings.darkMode ? 'dark' : 'light';
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.updateThinking();
  }

  // --------------------------------------------------------------- shell

  private buildHud(): HTMLElement {
    const hud = h('div', { class: 'hud', id: 'hud' });
    hud.innerHTML = '';

    const chip = h('div', { class: 'player-chip glass', id: 'player-chip' });
    chip.append(
      h('div', { class: 'avatar', id: 'you-avatar' }, 'Y'),
      h(
        'div',
        { class: 'player-meta' },
        h('div', { class: 'player-name', id: 'you-name' }, 'Connecting…'),
        h('div', { class: 'player-cash mono', id: 'you-cash' }, '$0'),
      ),
      h('div', { class: 'online-dot off', id: 'net-dot' }),
    );

    const ribbon = h('div', { class: 'ribbon', id: 'ribbon' }, 'CHROMONOPOLY');
    const ribbonSub = h('div', { class: 'ribbon-sub', id: 'ribbon-sub' }, 'Choose a mode to enter');
    const ribbons = h('div', { class: 'ribbon-wrap' }, ribbon, ribbonSub);
    const thinking = h('div', { class: 'thinking-dots glass', id: 'thinking-dots', hidden: true, 'aria-live': 'polite' },
      h('span', { id: 'thinking-name' }, 'Rival'),
      h('span', {}, 'is thinking'),
      h('i', {}), h('i', {}), h('i', {}),
    );
    const offline = h('div', { class: 'offline-banner glass', id: 'offline-banner', role: 'status', hidden: true },
      h('b', {}, 'Offline'), h('span', {}, 'Retrying with backoff — your seat and queued actions are held.'),
    );

    const networth = h('div', { class: 'networth glass' }, h('b', { id: 'networth' }, '$0'), h('span', {}, 'net worth'));
    const modeBadge = h('div', { class: 'mode-badge glass', id: 'mode-badge' }, 'Shared world');
    const topRight = h('div', { class: 'top-right' }, modeBadge, networth);

    const topbar = h('div', { class: 'topbar' }, chip, ribbons, topRight);

    const rail = h('aside', { class: 'rail glass', id: 'rail' });
    rail.append(h('div', { class: 'rail-title' }, 'On the board'));

    const dock = h('div', { class: 'bottombar glass', id: 'dock' });
    const rollBtn = h('button', { class: 'roll-btn', id: 'roll-btn', onclick: () => this.roll() }, 'ROLL');
    const hint = h('div', { class: 'roll-hint', id: 'roll-hint' }, 'Space or click to roll');
    const tabs = h('div', { class: 'bar-tabs' });
    const tab = (label: string, iconName: string, open: () => void): HTMLElement =>
      h('button', { class: 'bar-tab', 'data-dock': label, onclick: open }, icon(iconName, 23), h('span', {}, label));
    tabs.append(
      tab('Market', 'chart', () => this.openMarket()),
      tab('Bank', 'bank', () => this.openBank()),
      tab('Underworld', 'mask', () => this.openCrime()),
      tab('Detective', 'search', () => this.openDetective()),
      tab('Properties', 'home', () => this.openProperties()),
      tab('Reputation', 'scroll', () => this.openReputation()),
    );
    const actions = h('div', { class: 'bar-actions' });
    const action = (label: string, iconName: string, open: () => void): HTMLElement =>
      h('button', { class: 'bar-action', 'aria-label': label, title: label, onclick: open }, icon(iconName, 23), h('span', {}, label));
    actions.append(
      action('Pieces', 'token', () => this.openTokens()),
      action('Court', 'gavel', () => this.openCourt()),
      action('Log', 'scroll', () => this.openLog()),
      action('Settings', 'gear', () => this.openSettings()),
    );
    dock.append(tabs, h('div', { class: 'roll-wrap' }, rollBtn, hint), actions);

    hud.append(offline, thinking, topbar, rail, this.cameraControls(), dock);
    return hud;
  }

  private cameraControls(): HTMLElement {
    const wrap = h('div', { class: 'camera-controls' });
    wrap.append(
      h('button', { class: 'icon-btn glass', 'aria-label': 'Rotate left', onclick: () => this.emitCamera('left') }, icon('rotateL', 18)),
      h('button', { class: 'icon-btn glass', 'aria-label': 'Reset camera', onclick: () => this.emitCamera('reset') }, icon('home', 18)),
      h('button', { class: 'icon-btn glass', 'aria-label': 'Rotate right', onclick: () => this.emitCamera('right') }, icon('rotateR', 18)),
    );
    return wrap;
  }

  private emitCamera(action: 'left' | 'right' | 'reset'): void {
    window.dispatchEvent(new CustomEvent('chromonopoly:camera', { detail: action }));
    audio.play('click');
  }

  // --------------------------------------------------------------- accounts

  private showOutcome(outcome: CrimeOutcome): Promise<void> {
    document.getElementById('crime-result')?.remove();
    return new Promise((resolve) => {
      const layer = h(
        'div',
        { class: `crime-result ${outcome.success ? 'good' : 'bad'}`, id: 'crime-result', role: 'dialog', 'aria-live': 'assertive' },
        h('div', { class: 'crime-result-card glass-strong' },
          h('div', { class: 'crime-result-kicker' }, outcome.kind === 'robbery' ? 'Bank robbery' : outcome.kind === 'murder' ? 'Murder attempt' : outcome.kind === 'detective' ? 'Detective report' : outcome.kind === 'wipe' ? 'Record wipe' : 'Underworld job'),
          h('h3', {}, outcome.success ? 'Success' : 'Failure'),
          h('p', { class: 'crime-result-detail' }, outcome.detail),
          outcome.amount !== 0 ? h('div', { class: 'stat-row' }, h('span', {}, outcome.amount > 0 ? 'Gained' : 'Lost'), h('b', {}, money(Math.abs(outcome.amount)))) : null,
          outcome.targetName ? h('div', { class: 'stat-row' }, h('span', {}, 'Target'), h('b', {}, outcome.targetName)) : null,
          outcome.taken?.length ? h('div', { class: 'stat-row' }, h('span', {}, 'Properties transferred'), h('b', {}, outcome.taken.join(', '))) : null,
          outcome.reputationDelta ? h('div', { class: 'stat-row' }, h('span', {}, 'Reputation'), h('b', {}, `${outcome.reputationDelta > 0 ? '+' : ''}${outcome.reputationDelta}`)) : null,
          h('button', { class: 'btn btn-gold btn-block', onclick: () => { layer.remove(); resolve(); } }, 'Continue'),
        ),
      );
      document.body.append(layer);
    });
  }

  private renderMenu(): void {
    const existing = document.querySelector('.menu');
    existing?.remove();
    this.menuOpen = true;
    const card = h('div', { class: 'menu-card glass-strong' });
    const left = h('div', { class: 'menu-left' });
    left.append(
      h('div', { class: 'menu-kicker' }, 'Property · power · a little larceny'),
      h('h1', { class: 'menu-logo' }, 'Chromo', h('span', {}, 'nopoly')),
      h('p', { class: 'menu-sub' }, 'Buy streets, build skylines, and outlast everyone. Play a proper table against three AI — or take the one shared board with everyone else.'),
    );
    const panel = h('div', { class: 'menu-panel' });
    left.append(panel);
    this.menuPanel = panel;
    this.showHomePanel(panel);

    const preview = h('canvas', { id: 'menu-preview' }) as HTMLCanvasElement;
    const previewLoading = h('div', { class: 'menu-preview-loading', id: 'menu-preview-loading' }, h('i', {}), h('span', {}, 'Loading island…'));
    const tokenName = h('b', { id: 'menu-token-name' }, this.assetName(this.selectedToken));
    const right = h(
      'div',
      { class: 'menu-right' },
      preview,
      previewLoading,
      h('div', { class: 'preview-corner tl glass' }, 'LIVE 3D'),
      h('div', { class: 'preview-corner tr glass' }, 'YOUR PIECE'),
      h('div', { class: 'preview-corner bl glass' }, tokenName),
      h('div', { class: 'preview-corner br glass' }, 'TAP TO CHANGE'),
    );
    card.append(left, right);
    const menu = h('div', { class: 'menu' }, card);
    document.body.append(menu);

    preview.addEventListener('click', () => {
      audio.play('click');
      this.openTokens(true);
    });

    this.stopPreview?.();
    this.stopPreview = this.deps.studio.preview(preview, this.selectedToken, 'token', () => {
      previewLoading.classList.add('done');
      window.setTimeout(() => previewLoading.remove(), 260);
    });
  }

  private showHomePanel(panel: HTMLElement): void {
    const name = h('input', { class: 'field', id: 'player-name', maxlength: '16', placeholder: 'Your name', autocomplete: 'nickname', spellcheck: 'false' }) as HTMLInputElement;
    name.value = localStorage.getItem('chromonopoly.name') ?? '';
    const error = h('p', { class: 'auth-error', role: 'alert', style: this.menuError ? '' : 'display:none' }, this.menuError);
    this.menuError = '';
    const commit = (): string | null => {
      const clean = normalizeUsername(name.value);
      const issue = usernameIssue(clean);
      if (issue) {
        error.textContent = issue;
        error.style.display = '';
        this.toast(issue, 'bad');
        name.focus();
        return null;
      }
      localStorage.setItem('chromonopoly.name', clean);
      error.style.display = 'none';
      return clean;
    };
    const solo = h('button', { class: 'mode-btn solo', id: 'solo-btn' },
      h('span', { class: 'mode-eyebrow' }, '3 AI rivals'),
      h('b', {}, 'Single Player'),
      h('span', { class: 'mode-note' }, 'A proper table. One player acts at a time.'));
    const multi = h('button', { class: 'mode-btn multi', id: 'multi-btn' },
      h('span', { class: 'mode-eyebrow' }, 'No password · shared board'),
      h('b', {}, 'Multiplayer'),
      h('span', { class: 'mode-note' }, 'Click once and you are on the board.'));
    solo.addEventListener('click', () => { if (commit()) this.showSoloPanel(panel); });
    multi.addEventListener('click', () => {
      const clean = commit();
      if (clean) this.join(clean, 'multi');
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const clean = commit(); if (clean) this.join(clean, 'multi'); } });
    panel.replaceChildren(
      h('div', { class: 'name-field' }, h('label', { for: 'player-name' }, 'Your name'), name, error),
      h('p', { class: 'note' }, '3–16 letters, numbers, spaces or underscores. Saved on this browser. Your name is reserved while you are connected or own something on the board.'),
      h('div', { class: 'menu-actions' }, solo, multi),
      h('div', { class: 'menu-footer' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => this.openSettings() }, 'Settings'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => this.openHelp() }, 'How to play'),
      ),
    );
  }

  private async showSoloPanel(panel: HTMLElement): Promise<void> {
    panel.replaceChildren(h('div', { class: 'menu-loading' }, h('i', {}), h('span', {}, 'Checking your table…')));
    const key = soloKey();
    let save: SoloMeta | null = null;
    let unreachable = '';
    if (key) {
      try {
        const res = await apiFetch(`/api/solo?key=${encodeURIComponent(key)}`);
        if (res.ok) save = (await res.json()) as SoloMeta;
      } catch (error) {
        unreachable = error instanceof Error ? error.message : 'Cannot reach the game server.';
      }
    }
    const hasSave = Boolean(save?.exists);
    const details = hasSave
      ? `${save!.playerName ?? 'Your table'} · turn ${save!.turnNumber ?? 1} · ${save!.played ?? 0} players`
      : save?.corrupt
        ? 'The saved table is damaged and cannot be loaded.'
        : 'No saved single-player table yet.';
    const continueBtn = h(
      'button',
      {
        class: 'mode-btn solo',
        id: 'continue-btn',
        disabled: !hasSave || Boolean(unreachable),
        title: unreachable || (hasSave ? 'Continue your table' : save?.corrupt ? 'The save is damaged' : 'No saved game yet'),
      },
      h('span', { class: 'mode-eyebrow' }, 'Resume'),
      h('b', {}, 'Continue Game'),
      h('span', { class: 'mode-note' }, details),
    );
    const newBtn = h(
      'button',
      { class: 'mode-btn multi', id: 'new-game-btn', disabled: Boolean(unreachable) },
      h('span', { class: 'mode-eyebrow' }, 'Fresh start'),
      h('b', {}, 'New Game'),
      h('span', { class: 'mode-note' }, hasSave ? 'This replaces your saved table after confirmation.' : 'Start a fresh table with three AI rivals.'),
    );
    const rows: HTMLElement[] = [
      h('button', { class: 'menu-back', onclick: () => this.showHomePanel(panel) }, '← Main menu'),
      h('div', { class: 'menu-section-title' }, 'Single Player'),
    ];
    if (unreachable) {
      rows.push(h('p', { class: 'auth-status offline', role: 'status' }, h('i', {}), h('span', {}, unreachable), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => void this.showSoloPanel(panel) }, 'Retry')));
    }
    rows.push(h('div', { class: 'menu-actions' }, continueBtn, newBtn));
    panel.replaceChildren(...rows);
    continueBtn.addEventListener('click', () => this.startSolo(false));
    newBtn.addEventListener('click', () => {
      if (hasSave && !window.confirm('Start a new game? Your saved single-player table will be overwritten.')) return;
      this.startSolo(true);
    });
  }

  private startSolo(fresh: boolean): void {
    const name = normalizeUsername(localStorage.getItem('chromonopoly.name') ?? '');
    if (usernameIssue(name)) {
      if (this.menuPanel) this.showHomePanel(this.menuPanel);
      return;
    }
    this.join(name, 'solo', fresh);
  }

  private assetName(id: string): string {
    return this.deps.assets.find((a) => a.id === id)?.name ?? id;
  }

  private join(name: string, mode: GameMode, fresh = false): void {
    localStorage.setItem('chromonopoly.name', name);
    this.deps.net.setIdentity(name, this.selectedToken);
    audio.resume();
    if (fresh) this.deps.net.restart(name, this.selectedToken, mode);
    else this.deps.net.connect(name, this.selectedToken, mode);
    const menu = document.querySelector('.menu');
    if (menu instanceof HTMLElement) {
      menu.style.transition = 'opacity 260ms ease';
      menu.style.opacity = '0';
      setTimeout(() => menu.remove(), 270);
    }
    this.menuOpen = false;
    document.getElementById('hud')?.classList.remove('hidden');
    this.stopPreview?.();
    this.stopPreview = null;
    const badge = document.getElementById('mode-badge');
    if (badge) badge.textContent = mode === 'solo' ? 'Solo table' : 'Shared world';
    this.ribbon(mode === 'solo' ? 'Your table is ready' : 'Shared world', mode === 'solo' ? 'Turn-based · three AI rivals' : 'One board · everyone plays at once');
  }

  // ---------------------------------------------------------------- state

  setState(state: PublicState): void {
    this.state = state;
    const badge = document.getElementById('mode-badge');
    if (badge) badge.textContent = state.mode === 'solo' ? 'Solo table' : 'Shared world';
    for (const space of SPACES) {
      const arr = this.history.get(space.index) ?? [];
      const price = state.prices[space.index] ?? 0;
      if (price > 0 && arr[arr.length - 1] !== price) {
        arr.push(price);
        if (arr.length > 60) arr.shift();
        this.history.set(space.index, arr);
      }
    }
    const you = this.deps.net.playerId;
    if (!you) return;
    const me = state.players[you];
    if (!me) return;
    this.updateHud(me);
    const dot = document.getElementById('net-dot');
    dot?.classList.remove('off');
    if (this.tutorialPending && !document.getElementById('tutorial-card')) {
      this.tutorialPending = false;
      this.tutorialStep = 0;
      window.setTimeout(() => this.showTutorialStep(), 850);
    }
    if (state.gameOver && !this.gameOverShown) {
      this.gameOverShown = true;
      this.openEndgame(state.gameOver.winnerId);
    }
    if (this.currentSheet === 'log') this.renderLog();
    if (this.currentSheet === 'market') this.marketLive?.();
    this.refreshTileActions();
    this.updateThinking();
  }

  private openEndgame(winnerId: string): void {
    const winner = this.state?.players[winnerId];
    const body = h('div', {});
    body.append(
      h('p', { class: 'note' }, winner ? `${winner.name} owns the board.` : 'The board is empty.'),
      h('div', { class: 'group' }, ...Object.values(this.state?.players ?? {})
        .sort((a, b) => b.cash - a.cash)
        .map((p) => h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, p.name), h('div', { class: 'row-sub' }, p.bankrupt ? 'bankrupt' : `${money(p.cash)} cash`))))),
      h('button', { class: 'btn btn-gold btn-block', onclick: () => { this.gameOverShown = false; this.closeSheet(); } }, 'Keep watching'),
    );
    this.openSheet('endgame', 'Game over', 'Final standings', body);
  }

  setPromptsBlocked(blocked: boolean): void {
    this.promptsBlocked = blocked;
    if (blocked) document.getElementById('pending-overlay')?.remove();
    const me = this.priv ? this.state?.players[this.priv.you.id] ?? this.priv.you : null;
    if (me) this.updateHud(me);
    else {
      const roll = document.getElementById('roll-btn') as HTMLButtonElement | null;
      if (roll) roll.disabled = blocked;
    }
    if (!blocked) this.renderPending();
  }

  setPrivate(priv: PrivateState): void {
    this.priv = priv;
    this.updateHud(this.state?.players[priv.you.id] ?? priv.you);
    // Private evidence can arrive after the Court sheet has opened. Update the
    // rows in place so the dossier status does not stay stale behind the modal.
    if (this.currentSheet === 'court') this.refreshCourt();
    if (this.currentSheet === 'bank') this.refreshTransient();
    if (this.sheet) this.refreshTransient();
    this.refreshTileActions();
  }

  /** Live upgrade price and disabled reason, without rebuilding the open deed. */
  private refreshTileActions(): void {
    if (this.currentSheet !== 'tile' || this.sheetTile === null || !this.state) return;
    const tile = this.state.tiles[this.sheetTile];
    const space = spaceAt(this.sheetTile);
    if (!tile) return;
    for (const button of this.sheet?.querySelectorAll<HTMLButtonElement>('[data-upgrade]') ?? []) {
      const building = tile.buildings[Number(button.dataset.slot ?? -1)];
      if (!building) continue;
      const nextRank = (building.rank + 1) as 2 | 3 | 4;
      const nextCost = upgradeCost(space, building.type, nextRank);
      const blocked = tile.lockedBy ? 'Deeds are locked by a pending lawsuit' : (this.priv?.you.cash ?? 0) < nextCost ? `Need ${money(nextCost)}` : '';
      button.disabled = Boolean(blocked);
      button.title = blocked;
      button.textContent = `Upgrade ${money(nextCost)}`;
    }
  }

  private updateThinking(): void {
    const element = document.getElementById('thinking-dots');
    if (!element) return;
    const active = this.state?.activePlayerId ? this.state.players[this.state.activePlayerId] : null;
    const show = Boolean(this.state?.mode === 'solo' && active?.isBot && !this.settings.fastBots && !this.state.gameOver);
    element.hidden = !show;
    const name = document.getElementById('thinking-name');
    if (name) name.textContent = active?.name ?? 'Rival';
  }

  private updateHud(me: { name: string; color: string; cash: number; isBot: boolean }): void {
    const nameEl = document.getElementById('you-name');
    if (nameEl) nameEl.textContent = me.name;
    const avatar = document.getElementById('you-avatar');
    if (avatar) {
      avatar.textContent = me.name.slice(0, 1).toUpperCase();
      avatar.style.background = me.color;
    }
    const cash = document.getElementById('you-cash');
    if (cash && this.priv) this.countMoney(cash, this.priv.you.cash);
    const nw = document.getElementById('networth');
    if (nw && this.priv) this.countMoney(nw, this.priv.netWorth);
    const roll = document.getElementById('roll-btn') as HTMLButtonElement | null;
    if (roll) {
      const pending = Boolean(this.priv?.pending);
      const jailed = this.priv?.you.inJail ?? false;
      const hospital = this.priv?.you.inHospital ?? false;
      const solo = this.state?.mode === 'solo';
      const activeId = this.state?.activePlayerId ?? null;
      const waiting = Boolean(solo && activeId && activeId !== this.priv?.you.id);
      // A hospital stay is advanced by rolling: never lock the button, or the
      // patient can never be discharged.
      roll.disabled = this.promptsBlocked || pending || waiting || Boolean(this.state?.gameOver);
      roll.textContent = hospital ? 'RECOVER' : waiting ? 'WAIT' : jailed ? 'SERVE' : 'ROLL';
    }
    const hint = document.getElementById('roll-hint');
    if (hint && this.priv) {
      const solo = this.state?.mode === 'solo';
      const active = this.state?.activePlayerId ? this.state.players[this.state.activePlayerId] : null;
      hint.textContent = this.priv.you.inHospital
        ? `Hospital · ${this.priv.you.hospitalTurns} turns`
        : solo && active && active.id !== this.priv.you.id
          ? `${active.name}'s turn`
          : this.priv.pending
            ? 'Resolve the offer below'
            : this.priv.you.inJail
              ? `${this.priv.you.jailTurns} turns left — or pay to restore your deeds`
              : solo
                ? 'Your turn · Space or click to roll'
                : 'Space or click to roll';
    }
    this.renderRail();
    this.renderPending();
    this.renderJailBadge();
  }

  private renderRail(): void {
    const rail = document.getElementById('rail');
    if (!rail || !this.state) return;
    const me = this.deps.net.playerId;
    rail.innerHTML = '';
    rail.append(h('div', { class: 'rail-title' }, 'On the board'));
    const players = Object.values(this.state.players).sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || b.cash - a.cash);
    const solo = this.state.mode === 'solo';
    for (const p of players) {
      const row = h('div', { class: `rail-row${p.id === me ? ' active' : ''}${solo && p.id === this.state.activePlayerId ? ' turn' : ''}` });
      const av = h('div', { class: 'avatar', style: `background:${p.color}` }, p.name.slice(0, 1).toUpperCase());
      const meta = h('div', { class: 'grow' }, h('div', { class: 'rail-name' }, p.name), h('div', { class: 'rail-cash' }, money(p.cash)));
      row.append(av, meta);
      if (p.bankrupt) row.append(h('span', { class: 'badge' }, 'out'));
      else if (p.inHospital) row.append(h('span', { class: 'badge hospital' }, 'hospital'));
      else if (p.inJail) row.append(h('span', { class: 'badge' }, 'jail'));
      else if (solo && p.id === this.state.activePlayerId) row.append(h('span', { class: 'badge turn' }, 'turn'));
      else if (p.isBot) row.append(h('span', { class: 'badge bot' }, 'bot'));
      row.addEventListener('click', () => {
        if (p.inJail || p.jailRecord.length) this.openJailRecord(p.id);
      });
      rail.append(row);
    }
  }

  private renderJailBadge(): void {
    const existing = document.getElementById('jail-card');
    if (!this.priv?.you.inJail) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const card = h(
      'div',
      { class: 'jail-card glass', id: 'jail-card' },
      h('b', {}, 'In jail'),
      h('span', { class: 'small muted' }, `${this.priv.you.jailCause ?? 'Jailed'} · ${this.priv.you.jailOutcome === 'all' ? 'all deeds sold' : this.priv.you.jailOutcome === 'some' ? `${this.priv.you.jailSold.length} sold` : 'deeds mortgaged'} · release ${money(this.priv.you.jailReleaseCost)}`),
      h('button', { class: 'btn btn-sm btn-gold', disabled: this.priv.you.cash < this.priv.you.jailReleaseCost, title: this.priv.you.cash < this.priv.you.jailReleaseCost ? `Need ${money(this.priv.you.jailReleaseCost - this.priv.you.cash)} more cash` : `10% of cash, minimum ${money(RULES.jailFeeMin)}`, onclick: () => this.send({ t: 'jailPay', key: intentKey('jail') }) }, `Pay ${money(this.priv.you.jailReleaseCost)} to get out`),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.openJailRecord(this.priv!.you.id) }, 'Public record'),
    );
    document.getElementById('hud')?.append(card);
  }

  // -------------------------------------------------------------- actions

  private send(intent: Parameters<NetClient['send']>[0]): void {
    this.deps.net.send(intent);
  }

  private roll(): void {
    audio.resume();
    audio.play('dice');
    this.startDice();
    window.dispatchEvent(new CustomEvent('chromonopoly:dice', { detail: 'roll' }));
    window.dispatchEvent(new CustomEvent('chromonopoly:roll-start'));
    this.send({ t: 'roll', key: intentKey('roll') });
  }

  private renderPending(): void {
    const existing = document.getElementById('pending-sheet');
    const pending = this.priv?.pending;
    const layer = document.getElementById('pending-overlay');
    if (this.promptsBlocked) {
      layer?.remove();
      return;
    }
    if (!pending) {
      layer?.remove();
      return;
    }
    if (existing && layer && layer.dataset.tile === String(pending.tile) && layer.dataset.kind === pending.kind) {
      const amount = existing.querySelector('[data-amount]');
      if (amount) amount.textContent = money(pending.amount);
      return;
    }
    layer?.remove();
    const space = spaceAt(pending.tile);
    const owner = pending.ownerId ? this.state?.players[pending.ownerId] : null;
    const box = h('div', { class: 'pending glass', id: 'pending-sheet' });
    box.append(
      this.cashChip(),
      h('div', { class: 'pending-title' }, pending.kind === 'buy' ? `Buy ${space.name}?` : `Rent due at ${space.name}`),
      h(
        'div',
        { class: 'pending-sub' },
        pending.kind === 'buy'
          ? `List price ${money(pending.amount)} · ${GROUP_LABEL[space.group ?? 'corner']}`
          : `${owner?.name ?? 'The owner'} asks ${money(pending.amount)}${this.state?.tiles[pending.tile]?.buildings.length ? ' with buildings' : ''}`,
      ),
    );
    if (pending.kind === 'buy') {
      box.append(
        this.propertyCard(pending.tile),
        h(
          'div',
          { class: 'inline' },
          h('button', { class: 'btn btn-gold', onclick: () => this.send({ t: 'buy', tile: pending.tile, key: intentKey('buy') }) }, `Buy ${money(pending.amount)}`),
          h('button', { class: 'btn btn-ghost', onclick: () => this.send({ t: 'decline', tile: pending.tile, key: intentKey('decline') }) }, 'Decline'),
        ),
      );
    } else {
      const chance = evadeChance(this.state?.tiles[pending.tile]?.buildings.length ?? 0);
      box.append(
        h(
          'div',
          { class: 'inline' },
          h('button', { class: 'btn btn-gold', onclick: () => this.send({ t: 'payRent', tile: pending.tile, key: intentKey('rent') }) }, `Pay ${money(pending.amount)}`),
          h('button', { class: 'btn btn-ghost', onclick: () => this.send({ t: 'evade', tile: pending.tile, key: intentKey('evade') }) }, 'Try to evade'),
        ),
        h('div', { class: 'note warn' }, `Evading risks a ${Math.round(RULES.evadePenalty * 100)}% penalty and reputation loss. Chance of slipping away: ${Math.round(chance * 100)}%.`),
      );
    }
    const overlay = h(
      'div',
      { class: 'modal-layer pending-layer', id: 'pending-overlay', 'data-tile': String(pending.tile), 'data-kind': pending.kind },
      h('div', { class: 'sheet-scrim' }),
      box,
    );
    document.body.append(overlay);
  }

  private refreshTransient(): void {
    if (!this.priv) return;
    const bank = document.getElementById('bank-outstanding');
    if (bank) bank.textContent = money(this.priv.you.loan);
    for (const chip of document.querySelectorAll<HTMLElement>('[data-live-cash]')) {
      this.countMoney(chip, this.priv.you.cash);
    }
  }

  /** One live cash readout, repeated at the top of every spending surface. */
  private cashChip(): HTMLElement {
    const value = h('b', { 'data-live-cash': '', class: 'sheet-cash-value' }, money(this.priv?.you.cash ?? 0));
    if (this.priv) this.countMoney(value, this.priv.you.cash);
    return h('div', { class: 'sheet-cash glass', 'aria-label': 'Your cash' }, h('span', {}, 'CASH'), value);
  }

  // ---------------------------------------------------------------- sheets

  private openSheet(name: string, title: string, subtitle: string, body: HTMLElement, opts: { tall?: boolean; wide?: boolean; replace?: boolean } = {}): void {
    if (this.currentSheet === name && !opts.replace) {
      this.closeSheet();
      return;
    }
    this.closeSheet(false);
    this.currentSheet = name;
    const closeBtn = h('button', { class: 'sheet-close', 'aria-label': 'Close', onclick: () => this.closeSheet() }, icon('close', 18));
    const sheet = h(
      'div',
      { class: `sheet${opts.tall ? ' tall' : ''}${opts.wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'grabber' }),
      h('div', { class: 'sheet-head' }, h('div', {}, h('h2', { class: 'sheet-title' }, title), subtitle ? h('p', { class: 'sheet-sub' }, subtitle) : null), h('div', { class: 'spacer' }), this.cashChip(), closeBtn),
      h('div', { class: 'sheet-body' }, body),
    );
    this.sheet = sheet;
    this.sheetLayer.append(sheet);
    this.sheetLayer.classList.add('open');
    setTimeout(() => closeBtn.focus(), 40);
  }

  closeSheet(animate = true): void {
    if (!this.sheet) return;
    if (this.currentSheet === 'log') this.logBody = null;
    this.marketLive = null;
    this.stopPreview?.();
    this.stopPreview = null;
    const sheet = this.sheet;
    this.sheet = null;
    this.currentSheet = '';
    if (animate) {
      sheet.classList.add('closing');
      setTimeout(() => sheet.remove(), 210);
    } else sheet.remove();
    this.sheetLayer.classList.remove('open');
  }

  // ------------------------------------------------------------- tile card

  openTile(index: number): void {
    this.sheetTile = index;
    const space = spaceAt(index);
    const tile = this.state?.tiles[index];
    const owner = tile?.ownerId ? this.state?.players[tile.ownerId] : null;
    const body = h('div', {});
    body.append(this.propertyCard(index));
    const actions = this.propertyActions(index);
    if (actions) body.append(actions);
    if (tile?.buildings.length) {
      body.append(h('p', { class: 'note' }, `Buildings: ${tile.buildings.map((b) => `${BUILDING_META[b.type].name} rank ${b.rank}`).join(', ')}. Board cap ${RULES.maxBuildings} (${this.state?.buildingCount ?? 0} built).`));
    }
    if (tile?.lockedBy) body.append(h('p', { class: 'note bad' }, 'These deeds are locked while a lawsuit is pending.'));
    this.openSheet('tile', space.name, owner ? `Owned by ${owner.name}${tile?.mortgaged ? ' · mortgaged' : ''}` : 'Available to buy', body, { replace: true });
  }

  /** One title-deed card, shared by the buy prompt, tile sheet and Properties tab. */
  private propertyCard(index: number): HTMLElement {
    const space = spaceAt(index);
    const tile = this.state?.tiles[index];
    const owner = tile?.ownerId ? this.state?.players[tile.ownerId] : null;
    const bandColor = space.group ? PALETTE.groups[space.group] : PALETTE.ink;
    const card = h('div', { class: 'deed-card glass-strong' });
    card.append(h('div', { class: 'deed-band', style: `background:${bandColor}` }));
    const body = h('div', { class: 'deed-body' });
    body.append(
      h('div', { class: 'deed-title' }, space.name),
      h('div', { class: 'deed-sub' }, `${GROUP_LABEL[space.group ?? 'corner']}${owner ? ` · ${owner.name}` : ' · unowned'}${tile?.mortgaged ? ' · mortgaged' : ''}`),
    );
    if (space.rents.length) {
      const table = h('table', { class: 'rent-table deed-rents' });
      const labels = space.type === 'railroad'
        ? ['1 railroad', '2 railroads', '3 railroads', '4 railroads']
        : space.type === 'property'
          ? ['Base rent', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel']
          : [];
      if (labels.length) {
        labels.forEach((label, i) => {
          if (space.rents[i] === undefined) return;
          table.append(h('tr', {}, h('td', {}, label), h('td', {}, money(space.rents[i]!))));
        });
      } else {
        table.append(h('tr', {}, h('td', {}, 'Rent'), h('td', {}, '4x dice')));
        table.append(h('tr', {}, h('td', {}, 'Both utilities'), h('td', {}, '10x dice')));
      }
      for (const building of tile?.buildings ?? []) {
        table.append(h('tr', { class: 'highlight' }, h('td', {}, `${BUILDING_META[building.type].name} rank ${building.rank}`), h('td', {}, money(buildingRent(space, building.type, this.state!.tiles)))));
      }
      body.append(table);
    }
    if (this.state?.mode === 'multi' && space.type === 'property' && tile?.ownerId) {
      const m = multiplayerRent(index, this.state.tiles, this.priv?.you.cash ?? 1000);
      const factors = m.buildings
        ? `highest rank ${m.highestRank} × ${m.buildings} building${m.buildings === 1 ? '' : 's'} (+10% each after the first) × prestige ${m.prestige.toFixed(2)}`
        : 'no buildings — printed base rent';
      body.append(
        h('p', { class: 'note rent-formula', 'data-rent-example': '' },
          `Why this rent: ${factors}, charged as a share of the payer's cash (minimum ${money(RULES.multiRentMin)}). At your ${money(this.priv?.you.cash ?? 1000)} cash this deed asks ${money(m.rent)} (${(m.percent * 100).toFixed(2)}%).`,
        ),
      );
    }
    if (space.buildCost) {
      body.append(
        h('div', { class: 'stat-row' }, h('span', {}, 'Build cost'), h('b', {}, money(space.buildCost))),
        h('div', { class: 'stat-row' }, h('span', {}, 'Mortgage value'), h('b', {}, money(mortgageValue(space)))),
        h('div', { class: 'stat-row' }, h('span', {}, 'Unmortgage cost'), h('b', {}, money(unmortgageCost(space)))),
      );
    }
    if (space.tax) body.append(h('div', { class: 'stat-row' }, h('span', {}, 'Tax'), h('b', {}, money(space.tax))));
    body.append(
      h('div', { class: 'deed-foot' },
        h('span', { class: 'deed-kind' }, tile?.buildings.length ? `${tile.buildings.length}/${buildSlots(space)} slots` : tile?.mortgaged ? 'Mortgaged' : 'Open lot'),
        h('b', { class: 'deed-price' }, money(space.price)),
      ),
    );
    card.append(body);
    return card;
  }

  private propertyActions(index: number): HTMLElement | null {
    const space = spaceAt(index);
    const tile = this.state?.tiles[index];
    const mine = tile?.ownerId === this.deps.net.playerId;
    const actions = h('div', { class: 'actions' });
    if (mine && tile) {
      if (space.type === 'property' && this.state?.mode !== 'solo') {
        actions.append(h('button', { class: 'btn btn-primary', onclick: () => this.openBuild(index) }, `Build · ${tile.buildings.length}/${buildSlots(space)} slots`));
      } else if (!tile.buildings.length) {
        actions.append(h('button', { class: 'btn btn-primary', onclick: () => this.openBuild(index) }, 'Build here'));
      }
      for (const [slot, building] of tile.buildings.entries()) {
        const nextRank = (building.rank + 1) as 2 | 3 | 4;
        const nextCost = upgradeCost(space, building.type, nextRank);
        const blocked = tile.lockedBy ? 'Deeds are locked by a pending lawsuit' : (this.priv?.you.cash ?? 0) < nextCost ? `Need ${money(nextCost)}` : '';
        const row = h('div', { class: 'inline' },
          h('span', { class: 'chip', title: `${BUILDING_META[building.type].perk} Trade-off: ${BUILDING_META[building.type].tradeoff}` }, `${BUILDING_META[building.type].name} · rank ${building.rank}`),
          building.rank < 4 ? h('button', { class: 'btn btn-sm btn-ghost', 'data-upgrade': building.type, 'data-slot': String(slot), disabled: Boolean(blocked), title: blocked, onclick: () => this.send({ t: 'upgrade', tile: index, type: building.type, slot, key: intentKey('upgrade') }) }, `Upgrade ${money(nextCost)}`) : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.send({ t: 'sellBuilding', tile: index, type: building.type, slot, key: intentKey('sell') }) }, `Sell ${money(Math.round(buildingInvested(space, building) * RULES.sellRefund))}`),
        );
        actions.append(row);
      }
      if (tile.mortgaged) {
        actions.append(h('button', { class: 'btn btn-ghost', onclick: () => this.send({ t: 'unmortgage', tile: index, key: intentKey('unmortgage') }) }, `Unmortgage ${money(unmortgageCost(space))}`));
      } else if (!tile.buildings.length) {
        actions.append(h('button', { class: 'btn btn-ghost', onclick: () => this.send({ t: 'mortgage', tile: index, key: intentKey('mortgage') }) }, `Mortgage ${money(mortgageValue(space))}`));
      }
      actions.append(h('button', { class: 'btn btn-ghost', onclick: () => this.openMarket(index) }, 'Trade stock'));
    }
    if (!tile?.ownerId && space.price) {
      const canAfford = (this.priv?.you.cash ?? 0) >= space.price;
      actions.append(
        h(
          'button',
          { class: 'btn btn-gold', disabled: !canAfford || Boolean(this.priv?.pending), onclick: () => this.send({ t: 'buy', tile: index, key: intentKey('buy') }) },
          canAfford ? `Buy for ${money(space.price)}` : `Need ${money(space.price)}`,
        ),
      );
    }
    return actions.children.length ? actions : null;
  }

  private openBuild(index: number): void {
    const space = spaceAt(index);
    const tile = this.state?.tiles[index];
    const mode = this.state?.mode ?? 'multi';
    const body = h('div', {});
    const check = this.state ? canBuild(index, this.state.tiles, this.deps.net.playerId ?? '', this.state.buildingCount, mode) : { ok: false as const, reason: '…' };
    body.append(h('p', { class: 'note' }, `${mode === 'solo' ? 'Solo needs the full colour group and uses standard houses and hotels.' : `${buildSlots(space)} build slots, ${tile?.buildings.length ?? 0} used. Duplicates are allowed; the 2nd copy earns 70% and the 3rd 50%. Each building upgrades rank 1→4 (costs 1x, 3x, 9x, 27x). Selling refunds 50%.`} Board cap ${RULES.maxBuildings} (${this.state?.buildingCount ?? 0} built).`));
    if (!check.ok) body.append(h('p', { class: 'note warn' }, check.reason));
    for (const category of BUILDING_CATEGORIES) {
      const types = buildingTypesForMode(mode).filter((type) => BUILDING_META[type].category === category.id);
      if (!types.length) continue;
      body.append(h('div', { class: 'group-label', style: 'margin-top:16px' }, `${category.icon} ${category.label}`));
      const grid = h('div', { class: 'build-grid' });
      for (const type of types) {
        const meta = BUILDING_META[type];
        const cost = buildingCost(space, type);
        const affordable = (this.priv?.you.cash ?? 0) >= cost;
        const income = this.state ? buildingRent(space, type, this.state.tiles) : 0;
        const img = h('img', { alt: meta.name, loading: 'lazy' }) as HTMLImageElement;
        void this.deps.studio.thumb(meta.model, 'building').then((src) => { img.src = src; });
        const card = h(
          'div',
          { class: 'build-card' },
          img,
          h('div', { class: 'build-name' }, meta.name),
          h('p', { class: 'build-blurb' }, meta.blurb),
          h('p', { class: 'build-perk' }, h('b', {}, 'Perk · '), meta.perk),
          h('p', { class: 'build-tradeoff' }, h('b', {}, 'Trade-off · '), meta.tradeoff),
          h('div', { class: 'build-stats' }, h('span', {}, `Cost ${money(cost)}`), h('span', {}, `Income ${money(income)}`)),
          h(
            'button',
            {
              class: 'btn btn-sm btn-primary',
              disabled: !check.ok || !affordable,
              onclick: () => {
                this.send({ t: 'build', tile: index, type, key: intentKey('build') });
                this.closeSheet();
              },
            },
            (tile?.buildings.length ?? 0) >= (mode === 'solo' ? 1 : buildSlots(space)) ? 'Slots full' : affordable ? 'Build' : 'Too dear',
          ),
        );
        grid.append(card);
      }
      body.append(grid);
    }
    this.openSheet('build', `Build on ${space.name}`, `Build cost basis ${money(space.buildCost)}`, body, { wide: true, tall: true });
  }


  // ------------------------------------------------------------ token sheet

  openTokens(fromMenu = false): void {
    const body = h('div', {});
    const preview = h('canvas', {}) as HTMLCanvasElement;
    const pane = h('div', { class: 'preview-pane' }, preview, h('div', { class: 'preview-label', id: 'preview-label' }, this.assetName(this.selectedToken)));
    const search = h('input', { class: 'field', placeholder: 'Search pieces' }) as HTMLInputElement;
    const categories = ['all', ...CATEGORY_ORDER];
    let category = 'all';
    const seg = h('div', { class: 'segmented' });
    for (const c of categories) {
      seg.append(
        h(
          'button',
          {
            'aria-pressed': String(c === 'all'),
            onclick: (e: Event) => {
              category = c;
              for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
              render();
            },
          },
          c === 'all' ? 'All' : c[0]!.toUpperCase() + c.slice(1),
        ),
      );
    }
    const grid = h('div', { class: 'card-grid' });
    const thumbObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const card = entry.target as HTMLElement;
          const id = card.dataset.asset;
          const img = card.querySelector('img');
          if (id && img && !img.getAttribute('src')) void this.deps.studio.thumb(id).then((src) => { img.src = src; });
          thumbObserver.unobserve(card);
        }
      },
      { rootMargin: '300px' },
    );
    const random = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      const pool = filtered().filter((a) => !taken(a.id));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) choose(pick);
    } }, 'Random');
    const toolbar = h('div', { class: 'toolbar' }, search, seg, random);
    body.append(pane, toolbar, grid);

    const taken = (id: string): string | null => {
      const p = Object.values(this.state?.players ?? {}).find((pl) => pl.tokenId === id && pl.id !== this.deps.net.playerId);
      return p ? p.name : null;
    };
    const filtered = (): ModelAsset[] => {
      const q = search.value.trim().toLowerCase();
      return this.deps.assets
        .filter((a) => a.kind === 'token')
        .filter((a) => category === 'all' || a.category === category)
        .filter((a) => !q || a.name.toLowerCase().includes(q));
    };
    const render = (): void => {
      grid.innerHTML = '';
      for (const asset of filtered()) {
        const owner = taken(asset.id);
        const card = h('button', {
          class: `token-card${asset.id === this.selectedToken ? ' selected' : ''}${owner ? ' taken' : ''}`,
          'aria-selected': String(asset.id === this.selectedToken),
          'aria-label': `${asset.name}${owner ? `, used by ${owner}` : ''}`,
          'data-asset': asset.id,
          onclick: () => choose(asset),
        });
        const img = h('img', { alt: asset.name, loading: 'lazy' }) as HTMLImageElement;
        card.append(img, h('span', { class: 'token-name' }, asset.name));
        if (owner) card.append(h('span', { class: 'token-owner' }, owner));
        card.append(h('span', { class: 'check' }, '✓'));
        grid.append(card);
        thumbObserver.observe(card);
      }
      if (!grid.children.length) grid.append(h('p', { class: 'note' }, 'No pieces match that search.'));
    };
    const choose = (asset: ModelAsset): void => {
      this.selectedToken = asset.id;
      localStorage.setItem('chromonopoly.token', asset.id);
      const label = document.getElementById('preview-label');
      if (label) label.textContent = asset.name;
      this.stopPreview?.();
      this.stopPreview = this.deps.studio.preview(preview, asset.id);
      if (this.deps.net.playerId) {
        this.send({ t: 'selectToken', tokenId: asset.id, key: intentKey('token') });
        this.deps.net.setIdentity(localStorage.getItem('chromonopoly.name') ?? 'Tycoon', asset.id);
      }
      const menuLabel = document.getElementById('menu-token-name');
      if (menuLabel) menuLabel.textContent = asset.name;
      render();
      this.ribbon(asset.name + ' chosen');
    };
    search.addEventListener('input', render);
    render();
    this.openSheet('tokens', 'Pick your piece', 'Every piece is a real 3D model, rendered live', body, { tall: true, wide: true });
    this.stopPreview?.();
    this.stopPreview = this.deps.studio.preview(preview, this.selectedToken);
    void fromMenu;
  }

  // ---------------------------------------------------------------- market

  openMarket(select = 0): void {
    const stocks = SPACES.filter((space) => space.price > 0);
    let tile = stocks.some((space) => space.index === select) ? select : stocks[0]!.index;
    let history: Candle[] = [];
    let lastLive = 0;
    const body = h('div', { class: 'market-terminal' });
    const selector = h('select', { class: 'field market-select', 'aria-label': 'Choose a stock' },
      ...stocks.map((space) => h('option', { value: String(space.index) }, `${space.name} · ${heap(space)}`)),
    ) as HTMLSelectElement;
    selector.value = String(tile);
    const search = h('input', { class: 'field', placeholder: 'Filter stocks', 'aria-label': 'Filter stocks' }) as HTMLInputElement;
    const chartCanvas = h('canvas', { class: 'market-chart', 'aria-label': 'Candlestick price chart' }) as HTMLCanvasElement;
    const chart = new CandleChart(chartCanvas);
    const priceEl = h('b', { class: 'terminal-price' }, '—');
    const deltaEl = h('span', { class: 'small muted' }, 'live');
    const qty = h('input', { class: 'field', type: 'number', min: '1', step: '1', value: '1', 'aria-label': 'Share quantity' }) as HTMLInputElement;
    const buy = h('button', { class: 'btn btn-primary btn-block' }, 'Buy');
    const sell = h('button', { class: 'btn btn-ghost btn-block' }, 'Sell');
    const maxBuy = h('button', { class: 'btn btn-sm btn-ghost' }, 'Max Buy');
    const maxSell = h('button', { class: 'btn btn-sm btn-ghost' }, 'Max Sell');
    const liveBadge = h('button', { class: 'btn btn-sm btn-gold' }, 'Live');
    const ownedBox = h('div', { class: 'terminal-owned' });
    const otherBox = h('div', { class: 'terminal-holdings' });
    const totals = h('div', { class: 'terminal-totals' });
    const toast = h('p', { class: 'note', 'aria-live': 'polite' }, '');
    const head = h('div', { class: 'market-head' }, h('div', { class: 'market-title' }, h('b', {}, 'Market'), h('span', { class: 'market-live-dot' }, 'LIVE')), selector, search, liveBadge);
    const chartPanel = h('div', { class: 'market-chart-panel' }, chartCanvas, h('div', { class: 'chart-legend' }, priceEl, deltaEl));
    const side = h('aside', { class: 'market-side' }, this.cashChip(), ownedBox, h('div', { class: 'trade-box' }, h('div', { class: 'stat-row' }, h('span', {}, 'Quantity'), qty), h('div', { class: 'inline' }, buy, sell), h('div', { class: 'inline' }, maxBuy, maxSell), toast), totals, otherBox);
    body.append(head, h('div', { class: 'market-body' }, chartPanel, side));
    body.setAttribute('data-market', 'terminal');

    const priceNow = (): number => this.state?.prices[tile] ?? 0;
    const heldNow = (): number => this.priv?.you.holdings[String(tile)] ?? 0;
    const draw = (): void => {
      const price = priceNow();
      const held = heldNow();
      const basis = this.priv?.you.costBasis[String(tile)] ?? 0;
      const pnl = held * price - basis;
      priceEl.textContent = money(price);
      const prev = this.state?.candles?.[tile]?.o ?? price;
      deltaEl.textContent = `${price >= prev ? '▲' : '▼'} ${Math.abs(price - prev).toFixed(2)} live`;
      deltaEl.className = price >= prev ? 'up' : 'down';
      buy.disabled = price <= 0 || (this.priv?.you.cash ?? 0) < price;
      sell.disabled = held <= 0;
      maxBuy.disabled = maxBuyShares(this.priv?.you.cash ?? 0, price) <= 0;
      maxSell.disabled = held <= 0;
      ownedBox.replaceChildren(
        h('div', { class: 'group-label' }, 'This stock'),
        h('div', { class: 'stat-row' }, h('span', {}, 'Shares'), h('b', {}, String(held))),
        h('div', { class: 'stat-row' }, h('span', {}, 'Average cost'), h('b', {}, money(held > 0 ? basis / held : 0))),
        h('div', { class: 'stat-row' }, h('span', {}, 'Value'), h('b', {}, money(held * price))),
        h('div', { class: `stat-row ${pnl >= 0 ? 'up' : 'down'}` }, h('span', {}, 'Profit / loss'), h('b', {}, `${pnl >= 0 ? '+' : ''}${money(pnl)} (${held > 0 ? ((pnl / Math.max(1, basis)) * 100).toFixed(1) : '0.0'}%)`)),
      );
      const holdings = Object.entries(this.priv?.you.holdings ?? {}).filter(([, q]) => q > 0);
      otherBox.replaceChildren(h('div', { class: 'group-label' }, 'Other holdings'));
      if (!holdings.length) otherBox.append(h('p', { class: 'note' }, 'No other shares yet.'));
      let made = Math.max(0, this.priv?.you.realizedPnl ?? 0);
      let lost = Math.max(0, -(this.priv?.you.realizedPnl ?? 0));
      for (const [key, count] of holdings) {
        if (Number(key) === tile) continue;
        const p = this.state?.prices[Number(key)] ?? 0;
        const b = this.priv?.you.costBasis[key] ?? 0;
        const value = count * p;
        const profit = value - b;
        if (profit >= 0) made += profit; else lost += -profit;
        otherBox.append(h('button', { class: 'terminal-row', onclick: () => choose(Number(key)) },
          h('span', {}, spaceAt(Number(key)).name),
          h('b', { class: profit >= 0 ? 'up' : 'down' }, `${profit >= 0 ? '+' : ''}${money(profit)}`),
          h('span', { class: 'small muted' }, `${count} sh · ${money(value)}`),
        ));
      }
      totals.replaceChildren(
        h('div', { class: 'stat-row' }, h('span', {}, 'Total made'), h('b', { class: 'up' }, `+${money(made)}`)),
        h('div', { class: 'stat-row' }, h('span', {}, 'Total lost'), h('b', { class: 'down' }, `-${money(lost)}`)),
        h('div', { class: 'stat-row' }, h('span', {}, 'Net'), h('b', { class: (made - lost) >= 0 ? 'up' : 'down' }, `${made - lost >= 0 ? '+' : ''}${money(made - lost)}`)),
      );
      chart.setData(history, this.state?.candles?.[tile] ?? null);
    };
    const choose = (next: number): void => {
      if (next === tile) return;
      tile = next;
      selector.value = String(next);
      history = [];
      this.deps.net.requestMarket(next);
      draw();
    };
    selector.addEventListener('change', () => choose(Number(selector.value)));
    search.addEventListener('input', () => {
      const text = search.value.trim().toLowerCase();
      for (const option of [...selector.options]) {
        option.hidden = !stocks.find((s) => s.index === Number(option.value))?.name.toLowerCase().includes(text);
      }
    });
    const submit = (side: 'buy' | 'sell', amount: number): void => {
      if (amount <= 0) return;
      this.send({ t: 'stock', tile, qty: side === 'buy' ? amount : -amount, key: intentKey('stock') });
      toast.textContent = `${side === 'buy' ? 'Bought' : 'Sold'} ${amount} share${amount === 1 ? '' : 's'} at the live price.`;
      draw();
    };
    buy.addEventListener('click', () => submit('buy', Math.max(1, Math.round(Number(qty.value) || 1))));
    sell.addEventListener('click', () => submit('sell', Math.max(1, Math.round(Number(qty.value) || 1))));
    maxBuy.addEventListener('click', () => {
      const max = maxBuyShares(this.priv?.you.cash ?? 0, priceNow());
      qty.value = String(Math.max(1, max));
      if (max > 0) submit('buy', max);
    });
    maxSell.addEventListener('click', () => {
      const all = heldNow();
      qty.value = String(Math.max(1, all));
      if (all > 0) submit('sell', all);
    });
    liveBadge.addEventListener('click', () => chart.reset());
    this.deps.net.onMarket = (next, candles) => {
      if (next !== tile) return;
      history = candles;
      draw();
    };
    let retries = 0;
    const requestCandles = (): void => {
      this.deps.net.requestMarket(tile);
      window.setTimeout(() => {
        if (this.currentSheet !== 'market' || history.length || retries >= 3) return;
        retries += 1;
        requestCandles();
      }, 2000);
    };
    requestCandles();
    draw();
    this.openSheet('market', 'Market', 'Server candles · 30 seconds each · one-screen trading terminal', body, { tall: true, wide: true });
    this.marketLive = () => {
      if (!this.sheet || this.currentSheet !== 'market') return;
      const now = performance.now();
      if (now - lastLive < 120) return;
      lastLive = now;
      draw();
    };
  }

  // ------------------------------------------------------------------ bank

  openBank(): void {
    const body = h('div', {});
    const loan = this.priv?.you.loan ?? 0;
    const cap = this.priv?.loanCap ?? 0;
    const interest = Math.ceil(loan * 0.02);
    const blocked = loan > 0;
    const blockedReason = blocked ? 'Repay your outstanding loan before taking another.' : '';
    const group = h('div', { class: 'group' });
    group.append(
      h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Outstanding loan'), h('div', { class: 'row-sub' }, `${money(interest)} interest due each roll`)), h('b', { id: 'bank-outstanding' }, money(loan))),
      h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Borrowing limit'), h('div', { class: 'row-sub' }, 'Three times net worth')), h('span', { class: 'row-value' }, money(cap))),
      h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Projected payoff'), h('div', { class: 'row-sub' }, loan > 0 ? `${Math.ceil(loan / 200)} rolls at $200` : 'No loan')), h('span', { class: 'row-value' }, loan > 0 ? money(loan) : '—')),
    );
    body.append(h('div', { class: 'group-label' }, 'Loan'));
    body.append(group);

    if (loan > 0 && interest > 0) {
      const income = this.ownedIncome();
      body.append(
        h(
          'p',
          { class: `note ${interest > income ? 'warn' : ''}` },
          interest > income
            ? `Interest (${money(interest)}) exceeds your rent income (${money(income)}). Mortgaging a property or selling shares may be safer.`
            : `Interest is ${money(interest)} per roll against about ${money(income)} rent income.`,
        ),
      );
    }

    const amount = h('input', { class: 'field', type: 'number', min: '200', step: '50', value: '200' }) as HTMLInputElement;
    const repay = h('input', { class: 'field', type: 'number', min: '1', step: '50', value: String(Math.min(200, loan)) }) as HTMLInputElement;
    body.append(
      h('div', { class: 'group-label' }, 'Borrow'),
      ...(blocked ? [h('p', { class: 'note warn', role: 'status' }, blockedReason)] : []),
      h('div', { class: 'inline' }, amount, h('button', { class: 'btn btn-primary', disabled: blocked, title: blockedReason, onclick: () => this.send({ t: 'loan', amount: Math.max(200, Number(amount.value) || 200), key: intentKey('loan') }) }, 'Borrow')),
      h('div', { class: 'group-label', style: 'margin-top:18px' }, 'Repay'),
      h('div', { class: 'inline' }, repay, h('button', { class: 'btn btn-ghost', disabled: loan <= 0, onclick: () => this.send({ t: 'repayLoan', amount: Math.max(1, Number(repay.value) || 1), key: intentKey('repay') }) }, 'Repay')),
    );
    this.openSheet('bank', 'Bank', 'Loans are automatic and compound every roll', body);
  }

  private ownedIncome(): number {
    if (!this.state) return 0;
    let total = 0;
    for (const space of SPACES) {
      const tile = this.state.tiles[space.index];
      if (tile?.ownerId !== this.priv?.you.id || tile.mortgaged) continue;
      total += rentFor(space.index, this.state.tiles, 7);
    }
    return total;
  }

  // ------------------------------------------------------- properties tab

  openProperties(initialTab: 'mine' | 'all' | 'trade' = 'mine', initialTarget = '', counterOf?: TradeOffer): void {
    const body = h('div', {});
    let filter = initialTab;
    let targetId = initialTarget;
    let counterFor: TradeOffer | null = counterOf ?? null;
    let giveSel = new Set<number>(counterOf?.want.properties ?? []);
    let wantSel = new Set<number>(counterOf?.give.properties ?? []);
    let giveCash = counterOf?.want.cash ?? 0;
    let wantCash = counterOf?.give.cash ?? 0;
    const me = this.deps.net.playerId ?? '';
    const seg = h('div', { class: 'segmented' });
    const content = h('div', {});
    const tabButton = (label: string, key: typeof filter): HTMLElement =>
      h('button', { 'data-tab': key, 'aria-pressed': String(filter === key), onclick: () => { filter = key; draw(); } }, label);
    seg.append(tabButton('My properties', 'mine'), tabButton('Everyone', 'all'), tabButton('Trade', 'trade'));

    const sideText = (side: TradeOffer['give']): string => {
      const parts: string[] = [];
      if (side.cash) parts.push(money(side.cash));
      for (const tile of side.properties) {
        const s = spaceAt(tile);
        const st = this.state?.tiles[tile];
        parts.push(`${s.name}${st?.mortgaged ? ' (mortgaged)' : st?.buildings.length ? ` · ${st.buildings.map((b) => `${BUILDING_META[b.type].name} r${b.rank}`).join(', ')}` : ''}`);
      }
      return parts.join(' · ') || 'nothing';
    };

    const drawList = (): void => {
      content.innerHTML = '';
      const owned = SPACES.filter((space) => this.state?.tiles[space.index]?.ownerId);
      const visible = owned.filter((space) => filter === 'all' || this.state?.tiles[space.index]?.ownerId === me);
      content.append(h('p', { class: 'note' }, filter === 'all' ? 'Every deed on the board, grouped by owner.' : 'Your deeds. Open a deed to build, mortgage, unmortgage or sell.'));
      if (!visible.length) {
        content.append(h('p', { class: 'note' }, filter === 'mine' ? 'You do not own a deed yet.' : 'No properties have been bought yet.'));
        return;
      }
      const owners = [...new Set(visible.map((space) => this.state!.tiles[space.index]!.ownerId!))];
      for (const ownerId of owners) {
        const owner = this.state?.players[ownerId];
        content.append(h('div', { class: 'group-label' }, filter === 'mine' ? 'Your portfolio' : `${owner?.name ?? 'Unknown'} · ${visible.filter((s) => this.state!.tiles[s.index]!.ownerId === ownerId).length} deeds`));
        const group = h('div', { class: 'group' });
        for (const space of visible.filter((s) => this.state!.tiles[s.index]!.ownerId === ownerId)) {
          const tile = this.state!.tiles[space.index]!;
          group.append(
            h('div', { class: 'deed-wrap', 'data-tile': String(space.index) },
              h('div', { class: 'deed-owner' }, h('span', { class: 'dot', style: `background:${this.state?.players[tile.ownerId!]?.color ?? PALETTE.ink}` }), `${this.state?.players[tile.ownerId!]?.name ?? 'Unknown'} · ${tile.mortgaged ? 'mortgaged' : tile.buildings.length ? `${tile.buildings.length} buildings` : 'open lot'}`),
              this.propertyCard(space.index),
              this.propertyActions(space.index),
            ),
          );
        }
        content.append(group);
      }
    };

    const drawTrade = (): void => {
      content.innerHTML = '';
      const trades = (this.priv?.trades ?? []).filter((t) => t.fromId === me || t.toId === me);
      const open = trades.filter((t) => t.status === 'pending');
      content.append(h('p', { class: 'note' }, 'Cash and properties only. Both sides are locked while an offer is open, and mortgaged deeds stay mortgaged after the swap.'));
      content.append(h('div', { class: 'group-label' }, 'Open offers'));
      if (!open.length) content.append(h('p', { class: 'note' }, 'No open offers.'));
      for (const trade of open) {
        const incoming = trade.toId === me;
        const other = this.state?.players[incoming ? trade.fromId : trade.toId];
        const box = h('div', { class: 'trade-offer' });
        box.append(
          h('div', { class: 'trade-offer-head' }, h('b', {}, incoming ? `${other?.name ?? 'A player'} offers you a trade` : `Your offer to ${other?.name ?? 'a player'}`), h('span', { class: 'chip' }, incoming ? 'Incoming' : 'Sent')),
          h('div', { class: 'trade-give' }, h('span', {}, incoming ? 'You receive' : 'They receive'), h('b', {}, sideText(incoming ? trade.give : trade.want))),
          h('div', { class: 'trade-give' }, h('span', {}, incoming ? 'You give' : 'You give'), h('b', {}, sideText(incoming ? trade.want : trade.give))),
        );
        const actions = h('div', { class: 'inline trade-actions' });
        if (incoming) {
          actions.append(
            h('button', { class: 'btn btn-sm btn-gold', onclick: () => this.send({ t: 'tradeAccept', tradeId: trade.id, key: intentKey('tradeAccept') }) }, 'Accept'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.send({ t: 'tradeDecline', tradeId: trade.id, key: intentKey('tradeDecline') }) }, 'Decline'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: () => {
              counterFor = trade;
              targetId = trade.fromId;
              giveSel = new Set(trade.want.properties);
              wantSel = new Set(trade.give.properties);
              giveCash = trade.want.cash;
              wantCash = trade.give.cash;
              drawTrade();
            } }, 'Counter'),
          );
        } else {
          actions.append(h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.send({ t: 'tradeDecline', tradeId: trade.id, key: intentKey('tradeDecline') }) }, 'Withdraw'));
        }
        box.append(actions);
        content.append(box);
      }
      const history = trades.filter((t) => t.status !== 'pending').slice(-4).reverse();
      if (history.length) {
        content.append(h('div', { class: 'group-label', style: 'margin-top:18px' }, 'Recent'));
        for (const trade of history) {
          const other = this.state?.players[trade.toId === me ? trade.fromId : trade.toId];
          content.append(h('div', { class: 'trade-history' }, h('b', {}, other?.name ?? 'Player'), h('span', {}, trade.status), h('span', {}, sideText(trade.give))));
        }
      }

      const others = Object.values(this.state?.players ?? {}).filter((p) => p.id !== me && !p.bankrupt);
      content.append(h('div', { class: 'group-label', style: 'margin-top:20px' }, counterFor ? 'Counter-offer' : 'New offer'));
      if (!others.length) {
        content.append(h('p', { class: 'note' }, 'There is nobody else on this board to trade with.'));
        return;
      }
      const select = h('select', { class: 'field' }, ...others.map((p) => h('option', { value: p.id }, p.name))) as HTMLSelectElement;
      if (!targetId || !others.some((p) => p.id === targetId)) targetId = others[0]!.id;
      select.value = targetId;
      select.addEventListener('change', () => {
        targetId = select.value;
        counterFor = null;
        giveSel = new Set();
        wantSel = new Set();
        giveCash = 0;
        wantCash = 0;
        drawTrade();
      });
      const target = this.state?.players[targetId];
      const mine = SPACES.filter((s) => this.state?.tiles[s.index]?.ownerId === me);
      const theirs = SPACES.filter((s) => this.state?.tiles[s.index]?.ownerId === targetId);
      const editor = (title: string, props: typeof mine, selected: Set<number>, cashValue: number, onCash: (v: number) => void): HTMLElement => {
        const cashInput = h('input', { class: 'field trade-cash-input', type: 'number', min: '0', step: '10', value: String(cashValue), 'aria-label': `${title} cash` }) as HTMLInputElement;
        cashInput.addEventListener('input', () => onCash(Math.max(0, Math.round(Number(cashInput.value) || 0))));
        const propList = h('div', { class: 'trade-props' });
        if (!props.length) propList.append(h('span', { class: 'row-sub' }, 'No properties.'));
        for (const space of props) {
          const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
          cb.checked = selected.has(space.index);
          cb.addEventListener('change', () => { if (cb.checked) selected.add(space.index); else selected.delete(space.index); });
          const st = this.state?.tiles[space.index];
          propList.append(h('label', { class: 'trade-prop' }, cb, h('span', {}, space.name), h('i', {}, st?.mortgaged ? 'mortgaged' : st?.buildings.length ? `${st.buildings.length} buildings` : '')));
        }
        return h('div', { class: 'trade-side' }, h('div', { class: 'trade-side-head' }, h('b', {}, title), h('label', { class: 'trade-cash' }, 'Cash', cashInput)), propList);
      };
      content.append(
        h('div', { class: 'trade-grid' },
          h('div', { class: 'trade-target' }, h('span', {}, 'Trade with'), select),
          editor('You give', mine, giveSel, giveCash, (v) => { giveCash = v; }),
          editor(`${target?.name ?? 'They'} give`, theirs, wantSel, wantCash, (v) => { wantCash = v; }),
        ),
      );
      const send = h('button', { class: 'btn btn-gold' }, counterFor ? 'Send counter-offer' : 'Send offer');
      send.addEventListener('click', () => {
        if (!targetId || (giveCash <= 0 && !giveSel.size) || (wantCash <= 0 && !wantSel.size)) {
          this.toast('Each side must include cash or a property.', 'bad');
          return;
        }
        if (counterFor) {
          this.send({ t: 'tradeCounter', tradeId: counterFor.id, giveCash, giveTiles: [...giveSel], wantCash, wantTiles: [...wantSel], key: intentKey('tradeCounter') });
        } else {
          this.send({ t: 'tradeOffer', targetId, giveCash, giveTiles: [...giveSel], wantCash, wantTiles: [...wantSel], key: intentKey('tradeOffer') });
        }
        this.closeSheet();
        this.toast(counterFor ? 'Counter-offer sent' : 'Trade offer sent', 'good');
      });
      content.append(h('div', { class: 'inline', style: 'margin-top:14px' }, send, h('button', { class: 'btn btn-ghost', onclick: () => { counterFor = null; giveSel = new Set(); wantSel = new Set(); giveCash = 0; wantCash = 0; drawTrade(); } }, 'Clear')));
    };

    const draw = (): void => {
      for (const button of seg.querySelectorAll('button')) button.setAttribute('aria-pressed', String((button as HTMLElement).dataset.tab === filter));
      if (filter === 'trade') drawTrade();
      else drawList();
    };
    body.append(seg, content);
    draw();
    this.openSheet('properties', 'Properties', 'Manage your deeds, inspect everyone else, or make a trade', body);
  }

  openReputation(): void {
    const body = h('div', {});
    const me = this.priv?.you;
    if (!me) return;
    body.append(
      h('div', { class: 'tile-hero' }, h('div', { class: 'rep-score' }, String(Math.round(me.reputation))), h('div', { class: 'grow' }, h('div', { class: 'row-title' }, 'Reputation'), h('div', { class: 'row-sub' }, 'Private to you. Other players only see a public jail record or a successful detective report.'))),
    );
    body.append(h('div', { class: 'group-label' }, 'Your private record'));
    const acts = h('div', { class: 'group' });
    if (!me.acts.length) acts.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-sub' }, 'No crimes or evasions recorded. Keep it that way.'))));
    for (const act of [...me.acts].reverse().slice(0, 30)) {
      acts.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, act.text), h('div', { class: 'row-sub' }, new Date(act.at).toLocaleString()))));
    }
    body.append(acts);
    body.append(h('div', { class: 'group-label' }, 'Public jail record'));
    const pub = h('div', { class: 'group' });
    if (me.jailCause) pub.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, me.jailCause), h('div', { class: 'row-sub' }, `Outcome: ${me.jailOutcome === 'all' ? 'all deeds sold' : me.jailOutcome === 'some' ? `${me.jailSold.length} deed(s) sold` : 'no deeds sold — mortgaged'}`))));
    if (this.state?.mode === 'multi') {
      body.append(h('div', { class: 'group-label' }, 'Reputation record wipe'));
      const canAfford = me.cash >= RULES.wipeCost;
      const wipe = h('div', { class: 'group' },
        h('div', { class: 'row' },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, `Erase every private and public record · ${money(RULES.wipeCost)}`),
            h('div', { class: 'row-sub' }, `${Math.round(RULES.wipeChance * 100)}% chance · resets reputation to ${RULES.wipeReputation} · dismisses your open cases · failure keeps the record and loses the fee`),
          ),
          h('button', { class: 'btn btn-sm btn-danger', id: 'wipe-record', disabled: !canAfford, onclick: () => this.openWipeWarning() }, canAfford ? 'Review wipe' : `Need ${money(RULES.wipeCost)}`),
        ),
      );
      if (!canAfford) wipe.append(h('p', { class: 'note warn' }, `You need ${money(RULES.wipeCost - me.cash)} more cash before a record wipe can be bought.`));
      body.append(wipe);
    }
    for (const entry of [...me.jailRecord].reverse().slice(0, 10)) {
      pub.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, spaceAt(entry.tile).name), h('div', { class: 'row-sub' }, new Date(entry.at).toLocaleString())), h('b', {}, money(entry.amount))));
    }
    if (!pub.children.length) pub.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-sub' }, 'Clean public record.'))));
    body.append(pub);
    const dossiers = Object.entries(me.dossier);
    if (dossiers.length) {
      body.append(h('div', { class: 'group-label' }, 'Detective reports — private'));
      const reports = h('div', { class: 'group' });
      for (const [target, report] of dossiers) {
        reports.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, this.state?.players[target]?.name ?? target), h('div', { class: 'row-sub' }, `Reputation ${report.reputation}/100 · evidence ${report.evidence} · ${report.acts.length} private act(s) revealed`))));
      }
      body.append(reports);
    }
    this.openSheet('reputation', 'Reputation', 'Private actions, public consequences', body, { tall: true });
  }

  private openWipeWarning(): void {
    const me = this.priv?.you;
    if (!me) return;
    const affordable = me.cash >= RULES.wipeCost;
    const body = h('div', {});
    body.append(
      h('div', { class: 'warning-banner' }, h('b', {}, 'This spends real cash on a coin-flip.'), h('span', {}, `${money(RULES.wipeCost)} is charged before the server rolls.`)),
      h('div', { class: 'stat-row' }, h('span', {}, 'Cost'), h('b', {}, money(RULES.wipeCost))),
      h('div', { class: 'stat-row' }, h('span', {}, 'Chance to erase the record'), h('b', {}, `${Math.round(RULES.wipeChance * 100)}%`)),
      h('div', { class: 'stat-row' }, h('span', {}, 'If it succeeds'), h('b', {}, `Private acts, jail record and unpaid-rent evidence cleared · reputation ${RULES.wipeReputation} · open cases dismissed`)),
      h('div', { class: 'stat-row' }, h('span', {}, 'If it fails'), h('b', {}, `The ${money(RULES.wipeCost)} fee is gone · every record stays`)),
      h('p', { class: 'note bad' }, 'This is explicit and irreversible. The server rolls exactly the displayed 15% after charging the fee.'),
    );
    if (!affordable) body.append(h('p', { class: 'note warn' }, `You need ${money(RULES.wipeCost)} cash to buy a wipe.`));
    body.append(
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-danger', disabled: !affordable, onclick: () => {
          this.send({ t: 'recordWipe', key: intentKey('wipe') });
          this.closeSheet();
        } }, `Pay ${money(RULES.wipeCost)} and spin`),
        h('button', { class: 'btn btn-ghost', onclick: () => this.openReputation() }, 'Cancel'),
      ),
    );
    this.openSheet('wipe', 'Confirm record wipe', 'Explicit confirmation · server rolls 15%', body);
  }

  // ----------------------------------------------------------------- crime

  openCrime(): void {
    const body = h('div', {});
    body.append(
      h(
        'p',
        { class: 'note' },
        'Every chance below is rolled by the server. A failed job means jail, a property-sale roll and a reputation hit. Successful jobs are private; only a jail publishes the record.',
      ),
    );
    body.append(
      h(
        'div',
        { class: 'group' },
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Rob the bank'), h('div', { class: 'row-sub' }, `${money(RULES.robberyMin)}–${money(RULES.robberyMax)} · 20% down to 5% · jail on failure`)),
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.openRobbery() }, 'Plan heist'),
        ),
      ),
    );
    const players = Object.values(this.state?.players ?? {}).filter((p) => p.id !== this.deps.net.playerId && !p.bankrupt);
    const group = h('div', { class: 'group' });
    for (const p of players) {
      const row = h('div', { class: 'row' });
      row.append(
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, p.name), h('div', { class: 'row-sub' }, `${money(p.cash)} cash`)),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.send({ t: 'theft', target: p.id, key: intentKey('theft') }) }, 'Rob'),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.openMurderWarning(p.id) }, 'Murder'),
      );
      group.append(row);
    }
    body.append(h('div', { class: 'group-label', style: 'margin-top:18px' }, 'Marks'), group);
    body.append(h('div', { class: 'inline', style: 'margin: -10px 0 16px' }, h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.openCourt() }, 'Open court and lawsuits')));
    if (this.priv?.you.reputation !== undefined) {
      body.append(h('p', { class: 'note' }, `Your reputation: ${this.priv.you.reputation}/100. It is secret — only a detective can reveal it. Murder is never advisable, but it is possible.`));
    }
    this.openSheet('crime', 'Underworld', 'Reputation is private until someone investigates you', body, { tall: true });
  }

  private openRobbery(): void {
    const body = h('div', {});
    const slider = h('input', { type: 'range', min: String(RULES.robberyMin), max: String(RULES.robberyMax), step: '1000', value: String(RULES.robberyMin), 'aria-label': 'Heist amount' }) as HTMLInputElement;
    const field = h('input', { class: 'field', type: 'number', min: String(RULES.robberyMin), max: String(RULES.robberyMax), step: '1000', value: String(RULES.robberyMin), 'aria-label': 'Heist amount in dollars' }) as HTMLInputElement;
    const odds = h('b', { class: 'heist-odds' }, '20.0%');
    const take = h('span', { class: 'heist-take' }, money(RULES.robberyMin));
    const sync = (raw: number, from: 'slider' | 'field'): void => {
      const clamped = Math.max(RULES.robberyMin, Math.min(RULES.robberyMax, Math.round(raw / 1000) * 1000));
      if (from === 'slider') field.value = String(clamped);
      else slider.value = String(clamped);
      odds.textContent = `${(robberyChance(clamped) * 100).toFixed(1)}%`;
      take.textContent = money(clamped);
    };
    slider.addEventListener('input', () => sync(Number(slider.value), 'slider'));
    field.addEventListener('input', () => sync(Number(field.value) || RULES.robberyMin, 'field'));
    body.append(
      h('p', { class: 'note' }, `Choose the haul. Minimum ${money(RULES.robberyMin)} at 20%, maximum ${money(RULES.robberyMax)} at 5%; the odds fall smoothly in between and the server rolls exactly what you see.`),
      h('div', { class: 'group' },
        h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Haul'), h('div', { class: 'row-sub' }, `${money(RULES.robberyMin)} – ${money(RULES.robberyMax)}`)), h('b', { class: 'heist-take' }, money(RULES.robberyMin))),
        h('div', { class: 'row heist-slider' }, slider, field),
        h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Success chance'), h('div', { class: 'row-sub' }, 'Live odds, exactly as rolled server-side')), odds),
      ),
      h('p', { class: 'note warn' }, 'Failure sends you to jail, costs reputation, and the jail roll can sell every deed and building you own.'),
    );
    body.append(
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-danger', onclick: () => this.openRobberyWarning(Math.max(RULES.robberyMin, Math.min(RULES.robberyMax, Number(field.value) || RULES.robberyMin))) }, 'Review heist'),
        h('button', { class: 'btn btn-ghost', onclick: () => this.closeSheet() }, 'Cancel'),
      ),
    );
    sync(RULES.robberyMin, 'slider');
    this.openSheet('robbery', 'Rob the bank', 'High risk, high reward', body);
  }

  private openRobberyWarning(amount: number): void {
    const issue = robberyAmountIssues(amount);
    const body = h('div', {});
    if (issue) {
      body.append(h('p', { class: 'note bad' }, issue));
    } else {
      const chance = robberyChance(amount);
      body.append(
        h('div', { class: 'warning-banner' }, h('b', {}, 'This is a serious crime.'), h('span', {}, `You are attempting to steal ${money(amount)}.`)),
        h('div', { class: 'stat-row' }, h('span', {}, 'Success chance'), h('b', {}, `${(chance * 100).toFixed(1)}%`)),
        h('div', { class: 'stat-row' }, h('span', {}, 'If it succeeds'), h('b', {}, `${money(amount)} stolen`)),
        h('div', { class: 'stat-row' }, h('span', {}, 'If it fails'), h('b', {}, 'Jail · reputation loss · property-sale roll')),
      );
    }
    body.append(
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-danger', disabled: Boolean(issue), onclick: () => {
          this.send({ t: 'robbery', amount, key: intentKey('robbery') });
          this.closeSheet();
        } }, 'Yes — attempt the robbery'),
        h('button', { class: 'btn btn-ghost', onclick: () => this.closeSheet() }, 'Cancel'),
      ),
    );
    this.openSheet('robbery-warning', 'Confirm the heist', 'The server will roll exactly these odds', body);
  }

  openDetective(): void {
    const body = h('div', {});
    const me = this.priv?.you;
    body.append(
      h('p', { class: 'note' }, `Hire a private detective for ${money(RULES.detectiveFee)}. A finding gives evidence for court; the target is never told.`),
      h('div', { class: 'stat-row' }, h('span', {}, 'Cost'), h('b', {}, money(RULES.detectiveFee))),
      h('div', { class: 'stat-row' }, h('span', {}, 'Chance of a usable finding'), h('b', {}, `${Math.round(RULES.detectiveChance * 100)}%`)),
    );
    const group = h('div', { class: 'group' });
    const players = Object.values(this.state?.players ?? {}).filter((p) => p.id !== this.deps.net.playerId && !p.bankrupt);
    if (!players.length) group.append(h('p', { class: 'note' }, 'No other players to investigate.'));
    for (const p of players) {
      const dossier = me?.dossier[p.id];
      const row = h('div', { class: 'row' });
      row.append(
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, p.name), h('div', { class: 'row-sub' }, dossier ? `Evidence ${dossier.evidence} · ${dossier.acts.length} finding(s) · reputation ${dossier.reputation}/100` : 'No findings yet')),
        h('button', { class: 'btn btn-sm btn-primary', disabled: (me?.cash ?? 0) < RULES.detectiveFee, onclick: () => { this.send({ t: 'hireDetective', target: p.id, key: intentKey('detective') }); this.closeSheet(); } }, `Hire ${money(RULES.detectiveFee)}`),
      );
      group.append(row);
    }
    body.append(h('div', { class: 'group-label', style: 'margin-top:16px' }, 'Targets'), group);
    const found = Object.entries(me?.dossier ?? {});
    body.append(h('div', { class: 'group-label', style: 'margin-top:16px' }, 'Your findings'));
    const list = h('div', { class: 'group' });
    if (!found.length) list.append(h('p', { class: 'note' }, 'No findings yet. Hire a detective above.'));
    for (const [target, report] of found) {
      list.append(
        h('div', { class: 'row' },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, this.state?.players[target]?.name ?? target),
            h('div', { class: 'row-sub' }, `Evidence ${report.evidence} · reputation ${report.reputation}/100 · ${new Date(report.at).toLocaleString()}`),
          ),
          h('span', { class: 'chip' }, `${report.acts.length} notes`),
        ),
      );
    }
    body.append(list);
    this.openSheet('detective', 'Detective', 'Private findings, usable as evidence in court', body, { tall: true });
  }

  private openMurderWarning(targetId: string): void {
    const target = this.state?.players[targetId];
    if (!target) return;
    const body = h('div', {});
    body.append(
      h('div', { class: 'warning-banner' }, h('b', {}, 'This can erase a player from the board.'), h('span', {}, `Target: ${target.name}`)),
      h('div', { class: 'stat-row' }, h('span', {}, 'Success chance'), h('b', {}, `${Math.round(RULES.murderChance * 100)}%`)),
      h('div', { class: 'stat-row' }, h('span', {}, 'If it succeeds'), h('b', {}, 'Hospital 3 turns · $0 cash · every deed and building transfers to you')),
      h('div', { class: 'stat-row' }, h('span', {}, 'If it fails and you are caught (70% of failures)'), h('b', {}, 'Jail · $1,000 fine · reputation loss')),
      h('p', { class: 'note bad' }, 'The attempt itself costs 15 reputation (−45 more on success). A caught failure costs another 25 and sends you to jail, where the jail property-sale roll applies. The odds are displayed here exactly as the server rolls them.'),
    );
    body.append(
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn-danger', onclick: () => { this.send({ t: 'murder', target: targetId, key: intentKey('murder') }); this.closeSheet(); } }, 'I understand — attempt murder'),
        h('button', { class: 'btn btn-ghost', onclick: () => this.closeSheet() }, 'Cancel'),
      ),
    );
    this.openSheet('murder', `Attempt murder: ${target.name}`, 'Explicit confirmation required', body);
  }

  // ----------------------------------------------------------------- court

  openCourt(): void {
    const body = h('div', {});
    const me = this.deps.net.playerId ?? '';
    const suits = this.priv?.suits ?? [];
    const open = suits.filter((s) => s.status === 'pending');

    if (open.length) {
      body.append(h('div', { class: 'group-label' }, 'Open cases'));
      for (const suit of open) body.append(this.suitRow(suit, me));
    }

    const players = Object.values(this.state?.players ?? {}).filter((p) => p.id !== me && !p.bankrupt);
    body.append(h('div', { class: 'group-label', style: 'margin-top:18px' }, 'File a lawsuit'));
    if (!players.length) body.append(h('p', { class: 'note' }, 'No other players to sue right now.'));
    for (const p of players) {
      const dossier = this.priv?.you.dossier[p.id];
      const strength = dossier?.evidence ?? 0;
      const max = Math.max(100, strength * 500);
      const courtPerks = perksForOwner(me, this.state?.tiles ?? {});
      const odds = Math.round(Math.min(0.95, suitChance(strength) + courtPerks.courtOdds) * 100);
      const fee = this.priv?.you.courtFee ?? RULES.courtFeeBase;
      const claim = h('input', { class: 'field', type: 'number', min: '100', max: String(max), step: '50', value: String(Math.min(500, max)) }) as HTMLInputElement;
      const row = h('div', { class: 'group', 'data-court-target': p.id });
      row.append(
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-title' }, p.name),
            h('div', { class: 'row-sub', 'data-court-evidence': '' }, dossier ? `Evidence ${strength} · win chance ${odds}% · claim up to ${money(max)} · filing fee ${money(fee)} · potential ${money(Math.min(500, max) + fee)}` : 'No evidence. Hire a detective first.'),
          ),
        ),
        h(
          'div',
          { class: 'row' },
          claim,
          h('button', { class: 'btn btn-sm btn-primary', 'data-sue': '', disabled: strength < 1 || (this.priv?.you.cash ?? 0) < fee, title: (this.priv?.you.cash ?? 0) < fee ? `Filing fee is ${money(fee)}` : `${odds}% win chance`, onclick: () => this.send({ t: 'sue', target: p.id, claim: Number(claim.value) || 100, key: intentKey('sue') }) }, strength < 1 ? 'Need evidence' : `File · ${money(fee)}`),
        ),
      );
      body.append(row);
    }
    body.append(
      h('p', { class: 'note' }, `Filing costs ${money(this.priv?.you.courtFee ?? RULES.courtFeeBase)} now and doubles after a loss, resetting to ${money(RULES.courtFeeBase)} after a win. Withdrawing refunds 50%. A win pays the claim and refunds the fee. Assets are locked while court is in session.`),
    );

    if (this.priv?.you.jailRecord.length) {
      body.append(h('div', { class: 'group-label', style: 'margin-top:18px' }, 'Your public record'));
      for (const entry of this.priv.you.jailRecord.slice(-6).reverse()) {
        body.append(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, spaceAt(entry.tile).name), h('div', { class: 'row-sub' }, `Unpaid rent ${money(entry.amount)} · ${new Date(entry.at).toLocaleTimeString()}`))));
      }
    }
    this.openSheet('court', 'Court', 'Evidence is strength. Reputation is leverage.', body, { tall: true });
  }

  /** Refresh only the mutable evidence fields, preserving a claim being typed. */
  private refreshCourt(): void {
    if (!this.sheet || this.currentSheet !== 'court' || !this.priv) return;
    for (const row of this.sheet.querySelectorAll<HTMLElement>('[data-court-target]')) {
      const targetId = row.dataset.courtTarget;
      if (!targetId) continue;
      const dossier = this.priv.you.dossier[targetId];
      const strength = dossier?.evidence ?? 0;
      const max = Math.max(100, strength * 500);
      const courtPerks = perksForOwner(this.priv.you.id, this.state?.tiles ?? {});
      const odds = Math.round(Math.min(0.95, suitChance(strength) + courtPerks.courtOdds) * 100);
      const fee = this.priv.you.courtFee;
      const evidence = row.querySelector<HTMLElement>('[data-court-evidence]');
      if (evidence) {
        evidence.textContent = dossier
          ? `Evidence ${strength} · win chance ${odds}% · claim up to ${money(max)} · filing fee ${money(fee)} · potential ${money(Math.min(500, max) + fee)}`
          : 'No evidence. Hire a detective first.';
      }
      const claim = row.querySelector<HTMLInputElement>('input[type="number"]');
      if (claim) claim.max = String(max);
      const sue = row.querySelector<HTMLButtonElement>('[data-sue]');
      if (sue) { sue.disabled = strength < 1 || this.priv.you.cash < fee; sue.textContent = strength < 1 ? 'Need evidence' : `File · ${money(fee)}`; }
    }
  }

  private suitRow(suit: Suit, me: string): HTMLElement {
    const plaintiff = this.state?.players[suit.plaintiffId];
    const defendant = this.state?.players[suit.defendantId];
    const mine = suit.defendantId === me;
    const row = h('div', { class: 'group' });
    row.append(
      h(
        'div',
        { class: 'row' },
        h(
          'div',
          { class: 'row-main' },
          h('div', { class: 'row-title' }, `${plaintiff?.name ?? 'Player'} v. ${defendant?.name ?? 'Player'}`),
          h('div', { class: 'row-sub' }, `Claim ${money(suit.claim)} · evidence ${suit.evidence} · odds ${Math.round(Math.min(0.95, suitChance(suit.evidence) + perksForOwner(suit.plaintiffId, this.state?.tiles ?? {}).courtOdds) * 100)}% · fee ${money(suit.fee)} · ${mine ? 'you can settle' : 'awaiting defendant'}`),
        ),
      ),
    );
    const actions = h('div', { class: 'row' });
    if (mine) {
      actions.append(
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.send({ t: 'settle', suitId: suit.id, key: intentKey('settle') }) }, `Settle ${money(Math.round(suit.claim * 1.5))}`),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.send({ t: 'court', suitId: suit.id, key: intentKey('court') }) }, 'Go to court'),
      );
    } else {
      actions.append(h('button', { class: 'btn btn-sm btn-primary', onclick: () => this.send({ t: 'court', suitId: suit.id, key: intentKey('court') }) }, 'Call the verdict'));
    }
    if (suit.plaintiffId === me) {
      actions.append(h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.send({ t: 'withdrawSuit', suitId: suit.id, key: intentKey('withdraw') }) }, `Withdraw · refund ${money(Math.round(suit.fee * RULES.courtRefundRate))}`));
    }
    row.append(actions);
    return row;
  }

  // -------------------------------------------------------------------- log

  openLog(): void {
    const body = h('div', {});
    const tabs = h('div', { class: 'segmented log-tabs' });
    const content = h('div', { class: 'log-list' });
    this.logBody = content;
    const tab = (label: string, key: typeof this.logTab): HTMLElement =>
      h('button', { 'aria-pressed': String(this.logTab === key), onclick: () => { this.logTab = key; this.logPlayer = null; for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.log === key)); this.renderLog(); } }, label);
    const main = tab('Main log', 'main'); main.dataset.log = 'main';
    const players = tab('Player logs', 'players'); players.dataset.log = 'players';
    const market = tab('Market feed', 'market'); market.dataset.log = 'market';
    tabs.append(main, players, market);
    body.append(tabs, content);
    this.renderLog();
    this.openSheet('log', 'Logs', 'Server-filtered for you · updates live', body, { tall: true });
  }

  private renderLog(): void {
    if (!this.logBody || this.currentSheet !== 'log') return;
    const root = this.logBody;
    root.innerHTML = '';
    if (this.logTab === 'market') {
      const feed = [...(this.state?.marketFeed ?? [])].reverse();
      root.append(h('p', { class: 'note' }, 'Live stock moves. Every player’s own trades also appear in their player log.'));
      for (const move of feed.slice(0, 80)) {
        const up = move.newPrice >= move.oldPrice;
        root.append(
          h('div', { class: 'log-item market-line' },
            h('span', { class: 'log-time' }, new Date(move.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
            h('span', { class: 'grow' }, move.name),
            h('span', { class: 'muted' }, `${money(move.oldPrice)} → ${money(move.newPrice)}`),
            h('span', { class: up ? 'up' : 'down' }, `${up ? '▲' : '▼'} ${up ? '+' : ''}${move.percent.toFixed(1)}%`),
          ),
        );
      }
      if (!feed.length) root.append(h('p', { class: 'note' }, 'No price moves recorded yet.'));
      return;
    }
    if (this.logTab === 'players') {
      const players = Object.values(this.state?.players ?? {});
      if (this.logPlayer) {
        const player = this.state?.players[this.logPlayer];
        const entries = this.logPlayer === this.deps.net.playerId ? (this.priv?.playerLog ?? []) : (this.state?.playerLogs[this.logPlayer] ?? []);
        root.append(
          h('div', { class: 'inline', style: 'justify-content:space-between;margin-bottom:10px' },
            h('b', {}, 'Player log'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { this.logPlayer = null; this.renderLog(); } }, '← All players'),
          ),
        );
        const heading = root.firstElementChild?.querySelector('b');
        if (heading) heading.textContent = `${player?.name ?? 'Player'} · ${entries.length} entries`;
        for (const entry of [...entries].reverse().slice(0, 100)) {
          root.append(
            h('div', { class: 'log-item' },
              h('span', { class: 'log-time' }, new Date(entry.at).toLocaleString()),
              h('span', { class: `log-${entry.kind}` }, entry.text),
            ),
          );
        }
        if (!entries.length) root.append(h('p', { class: 'note' }, 'Nothing visible on this player’s record yet.'));
        return;
      }
      root.append(h('p', { class: 'note' }, 'Select a player to read their server-filtered log. Private reputation and detective findings never appear here.'));
      for (const player of players) {
        const img = h('img', { alt: player.name }) as HTMLImageElement;
        void this.deps.studio.thumb(player.tokenId, 'token').then((src) => { img.src = src; });
        const owned = Object.values(this.state?.tiles ?? {}).filter((t) => t.ownerId === player.id).length;
        root.append(
          h('button', { class: 'player-log-row', onclick: () => { this.logPlayer = player.id; this.renderLog(); } },
            img,
            h('span', { class: 'dot', style: `background:${player.color}` }),
            h('span', { class: 'grow' }, h('b', {}, player.name), h('span', { class: 'row-sub' }, `${owned} deeds · ${player.inJail ? 'jailed' : 'active'}`)),
            h('span', { class: 'muted' }, 'Open →'),
          ),
        );
      }
      return;
    }
    const entries = [...(this.state?.log ?? [])].reverse();
    for (const entry of entries.slice(0, 60)) {
      root.append(
        h(
          'div',
          { class: 'log-item' },
          h('span', { class: 'log-time' }, new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          h('span', { class: `log-${entry.kind}` }, entry.text),
        ),
      );
    }
    if (!entries.length) root.append(h('p', { class: 'note' }, 'Nothing has happened yet. Roll the dice.'));
  }

  openJailRecord(playerId: string): void {
    const player = this.state?.players[playerId];
    if (!player) return;
    const body = h('div', {});
    body.append(h('p', { class: 'note' }, `${player.name} is ${player.inJail ? `jailed for ${player.jailTurns} more turns` : 'free'}. Every evaded rent is public while the term lasts.`));
    if (!player.jailRecord.length) body.append(h('p', { class: 'note' }, 'No unpaid rent on record.'));
    for (const entry of [...player.jailRecord].reverse()) {
      body.append(
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, spaceAt(entry.tile).name), h('div', { class: 'row-sub' }, new Date(entry.at).toLocaleString())),
          h('b', {}, money(entry.amount)),
        ),
      );
    }
    if (playerId === this.priv?.you.id && player.inJail) {
      const canPay = this.priv.you.cash >= player.jailReleaseCost;
      body.append(h('button', { class: 'btn btn-gold btn-block', style: 'margin-top:14px', disabled: !canPay, title: canPay ? '10% of current cash, minimum $50' : `Need ${money(player.jailReleaseCost - this.priv.you.cash)} more cash`, onclick: () => this.send({ t: 'jailPay', key: intentKey('jail') }) }, canPay ? `Pay ${money(player.jailReleaseCost)} to get out` : `Release costs ${money(player.jailReleaseCost)} — not enough cash`));
    }
    this.openSheet('jail', `${player.name}'s record`, 'Public jail ledger', body);
  }

  // --------------------------------------------------------------- settings

  openSettings(): void {
    const body = h('div', {});
    const s = this.settings;
    const update = (patch: Partial<Settings>): void => {
      this.settings = { ...this.settings, ...patch };
      this.applySettings();
    };

    body.append(h('div', { class: 'group-label' }, 'Audio'));
    const audioGroup = h('div', { class: 'group' });
    audioGroup.append(
      this.sliderRow('Master volume', s.master, (v) => update({ master: v }), () => audio.play('click')),
      this.sliderRow('Music volume', s.music, (v) => update({ music: v }), () => audio.play('click')),
      this.sliderRow('Sound effects volume', s.sfx, (v) => update({ sfx: v }), () => audio.play('cash')),
      this.toggleRow('Sound effects', s.sfxOn, (v) => { update({ sfxOn: v }); audio.setSfxOn(v); }),
      this.toggleRow('Music', s.musicOn, (v) => { update({ musicOn: v }); audio.setMusicOn(v); }),
    );
    body.append(audioGroup);

    body.append(h('div', { class: 'group-label' }, 'Camera'));
    const cam = h('div', { class: 'group' });
    cam.append(
      this.sliderRow('Camera speed', s.cameraSpeed, (v) => update({ cameraSpeed: v }), undefined, 0.4, 2, 0.1),
      this.toggleRow('Invert orbit', s.invertOrbit, (v) => update({ invertOrbit: v })),
      this.toggleRow('Camera shake', s.shake, (v) => update({ shake: v })),
    );
    body.append(cam);

    body.append(h('div', { class: 'group-label' }, 'Graphics'));
    const gfx = h('div', { class: 'group' });
    const qualitySeg = h('div', { class: 'segmented' });
    for (const key of Object.keys(QUALITY) as QualityKey[]) {
      qualitySeg.append(
        h(
          'button',
          {
            'aria-pressed': String(s.quality === key),
            onclick: (e: Event) => {
              update({ quality: key });
              for (const b of qualitySeg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
            },
          },
          key[0]!.toUpperCase() + key.slice(1),
        ),
      );
    }
    gfx.append(
      h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Quality'), h('div', { class: 'row-sub' }, 'Shadows, bloom and pixel ratio')), qualitySeg),
      this.toggleRow('Reduced motion', s.reducedMotion, (v) => update({ reducedMotion: v })),
      this.toggleRow('Colourblind palette', s.colorblind, (v) => update({ colorblind: v })),
      this.uiScaleRow(),
      this.toggleRow('Show tile prices', s.showPrices, (v) => update({ showPrices: v })),
      this.toggleRow('FPS counter', s.fpsCounter, (v) => update({ fpsCounter: v })),
      this.toggleRow('Fast bot turns', s.fastBots, (v) => update({ fastBots: v })),
    );
    body.append(gfx);

    body.append(h('div', { class: 'group-label' }, 'Sky and time of day'));
    const phase = s.skyHour < 5 ? 'Night' : s.skyHour < 8 ? 'Sunrise' : s.skyHour < 17 ? 'Day' : s.skyHour < 20 ? 'Sunset' : 'Night';
    const sky = h('div', { class: 'group' });
    sky.append(
      this.toggleRow('Day cycle', s.skyRunning, (v) => update({ skyRunning: v })),
      this.sliderRow('Time of day', s.skyHour, (v) => update({ skyHour: v }), undefined, 0, 24, 0.25, (v) => `${String(Math.floor(v)).padStart(2, '0')}:${v % 1 ? '30' : '00'} · ${v < 5 ? 'Night' : v < 8 ? 'Sunrise' : v < 17 ? 'Day' : v < 20 ? 'Sunset' : 'Night'}`),
      h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Current sky'), h('div', { class: 'row-sub' }, 'The board keeps its own fixed light rig; only the island and sky change.')), h('span', { class: 'chip' }, phase)),
    );
    const presets = h('div', { class: 'inline', style: 'padding: 10px 14px;gap:8px;flex-wrap:wrap' });
    for (const [label, hour] of [['Sunrise', 6.5], ['Noon', 12], ['Sunset', 18.5], ['Night', 23]] as const) {
      presets.append(h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { update({ skyHour: hour }); } }, label));
    }
    sky.append(presets);
    body.append(sky);

    body.append(h('div', { class: 'group-label' }, 'Appearance'));
    body.append(
      h(
        'div',
        { class: 'group' },
        this.toggleRow('Dark mode', s.darkMode, (v) => update({ darkMode: v })),
        this.toggleRow('Follow camera', s.followCamera, (v) => update({ followCamera: v })),
      ),
    );

    body.append(h('div', { class: 'group-label' }, 'Session'));
    const solo = this.state?.mode === 'solo';
    const session = h('div', { class: 'group' });
    session.append(
      h(
        'div',
        { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Return to main menu'), h('div', { class: 'row-sub' }, 'Leave this table and pick a mode again.')),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.returnToMenu() }, 'Main menu'),
      ),
      h(
        'div',
        { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'Restart'), h('div', { class: 'row-sub' }, solo ? 'Start a fresh solo table with $1,500 each.' : 'Restart applies to solo tables only. Return to the menu and rejoin the shared board instead.')),
        h('button', { class: `btn btn-sm ${solo ? 'btn-danger' : 'btn-ghost'}`, disabled: !solo, title: solo ? 'Start a fresh solo table' : 'Restart applies to solo tables only', onclick: () => this.restartSession() }, 'Restart'),
      ),
    );
    body.append(session);

    body.append(
      h(
        'button',
        {
          class: 'btn btn-danger btn-block',
          onclick: () => {
            if (!window.confirm('Reset every setting to its default?')) return;
            this.settings = { ...DEFAULT_SETTINGS };
            this.applySettings();
            this.closeSheet();
            this.toast('Settings reset', 'good');
          },
        },
        'Reset to defaults',
      ),
      h('p', { class: 'note center', style: 'margin-top:12px' }, 'Settings are saved on this device and applied immediately.'),
    );
    this.openSheet('settings', 'Settings', 'Applied live · saved automatically', body, { tall: true });
  }

  private openConfirm(title: string, body: HTMLElement, label: string, action: () => void): void {
    this.closeSheet(false);
    const wrap = h('div', {});
    wrap.append(body, h('div', { class: 'actions' }, h('button', { class: 'btn btn-danger', onclick: () => { action(); this.closeSheet(); } }, label), h('button', { class: 'btn btn-ghost', onclick: () => this.closeSheet() }, 'Cancel')));
    this.openSheet('confirm', title, 'This needs your confirmation', wrap);
  }

  private returnToMenu(): void {
    this.openConfirm(
      'Return to main menu?',
      h('p', { class: 'note' }, 'Your current table will stay on the server. In multiplayer your seat remains on the shared board; reconnecting with this browser restores it.'),
      'Return to menu',
      () => {
        this.deps.net.close();
        window.location.reload();
      },
    );
  }

  private restartSession(): void {
    if (this.state?.mode !== 'solo') return;
    this.openConfirm(
      'Restart this table?',
      h('p', { class: 'note' }, 'Every player, deed, building and balance is reset. The new table starts with $1,500 each and fresh bots.'),
      'Restart table',
      () => {
        sessionStorage.setItem('chromonopoly.restart', '1');
        this.deps.net.close();
        window.location.reload();
      },
    );
  }

  /** UI scale is staged: it changes only on Apply, and Cancel restores it. */
  private uiScaleRow(): HTMLElement {
    const row = h('div', { class: 'row' },
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'UI scale'), h('div', { class: 'row-sub' }, 'Preview the value, then Apply. Cancel keeps the current scale.')),
    );
    const value = h('b', { class: 'mono' }, `${Math.round(this.settings.uiScale * 100)}%`);
    const slider = h('input', { type: 'range', min: '80', max: '130', step: '5', value: String(Math.round(this.settings.uiScale * 100)) }) as HTMLInputElement;
    const apply = h('button', { class: 'btn btn-sm btn-gold', disabled: true }, 'Apply');
    const cancel = h('button', { class: 'btn btn-sm btn-ghost', disabled: true }, 'Cancel');
    const sync = (): void => {
      value.textContent = `${slider.value}%`;
      const pending = Number(slider.value) / 100 !== this.settings.uiScale;
      apply.disabled = !pending;
      cancel.disabled = !pending;
    };
    slider.addEventListener('input', sync);
    apply.addEventListener('click', () => {
      this.settings = { ...this.settings, uiScale: Number(slider.value) / 100 };
      this.applySettings();
      sync();
    });
    cancel.addEventListener('click', () => {
      slider.value = String(Math.round(this.settings.uiScale * 100));
      sync();
    });
    row.append(h('div', { class: 'inline ui-scale-controls' }, value, slider, apply, cancel));
    return row;
  }

  private sliderRow(
    label: string,
    value: number,
    onInput: (v: number) => void,
    onRelease?: () => void,
    min = 0,
    max = 1,
    step = 0.01,
    format?: (v: number) => string,
  ): HTMLElement {
    const readout = h('span', { class: 'row-value' }, format ? format(value) : `${Math.round(value * 100)}%`);
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label }) as HTMLInputElement;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      readout.textContent = format ? format(v) : `${Math.round(v * 100)}%`;
      onInput(v);
    });
    input.addEventListener('change', () => {
      onRelease?.();
    });
    return h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, label)), h('div', { style: 'display:flex;align-items:center;gap:10px;width:56%' }, input, readout));
  }

  private toggleRow(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const btn = h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(value), 'aria-label': label }) as HTMLButtonElement;
    btn.append(h('i', {}));
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      onChange(next);
    });
    return h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, label)), btn);
  }

  openHelp(): void {
    const body = h('div', {});
    body.append(
      h('p', { class: 'note' }, 'Single-player rules, in order. You play against three AI rivals, everyone starts with $1,500, and only the active player acts.'),
      h('div', { class: 'group' }, ...helpRows()),
      h('button', { class: 'btn btn-gold btn-block', style: 'margin: 4px 0 10px', onclick: () => this.startTutorial() }, 'Play Tutorial'),
      h('p', { class: 'note center' }, 'The tutorial starts a guided solo table with bots. You can leave it at any time.'),
      h('p', { class: 'note' }, 'Click any tile to inspect it. Drag empty space to orbit, scroll to zoom, Q/E to snap, Esc to reset.'),
    );
    this.openSheet('help', 'How to play', 'Single player · the short version', body);
  }

  private startTutorial(): void {
    this.closeSheet(false);
    sessionStorage.setItem('chromonopoly.tutorial', '1');
    this.deps.net.close();
    window.location.reload();
  }

  private showTutorialStep(): void {
    const steps: Array<{ title: string; text: string; target?: string; action?: string }> = [
      { title: 'Welcome to Chromonopoly', text: 'This is a normal solo table. You and three bots each start with $1,500. Take your time — the tutorial will not time you out.', target: '#roll-btn' },
      { title: '1 · Roll the dice', text: 'Press the highlighted Roll button, Space, or click it. The camera frames the dice, then your piece moves around the board.', target: '#roll-btn', action: 'roll' },
      { title: '2 · Land and decide', text: 'When you land on an unowned street, a centred Offer panel appears. Buy it or pass. In solo, a full colour group unlocks building; multiplayer allows building on any owned street.', target: '#dock' },
      { title: '3 · Manage property', text: 'Open Properties to see your deeds. Every property has three build slots; duplicate types are allowed and later copies return 70% then 50%. Open a deed to build, upgrade, mortgage, unmortgage or sell. Mortgaged deeds show a 3D MORTGAGED sign above the tile.', target: '[data-dock="Properties"]' },
      { title: '4 · Rent, jail and cards', text: 'Landing on another player rent opens a payment offer. Evading is a chance roll. Release costs 10% of cash with a $50 minimum; the jail sale mortgages your deeds until you recover. Chance and Chest cards flip at the centre.', target: '.rail' },
      { title: '5 · Trade', text: 'In Properties → Trade, offer cash and properties. Both sides lock while the offer is open. The other side can accept, decline or counter; an accepted swap is atomic.', target: '[data-dock="Properties"]' },
      { title: '6 · Build the skyline', text: 'Buildings create rent, and matching types reward a full colour group. Watch cash, holdings and net worth as the skyline grows.', target: '#dock' },
      { title: 'You are ready', text: 'The table is yours. Roll, buy, build and outlast the bots. A full game ends when one player owns the board.', target: undefined },
    ];
    const step = steps[this.tutorialStep];
    if (!step) { this.finishTutorial(); return; }
    document.querySelectorAll('.tutorial-highlight').forEach((el) => el.classList.remove('tutorial-highlight'));
    let layer = document.getElementById('tutorial-layer');
    if (!layer) {
      layer = h('div', { class: 'tutorial-layer', id: 'tutorial-layer' });
      document.body.append(layer);
    }
    const target = step.target ? document.querySelector(step.target) : null;
    if (target instanceof HTMLElement) target.classList.add('tutorial-highlight');
    const card = h('div', { class: 'tutorial-card glass-strong', id: 'tutorial-card', role: 'dialog', 'aria-live': 'polite' },
      h('div', { class: 'chance-kicker' }, `Tutorial · ${this.tutorialStep + 1} / ${steps.length}`),
      h('h3', {}, step.title),
      h('p', {}, step.text),
      h('div', { class: 'inline' },
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.finishTutorial() }, 'Skip tutorial'),
        this.tutorialStep === steps.length - 1
          ? h('button', { class: 'btn btn-sm btn-gold', onclick: () => this.finishTutorial(true) }, 'Start a real game')
          : h('button', { class: 'btn btn-sm btn-gold', onclick: () => { this.tutorialStep += 1; this.showTutorialStep(); } }, 'Continue'),
      ),
    );
    layer.innerHTML = '';
    layer.append(card);
  }

  private finishTutorial(realGame = false): void {
    document.getElementById('tutorial-layer')?.remove();
    document.querySelectorAll('.tutorial-highlight').forEach((el) => el.classList.remove('tutorial-highlight'));
    sessionStorage.removeItem('chromonopoly.tutorial');
    this.tutorialPending = false;
    if (realGame) {
      sessionStorage.setItem('chromonopoly.restart', '1');
      this.deps.net.close();
      window.location.reload();
    }
  }

  // -------------------------------------------------------------- feedback

  ribbon(text: string, sub = ''): void {
    const el = document.getElementById('ribbon');
    if (el) {
      el.textContent = text;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    const subEl = document.getElementById('ribbon-sub');
    if (subEl) {
      subEl.textContent = sub;
      subEl.classList.toggle('hidden', !sub);
    }
  }

  private lastToast = { text: '', at: 0 };

  toast(text: string, kind: 'good' | 'bad' | '' = ''): void {
    const now = performance.now();
    if (text === this.lastToast.text && now - this.lastToast.at < 1200) return;
    this.lastToast = { text, at: now };
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toasts.append(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 200ms ease';
      setTimeout(() => t.remove(), 220);
    }, 2800);
  }

  event(ev: GameEvent): void {
    const me = this.deps.net.playerId;
    const actor = ev.playerId ? this.state?.players[ev.playerId] : null;
    const local = Boolean(ev.playerId && ev.playerId === me) || Boolean(ev.targetId && ev.targetId === me) || ev.kind === 'win';
    // Solo tables show bot cards and purchases on the human's screen too.
    const bot = Boolean(actor?.isBot) && this.state?.mode === 'solo' && !local;
    if (ev.chance && local) {
      const caught = ev.kind !== 'jail' && ev.outcome && !ev.outcome.success;
      // Jail can also carry a wheel. The generic queue owns every wheel so the
      // jail case below must never enqueue a second one.
      const busted = ev.kind === 'jail' || caught;
      this.queueChance(
        ev.chance,
        ev.playerId === me ? ev.outcome : undefined,
        busted ? () => this.showBusted(actor?.name.toUpperCase() ?? 'YOU', true) : undefined,
      );
    } else if (ev.outcome && ev.playerId === me) {
      void this.showOutcome(ev.outcome);
    }
    switch (ev.kind) {
      case 'roll':
        if (local) {
          const dice = ev.dice ?? [1, 1];
          this.showDice(dice);
          window.dispatchEvent(new CustomEvent('chromonopoly:dice', { detail: dice }));
          if (actor) this.ribbon(`You rolled ${dice[0]} + ${dice[1]}`);
        } else if (bot) {
          const dice = ev.dice ?? [1, 1];
          this.ribbon(`${actor!.name} rolled ${dice[0] + dice[1]}`, `${dice[0]} + ${dice[1]}`);
        }
        break;
      case 'move':
        if (local) audio.play('hop');
        break;
      case 'cash':
        if (local && ev.amount) {
          if (ev.amount > 0) audio.play('cash');
          else if (ev.amount < -1) audio.play('spend');
          this.cashFloat(ev.amount);
        }
        break;
      case 'purchase':
        if (local) {
          audio.play('purchase');
          this.ribbon(ev.text === 'offer' ? 'Property for sale' : 'Sold!', ev.text === 'offer' ? 'The table is waiting on you' : '');
        } else if (bot) {
          this.ribbon(
            ev.text === 'offer' ? `${actor!.name} has first refusal` : `${actor!.name} bought a property`,
            ev.tile !== undefined ? spaceAt(ev.tile).name : '',
          );
        }
        break;
      case 'rent':
        if (local) {
          if (ev.text === 'evaded') this.ribbon('Rent evaded', 'Reputation takes the hit');
          else if (ev.text === 'caught') this.ribbon('Caught evading');
          else this.ribbon(`Rent due: ${money(ev.amount ?? 0)}`);
        } else if (bot) {
          this.ribbon(
            ev.text === 'evaded' ? `${actor!.name} slipped away` : ev.text === 'caught' ? `${actor!.name} was caught evading` : `${actor!.name} paid rent`,
            ev.text === 'evaded' || ev.text === 'caught' ? 'Reputation takes the hit' : money(ev.amount ?? 0),
          );
        }
        break;
      case 'build':
        if (local) {
          audio.play('build');
          this.ribbon('Skyline grows');
        } else if (bot) {
          this.ribbon(`${actor!.name} is building`, ev.tile !== undefined ? spaceAt(ev.tile).name : '');
        }
        break;
      case 'card':
        if (local || bot) {
          audio.play('card');
          if (local) this.closeSheet(false);
          this.ribbon(ev.deck === 'chest' ? 'Community Chest' : 'Chance', `${bot ? `${actor!.name} · ` : ''}${ev.text ?? ''}`);
          this.showCard(ev.text ?? 'A card is drawn.', ev.deck === 'chest' ? 'Community Chest' : 'Chance');
          window.dispatchEvent(new CustomEvent('chromonopoly:card', { detail: { deck: ev.deck ?? 'chance', text: ev.text ?? '' } }));
        }
        break;
      case 'jail': {
        const text = ev.text ?? '';
        const released = text === 'released' || text.includes('left') || text.startsWith('Rolling for doubles');
        if (local && !released) {
          audio.play('jail');
          if (!ev.chance) void this.showBusted('YOU', false);
        } else if (bot && !released) {
          if (!ev.chance) void this.showBusted(actor!.name.toUpperCase(), false);
        } else if (local) {
          this.ribbon('Released', 'Back on the board');
        } else if (!local && !bot && !released) {
          this.ribbon(`${actor?.name ?? 'A player'} was arrested`, 'Jail record updated');
        }
        break;
      }
      case 'theft':
        if (local) {
          audio.play(ev.text?.includes('fail') ? 'fail' : 'cash');
          this.ribbon(ev.text === 'attempted' ? 'Robbery foiled' : 'Robbery', ev.text ?? '');
        }
        break;
      case 'murder':
        if (local) {
          audio.play(ev.text === 'success' ? 'jail' : 'fail');
          this.ribbon(ev.text === 'success' ? 'Attempt succeeded' : 'Attempt failed', ev.text ?? '');
        }
        break;
      case 'hospital':
        if (local) {
          audio.play('jail');
          this.ribbon('Hospital', ev.text ?? 'Recovering');
        }
        break;
      case 'detective':
        if (local) {
          audio.play('detective');
          this.ribbon('Detective report', ev.text === 'success' ? 'Dossier updated — private' : 'Nothing found');
        }
        break;
      case 'verdict':
        if (local) {
          audio.play('verdict');
          this.ribbon('Verdict in');
        }
        break;
      case 'loan':
        if (local) audio.play('cash');
        break;
      case 'stock':
        break;
      case 'trade':
        if (local) {
          this.ribbon(ev.text === 'offer' ? 'Trade offer' : ev.text === 'accepted' ? 'Trade accepted' : 'Trade update');
        }
        break;
      case 'turn':
        if (local) this.ribbon('Your turn', 'Roll when you are ready');
        else if (bot) this.ribbon(`${actor!.name}'s turn`, 'Passing the dice');
        break;
      case 'win':
        audio.play('victory');
        this.ribbon('Game over', '');
        break;
    }
  }

  private ensureDice(): HTMLElement {
    const existing = document.getElementById('table-dice');
    if (existing) return existing;
    const layer = h('div', { class: 'table-dice', id: 'table-dice' });
    const pad = h('div', { class: 'table-dice-pad' });
    for (let i = 0; i < 2; i += 1) {
      const die = h('div', { class: 'die', 'data-die': String(i) });
      for (let p = 0; p < 9; p += 1) die.append(h('i', {}));
      pad.append(die);
    }
    layer.append(pad);
    this.tableStage?.append(layer);
    return layer;
  }

  private setDice(dice: [number, number]): void {
    const faces = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    const layer = this.ensureDice();
    layer.querySelectorAll('.die').forEach((die, i) => {
      const on = faces[(dice[i] ?? 1) - 1] ?? [];
      [...die.children].forEach((pip, p) => pip.classList.toggle('on', on.includes(p)));
      (die as HTMLElement).dataset.value = String(dice[i] ?? 1);
    });
  }

  private startDice(): void {
    const layer = this.ensureDice();
    layer.classList.add('show', 'rolling');
    const fake: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    this.setDice(fake);
    window.setTimeout(() => layer.classList.remove('rolling'), 620);
    // Safety net: dice may never cover the table for more than a few seconds.
    window.setTimeout(() => layer.classList.remove('show', 'rolling'), 6000);
  }

  private showDice(dice: [number, number]): void {
    const layer = this.ensureDice();
    this.setDice(dice);
    layer.classList.add('show');
    layer.classList.remove('rolling');
    window.setTimeout(() => layer.classList.remove('show'), 1350);
  }

  /** Called by the turn sequencer only after the piece has landed and the camera is back. */
  noteLanding(): void {
    if (document.getElementById('tutorial-card') && this.tutorialStep === 1) {
      this.tutorialStep = 2;
      this.showTutorialStep();
    }
  }

  private showBusted(name: string, afterWheel: boolean): Promise<void> {
    if (document.getElementById('busted-screen')) return Promise.resolve();
    if (performance.now() - this.lastBustedAt < 5000) return Promise.resolve();
    this.lastBustedAt = performance.now();
    const reduced = this.settings.reducedMotion;
    const layer = h('div', { class: `busted-screen${reduced ? ' reduced' : ''}`, id: 'busted-screen', role: 'alertdialog', 'aria-label': `${name} busted` });
    layer.append(
      h('div', { class: 'busted-bars' }, ...Array.from({ length: 7 }, () => h('i', {}))),
      h('div', { class: 'busted-lights' }, h('i', { class: 'blue' }), h('i', { class: 'red' })),
      h('div', { class: 'busted-copy' }, h('span', {}, name), h('strong', {}, 'BUSTED'), h('small', {}, 'The table has been notified')),
    );
    document.body.append(layer);
    return new Promise((resolve) => {
      let done = false;
      const close = (): void => {
        if (done) return;
        done = true;
        layer.classList.add('out');
        window.setTimeout(() => { layer.remove(); resolve(); }, 260);
      };
      let armed = false;
      window.setTimeout(() => { armed = true; }, 1000);
      layer.addEventListener('click', () => { if (armed) close(); });
      const key = (event: KeyboardEvent): void => { if (armed && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) { window.removeEventListener('keydown', key); close(); } };
      window.addEventListener('keydown', key);
      window.setTimeout(() => { window.removeEventListener('keydown', key); close(); }, afterWheel ? 3000 : 2600);
    });
  }

  private showCard(text: string, deck: string): void {
    if (this.promptsBlocked) return;
    document.getElementById('card-draw')?.remove();
    const card = h(
      'div',
      { class: 'card3d' },
      h('div', { class: 'card-face card-back' }, h('span', {}, 'C'), h('b', {}, deck.toUpperCase())),
      h('div', { class: 'card-face card-front' }, h('span', { class: 'card-deck' }, deck), h('p', {}, text)),
    );
    const layer = h('div', { class: 'card-draw', id: 'card-draw', role: 'dialog', 'aria-label': deck }, h('div', { class: 'card-stage' }, card));
    document.body.append(layer);
    requestAnimationFrame(() => layer.classList.add('flipped'));
    const close = (): void => {
      layer.classList.add('closing');
      window.setTimeout(() => layer.remove(), 220);
    };
    layer.addEventListener('click', close);
    window.setTimeout(close, 3200);
  }

  private queueChance(spec: ChanceRoll, outcome?: CrimeOutcome, after?: () => Promise<void> | void): void {
    // The outcome card is a consequence of the stopped wheel. Showing it at
    // event-arrival time covered the wheel and let a result appear before LANDED.
    this.chanceQueue = this.chanceQueue
      .then(async () => {
        await this.showChance(spec);
        if (outcome) await this.showOutcome(outcome);
        await after?.();
      })
      .catch(() => undefined);
  }

  private showChance(spec: ChanceRoll): Promise<void> {
    if (this.promptsBlocked) return Promise.resolve();
    this.closeSheet(false);
    document.getElementById('card-draw')?.remove();
    document.getElementById('pending-overlay')?.remove();
    document.body.classList.add('chance-active');
    const zones = wheelZones(spec.percent, spec.zones);
    const colors = zones.map(wheelColor);
    const segments = segmentsForDisplay(zones);
    // `segmentsForDisplay` creates new objects, so indexOf() always returned -1
    // and every conic-gradient stop was invalid. Use the matching index.
    const stops = segments.map((z, i) => `${colors[i]} ${z.start}% ${z.end}%`);
    const dial = h('div', { class: 'chance-dial' });
    dial.style.background = `conic-gradient(from 0deg, ${stops.join(', ')})`;
    const pointer = h('i', { class: 'chance-pointer', 'aria-hidden': 'true' });
    const legend = h(
      'div',
      { class: 'chance-legend' },
      ...zones.map((z, i) => h('span', {}, h('i', { style: `background:${colors[i]}` }), `${z.label} ${Math.round(z.percent)}%`)),
    );
    const result = h('div', { class: 'chance-result', 'aria-live': 'polite' }, 'Spin to reveal');
    const spin = h('button', { class: 'btn btn-gold chance-spin' }, 'Spin');
    const proceed = h('button', { class: 'btn btn-primary chance-continue hidden' }, 'Continue');
    const overlay = h(
      'div',
      { class: 'chance-overlay', id: 'chance-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': spec.label, 'data-chance': String(spec.percent) },
      h(
        'div',
        { class: 'chance-card glass-strong' },
        h('div', { class: 'chance-kicker' }, 'Server odds'),
        h('div', { class: 'chance-label' }, spec.label),
        h(
          'div',
          { class: 'chance-wrap' },
          dial,
          h(
            'div',
            { class: 'chance-face' },
            h('b', {}, `${Math.round(spec.percent)}%`),
            h('span', {}, 'success chance'),
          ),
          pointer,
        ),
        legend,
        result,
        spin,
        proceed,
      ),
    );
    document.body.append(overlay);
    const machine = new WheelStateMachine();
    window.__chanceWheel = machine;
    const setState = (state: 'READY' | 'SPINNING' | 'LANDED' | 'RESULT_SHOWN' | 'CLOSED'): void => {
      machine.transition(state);
      overlay.dataset.state = state;
      overlay.dataset.stateAt = String(Math.round(machine.snapshot().at));
      window.__chanceTransitions = machine.transitions.map((entry) => ({ ...entry }));
      if (new URLSearchParams(location.search).has('e2e')) console.debug('[wheel]', state, Math.round(machine.snapshot().at));
    };
    overlay.dataset.state = 'IDLE';
    window.__chanceTransitions = machine.transitions.map((entry) => ({ ...entry }));
    setState('READY');
    return new Promise((resolve) => {
      let done = false;
      let spun = false;
      const close = (): void => {
        if (done) return;
        done = true;
        setState('CLOSED');
        document.body.classList.remove('chance-active');
        overlay.classList.add('closing');
        window.setTimeout(() => {
          overlay.remove();
          resolve();
        }, 170);
      };
      spin.addEventListener('click', () => {
        if (spun) return;
        spun = true;
        spin.disabled = true;
        setState('SPINNING');
        const plan = spinPlan(0, spec.rollPercent);
        const started = performance.now();
        let lastSegment = segmentAtRotation(plan.from, zones);
        const tick = (now: number): void => {
          const elapsed = now - started;
          const rotation = rotationAt(plan, elapsed);
          dial.style.transform = `rotate(${rotation}deg)`;
          const at = segmentAtRotation(rotation, zones);
          if (at !== lastSegment) {
            lastSegment = at;
            pointer.classList.remove('flick');
            void pointer.offsetWidth;
            pointer.classList.add('flick');
          }
          if (elapsed < plan.duration) {
            requestAnimationFrame(tick);
            return;
          }
          dial.style.transform = `rotate(${plan.from + plan.total}deg)`;
          setState('LANDED');
          spin.classList.add('hidden');
          // The wheel is fully stopped before the outcome is rendered. The
          // dwell makes the LANDED frame observable and gives the pointer a
          // beat to settle before the result card appears.
          window.setTimeout(() => {
            if (done) return;
            setState('RESULT_SHOWN');
            result.textContent = spec.result ?? (spec.success ? 'Success' : 'Failure');
            result.classList.add(spec.success ? 'good' : 'bad');
            proceed.classList.remove('hidden');
            proceed.focus();
          }, 1000);
        };
        requestAnimationFrame(tick);
      });
      proceed.addEventListener('click', close);
    });
  }

  private cashFloat(amount: number): void {
    const el = h('div', { class: `cash-float ${amount > 0 ? 'gain' : 'loss'}` }, `${amount > 0 ? '+' : ''}${money(amount)}`);
    const x = window.innerWidth / 2 + (Math.random() * 80 - 40);
    el.style.left = `${x}px`;
    el.style.top = `${window.innerHeight - 190}px`;
    document.body.append(el);
    setTimeout(() => el.remove(), 950);
  }

  private countMoney(el: HTMLElement, target: number): void {
    const entry = this.moneyEls.get(el) ?? { shown: target, target };
    entry.target = target;
    this.moneyEls.set(el, entry);
    if (Math.abs(entry.shown - target) > 0.5) el.textContent = money(entry.shown);
    else el.textContent = money(target);
  }

  private animate = (): void => {
    this.raf = requestAnimationFrame(this.animate);
    const now = performance.now();
    for (const [el, entry] of this.moneyEls) {
      if (Math.abs(entry.shown - entry.target) < 0.5) {
        entry.shown = entry.target;
        continue;
      }
      const k = 1 - Math.pow(0.86, (now - (this.lastTick ?? now)) / 16);
      entry.shown += (entry.target - entry.shown) * k;
      el.textContent = money(entry.shown);
    }
    this.lastTick = now;
  };

  private lastTick = 0;

  dispose(): void {
    cancelAnimationFrame(this.raf);
  }
}

function heap(space: ReturnType<typeof spaceAt>): string {
  return space.group ? GROUP_LABEL[space.group] ?? 'Space' : space.type === 'railroad' ? 'Railroad' : 'Utility';
}

function helpRows(): HTMLElement[] {
  const rows: Array<[string, string]> = [
    ['Roll', 'Solo: only the active seat rolls, and doubles grant another roll. Multiplayer: roll whenever the dice are ready.'],
    ['Buy', 'Land on an unowned street and buy it, or pass. Multiplayer lets you build on any owned street; solo needs the full colour group.'],
    ['Build', 'Three slots per property. Duplicate types are allowed at 100% / 70% / 50% return. Solo uses the standard House and Hotel; multiplayer exposes all 32 building types.'],
    ['Rent', 'Pay, or try to evade. Evading is risky: reputation and a penalty if caught.'],
    ['Mortgage', 'Half the price, no rent while mortgaged. Unmortgaging adds 10%.'],
    ['Loans', 'Borrow up to three times net worth. Interest is deducted every roll.'],
    ['Stocks', 'Every street is a ticker. Buy, sell and max-trade in one click; candles retry if the socket is still opening.'],
    ['Jail', 'Release costs 10% of your current cash, minimum $50. Entry also mortgages deeds and sells buildings; the jail sale can recover them.'],
    ['Court', 'Detectives build evidence. Sue with evidence, settle for 1.5x, or go to court.'],
  ];
  return rows.map(([title, text]) =>
    h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), h('div', { class: 'row-sub' }, text))),
  );
}

interface SoloMeta {
  exists: boolean;
  corrupt?: boolean;
  updatedAt?: number;
  turnNumber?: number;
  playerName?: string;
  played?: number;
}

