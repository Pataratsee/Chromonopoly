import * as THREE from 'three';
import { CAMERA } from './config';
import { Stage } from './render/scene';
import { createBoard, pickTile, type BoardView } from './board/board';
import { SPACES } from './game/board';
import { TokenLayer } from './render/tokens';
import { BuildingLayer } from './render/buildings';
import { CityLayer } from './render/city';
import { Sky } from './board/sky';
import { DiceLayer } from './board/dice';
import { JailCageLayer } from './board/jail';
import { loadManifest, type ModelAsset } from './render/models';
import { ThumbnailStudio } from './render/thumbnails';
import { NetClient } from './net/client';
import { UI } from './ui/ui';
import { audio } from './audio/audio';
import { applySettings, loadSettings } from './ui/settings';
import type { GameEvent, PublicState, Settings } from './game/types';

type TurnState =
  | 'IDLE'
  | 'DICE_ROLLING'
  | 'DICE_SETTLED'
  | 'CAMERA_ZOOM_IN'
  | 'PIECE_MOVING'
  | 'PIECE_LANDED'
  | 'CAMERA_ZOOM_OUT'
  | 'TILE_PROMPT';

interface TurnLogEntry {
  at: number;
  elapsed: number;
  state: TurnState;
  detail?: string;
}

declare global {
  interface Window {
    __tileScreen?: (index: number) => { x: number; y: number };
    __tilePoint?: (index: number) => { x: number; y: number; z: number };
    __turnLog?: TurnLogEntry[];
    __flowState?: TurnState;
    __stage?: Stage;
    __sky?: Sky;
  }
}

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const boot = document.getElementById('boot') as HTMLElement;

async function start(): Promise<void> {
  const settings = loadSettings();
  applySettings(settings);
  // Apply the saved switches before the first gesture unlocks the bus.
  audio.setVolumes(settings.master, settings.music, settings.sfx);
  audio.setSfxOn(settings.sfxOn);
  audio.setMusicOn(settings.musicOn);

  const manifest = await loadManifest();
  const assets = manifest.assets as ModelAsset[];
  const stage = new Stage(canvas, settings.quality);
  stage.camera.layers.enable(2);
  const testParams = new URLSearchParams(location.search);
  const fastTest = testParams.has('e2e') && !testParams.has('visual');
  if (fastTest) stage.setQuality('low');
  const board: BoardView = await createBoard();
  stage.scene.add(board.group);
  const sky = new Sky();
  sky.setRunning(settings.skyRunning);
  sky.setHour(settings.skyHour);
  stage.scene.add(sky.group);
  // Fast functional browser tests skip the 80-model city; visual tests and play render it.
  const city = fastTest ? null : new CityLayer(stage.scene);
  if (testParams.has('e2e')) {
    window.__stage = stage;
    window.__sky = sky;
  }
  const dice = new DiceLayer(stage.scene);
  const tokens = new TokenLayer(stage.scene);
  const buildings = new BuildingLayer(stage.scene);
  const cages = new JailCageLayer(stage.scene);
  const studio = new ThumbnailStudio();
  const net = new NetClient();

  let state: PublicState | null = null;
  let activeId: string | null = null;

  const ui = new UI({
    net,
    studio,
    assets,
    onSettings: (next: Settings) => {
      stage.setQuality(next.quality);
      stage.rig.speed = next.cameraSpeed;
      audio.setVolumes(next.master, next.music, next.sfx);
      audio.setSfxOn(next.sfxOn);
      audio.setMusicOn(next.musicOn);
      audio.duck(false);
      sky.setRunning(next.skyRunning);
      sky.setHour(next.skyHour);
      document.body.classList.toggle('reduced-motion', next.reducedMotion);
    },
  });

  const resize = (): void => stage.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  resize();

  const hold = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));
  let turnState: TurnState = 'IDLE';
  let turnActive = false;
  let turnRun = 0;
  let flowStartedAt = performance.now();
  let turnLog: TurnLogEntry[] = [];
  let followPieceId: string | null = null;
  let moveTile: number | null = null;
  let rollWaiter: ((dice: [number, number] | null) => void) | null = null;
  let bufferedLocal: GameEvent[] = [];
  const stateWaiters: Array<{ id: string; from: number; finish: (tile: number | null) => void }> = [];

  const setFlowState = (next: TurnState, detail = ''): void => {
    turnState = next;
    const at = Math.round(performance.now());
    turnLog.push({ at, elapsed: Math.round(at - flowStartedAt), state: next, detail });
    window.__turnLog = turnLog;
    window.__flowState = next;
    if (new URLSearchParams(location.search).has('e2e')) console.debug('[turn]', next, detail);
  };

  const waitForRoll = (timeoutMs = 4500): Promise<[number, number] | null> =>
    new Promise((resolve) => {
      let done = false;
      const finish = (dice: [number, number] | null): void => {
        if (done) return;
        done = true;
        rollWaiter = null;
        resolve(dice);
      };
      rollWaiter = finish;
      window.setTimeout(() => finish(null), timeoutMs);
    });

  const waitForPositionChange = (id: string, from: number, timeoutMs = 2200): Promise<number | null> =>
    new Promise((resolve) => {
      const current = state?.players[id];
      if (current && current.position !== from) {
        resolve(current.position);
        return;
      }
      let done = false;
      const finish = (tile: number | null): void => {
        if (done) return;
        done = true;
        const index = stateWaiters.findIndex((w) => w.finish === finish);
        if (index >= 0) stateWaiters.splice(index, 1);
        resolve(tile);
      };
      stateWaiters.push({ id, from, finish });
      window.setTimeout(() => finish(null), timeoutMs);
    });

  const flushBuffered = (): void => {
    const events = bufferedLocal.splice(0);
    for (const ev of events) ui.event(ev);
  };

  const abortTurn = (reason: string): void => {
    turnRun += 1;
    turnActive = false;
    followPieceId = null;
    const local = net.playerId;
    if (local) tokens.resume(local);
    ui.setPromptsBlocked(false);
    setFlowState('IDLE', reason);
    flushBuffered();
  };

  const runTurn = async (): Promise<void> => {
    const local = net.playerId;
    const me = local ? state?.players[local] : null;
    if (!local || !me || me.bankrupt || turnActive) return;
    if (turnState !== 'IDLE' && turnState !== 'TILE_PROMPT') return;

    const run = ++turnRun;
    const from = me.position;
    flowStartedAt = performance.now();
    turnLog = [];
    bufferedLocal = [];
    moveTile = null;
    turnActive = true;
    tokens.pause(local);
    ui.setPromptsBlocked(true);
    setFlowState('IDLE', 'ready');
    setFlowState('DICE_ROLLING');
    stage.rig.focusDice();

    try {
      const diceResult = await waitForRoll();
      if (run !== turnRun) return;
      if (!diceResult) throw new Error('The table did not return dice.');

      await dice.whenSettled(2800);
      if (run !== turnRun) return;
      setFlowState('DICE_SETTLED');
      await hold(600);
      if (run !== turnRun) return;

      const changed = await waitForPositionChange(local, from);
      if (run !== turnRun) return;
      const target = changed ?? state?.players[local]?.position ?? moveTile ?? from;
      const piece = tokens.positionOf(local) ?? board.tilePoint(from);
      setFlowState('CAMERA_ZOOM_IN', `tile ${target}`);
      stage.rig.focus(new THREE.Vector3(piece.x, 0.2, piece.z), CAMERA.followRadius);
      await stage.rig.whenSettled(1700);
      if (run !== turnRun) return;

      setFlowState('PIECE_MOVING', `tile ${target}`);
      followPieceId = local;
      tokens.resume(local);
      // `waitForIdle` can observe the old target in the one-frame gap before
      // the server state reaches `tokens.sync`, releasing the prompt while the
      // piece is still at its previous tile. Wait for the rendered position to
      // actually reach the requested tile centre instead.
      await hold(80);
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (): void => {
          const actual = tokens.positionOf(local);
          const center = board.tilePoint(target);
          const distance = actual ? Math.hypot(actual.x - center.x, actual.z - center.z) : Infinity;
          if ((tokens.isIdle(local) && distance < 0.05) || performance.now() - start > 3000) resolve();
          else requestAnimationFrame(tick);
        };
        tick();
      });
      if (run !== turnRun) return;
      followPieceId = null;
      setFlowState('PIECE_LANDED');
      await hold(1000);
      if (run !== turnRun) return;
      const landed = tokens.positionOf(local);
      const landingCenter = board.tilePoint(target);
      if (!landed || Math.hypot(landed.x - landingCenter.x, landed.z - landingCenter.z) >= 0.05) {
        // A paused-path race can leave the visual at the old tile even after the
        // state changed. The prompt must never release until the piece is exact.
        tokens.snapTo(local, target);
      }

      setFlowState('CAMERA_ZOOM_OUT');
      stage.rig.reset();
      await stage.rig.whenSettled(1900);
      if (run !== turnRun) return;

      setFlowState('TILE_PROMPT', 'prompts released');
      // Record the rendered landing independently of the token animation. This
      // catches a snapped landing when the server state arrives while paused.
      const actual = tokens.positionOf(local);
      const center = board.tilePoint(target);
      if (actual) {
        const distance = Math.hypot(actual.x - center.x, actual.z - center.z);
        const log = window.__moveLog ?? [];
        const last = log[log.length - 1];
        if (!last || last.playerId !== local || last.logicTileIndex !== target) {
          log.push({
            playerId: local,
            logicTileIndex: target,
            tileName: SPACES[target]?.name ?? 'unknown',
            pieceWorldPosition: { x: Number(actual.x.toFixed(4)), y: Number(actual.y.toFixed(4)), z: Number(actual.z.toFixed(4)) },
            tileCenterWorldPosition: { x: Number(center.x.toFixed(4)), y: Number(center.y.toFixed(4)), z: Number(center.z.toFixed(4)) },
            distance: Number(distance.toFixed(4)),
            inJail: Boolean(state?.players[local]?.inJail),
            at: performance.now(),
          });
          window.__moveLog = log;
        }
      }
      turnActive = false;
      ui.setPromptsBlocked(false);
      flushBuffered();
      ui.noteLanding();
    } catch (error) {
      if (run !== turnRun) return;
      const reason = error instanceof Error ? error.message : 'The turn could not finish.';
      ui.toast(reason, 'bad');
      abortTurn(reason);
    }
  };

  const applyState = (next: PublicState): void => {
    state = next;
    board.update(next, ui.settingsValue.showPrices);
    void tokens.sync(next.players);
    buildings.sync(next);
    cages.sync(next.players, board.tilePoint(10));
    ui.setState(next);
    const id = net.playerId;
    if (id && next.players[id]) activeId = id;
    for (const waiter of [...stateWaiters]) {
      const p = next.players[waiter.id];
      if (p && p.position !== waiter.from) waiter.finish(p.position);
    }
  };

  net.onState = applyState;
  net.onPrivate = (p) => {
    ui.setPrivate(p);
    activeId = p.you.id;
  };
  net.onEvent = (ev) => {
    const local = net.playerId;
    if (ev.kind === 'roll' && ev.playerId === local) {
      const diceResult = ev.dice ?? [1, 1];
      rollWaiter?.(diceResult as [number, number]);
      ui.event(ev);
      return;
    }
    if (ev.kind === 'move' && ev.playerId === local) {
      moveTile = ev.tile ?? moveTile;
      ui.event(ev);
      return;
    }
    const isLocal = Boolean(
      local && (ev.playerId === local || ev.targetId === local || ev.audience?.includes(local)),
    );
    if (turnActive && isLocal) {
      bufferedLocal.push(ev);
      return;
    }
    ui.event(ev);
  };
  net.onReject = (reason) => {
    ui.toast(reason, 'bad');
    if (turnActive) abortTurn(reason);
  };
  net.onStatus = (status) => {
    if (status === 'online') {
      ui.ribbon(
        'Connected',
        net.mode === 'solo' ? 'Your solo table · three AI rivals' : 'One board · everyone plays at once',
      );
    } else if (status === 'offline') {
      ui.toast('Connection lost — reconnecting', 'bad');
    }
  };

  // ------------------------------------------------------------- camera input
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pointerDown = false;
  let downX = 0;
  let downY = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hover: number | null = null;

  const worldFromPointer = (e: { clientX: number; clientY: number }): THREE.Vector3 => {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    return stage.worldPoint(ndc);
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    dragging = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) dragging = true;
      if (dragging) {
        stage.rig.orbit(ui.settingsValue.invertOrbit ? -dx : dx, dy);
        lastX = e.clientX;
        lastY = e.clientY;
      }
      return;
    }
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const tile = pickTile(raycaster, stage.camera, board.tiles, ndc);
    if (tile !== hover) {
      hover = tile;
      board.setHover(tile);
      canvas.style.cursor = tile === null ? 'grab' : 'pointer';
    }
  });

  const endPointer = (e: PointerEvent): void => {
    if (!pointerDown) return;
    pointerDown = false;
    if (!dragging) {
      // Resolve the tile from the click itself: touch and stylus do not emit a
      // preceding pointermove, so relying on `hover` made taps do nothing.
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      const tile = pickTile(raycaster, stage.camera, board.tiles, ndc);
      if (tile !== null) {
        const point = worldFromPointer(e);
        stage.rig.focus(new THREE.Vector3(point.x * 0.55, 0, point.z * 0.55), CAMERA.minRadius + 4);
        ui.openTile(tile);
      }
    }
    dragging = false;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', () => {
    pointerDown = false;
    dragging = false;
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      // Zoom toward the tile under the cursor, not the screen centre.
      stage.rig.zoom(e.deltaY, worldFromPointer(e));
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (e.key === 'q' || e.key === 'Q') stage.rig.snap(-1);
    else if (e.key === 'e' || e.key === 'E') stage.rig.snap(1);
    else if (e.key === 'Escape') {
      stage.rig.reset();
      board.setHover(null);
    } else if (e.code === 'Space') {
      e.preventDefault();
      const btn = document.getElementById('roll-btn') as HTMLButtonElement | null;
      if (btn && !btn.disabled) btn.click();
    }
  });

  window.addEventListener('chromonopoly:camera', (e) => {
    const action = (e as CustomEvent<string>).detail;
    if (action === 'left') stage.rig.snap(-1);
    else if (action === 'right') stage.rig.snap(1);
    else stage.rig.reset();
  });

  // Rolling or landing asks the camera to settle on the acting piece.
  window.addEventListener('chromonopoly:focus', () => {
    if (!state || !activeId) return;
    const p = state.players[activeId];
    if (!p) return;
    const t = p.inJail ? board.tilePoint(10) : board.tilePoint(p.position);
    stage.rig.focus(new THREE.Vector3(t.x * 0.55, 0.2, t.z * 0.55), CAMERA.followRadius);
  });

  window.addEventListener('chromonopoly:dice', (e) => {
    const detail = (e as CustomEvent<'roll' | [number, number]>).detail;
    if (detail === 'roll') {
      stage.rig.focusDice();
      dice.start();
    } else if (Array.isArray(detail)) {
      dice.settle([Number(detail[0]), Number(detail[1])]);
    }
  });

  window.addEventListener('chromonopoly:roll-start', () => {
    void runTurn();
  });

  window.addEventListener('chromonopoly:card', (e) => {
    const detail = (e as CustomEvent<{ deck?: 'chance' | 'chest'; text?: string }>).detail;
    board.playCard(detail.deck ?? 'chance', detail.text ?? '');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) net.resync();
  });

  // follow the active token, and resume after manual orbit
  const followTarget = new THREE.Vector3();
  let last = performance.now();

  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stage.rig.update(dt);
    const skyState = sky.update(dt);
    city?.setSky(skyState);
    city?.update(dt, now / 1000);
    dice.update(dt, now);
    cages.update(now);
    board.tick(now / 1000, stage.camera);
    tokens.update(dt, activeId);
    buildings.update();
    if (followPieceId) {
      const piece = tokens.positionOf(followPieceId);
      if (piece) stage.rig.track(piece);
    } else if (state && activeId && state.players[activeId]) {
      const p = state.players[activeId];
      if (p.inJail) {
        const jail = board.tilePoint(10);
        followTarget.set(jail.x, 0.2, jail.z);
      } else {
        const t = board.tilePoint(p.position);
        followTarget.set(t.x * 0.55, 0.1, t.z * 0.55);
      }
      if (ui.settingsValue.followCamera && performance.now() > stage.rig.manualUntil) stage.rig.follow(followTarget, dt);
    }
    stage.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  ui.mount();
  performance.mark('chromonopoly-ready');

  // Test-only projection hook: lets Playwright click a real tile without guessing pixels.
  if (new URLSearchParams(location.search).has('e2e')) {
    window.__tileScreen = (index: number) => {
      stage.camera.updateMatrixWorld();
      const p = board.tilePoint(index).clone().project(stage.camera);
      return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((-p.y + 1) / 2) * window.innerHeight };
    };
    window.__tilePoint = (index: number) => {
      const p = board.tilePoint(index);
      return { x: p.x, y: p.y, z: p.z };
    };
  }

  // first frame proves the renderer is alive
  requestAnimationFrame(() => {
    boot.classList.add('done');
    setTimeout(() => boot.remove(), 600);
  });

  // one-time gesture unlocks audio
  const unlock = (): void => {
    audio.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // deterministic focus for screenshots/tests
  window.addEventListener('beforeunload', () => stage.dispose());
}

start().catch((err: unknown) => {
  console.error(err);
  if (boot) {
    const message = err instanceof Error ? err.message : String(err);
    boot.innerHTML = '<div class="boot-mark">CHROMONOPOLY</div><div class="boot-error" style="max-width:420px;text-align:center;opacity:.8"></div>';
    const detail = boot.querySelector<HTMLElement>('.boot-error');
    if (detail) detail.textContent = `The board could not start: ${message}`;
  }
});
