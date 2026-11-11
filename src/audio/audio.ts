/**
 * One master bus -> limiter -> destination; music and SFX have their own gains.
 * Music is eight original calm recordings, streamed lazily as Opus with an AAC
 * fallback, shuffled without repeats and crossfaded at every boundary. Sound
 * effects remain synthesised. The audio sources and their CC0 licences live in
 * public/audio/LICENSE.md.
 */

import { assetUrl } from '../assetUrl';
import { TRACKS, SongDeck, songDuration, type Track } from './songs';

type Sfx =
  | 'click'
  | 'hover'
  | 'dice'
  | 'hop'
  | 'cash'
  | 'spend'
  | 'purchase'
  | 'build'
  | 'mortgage'
  | 'card'
  | 'jail'
  | 'fail'
  | 'detective'
  | 'gavel'
  | 'verdict'
  | 'victory';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private musicGains: [GainNode, GainNode] | null = null;
  /** Two music buses let one track fade out under the next. */
  private musicTimer: number | null = null;
  private crossfadeTimer: number | null = null;
  private players: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private trackIndex = 0;
  private activeMusicSlot: 0 | 1 = 0;
  private transitioning = false;
  private crossfades = 0;
  private readonly songDeck = new SongDeck(TRACKS.length);
  private volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
  private musicOn = true;
  private sfxOn = true;
  private ducked = false;
  /** Every in-flight one-shot, so switching SFX off stops it immediately. */
  private readonly sfxNodes = new Set<AudioScheduledSourceNode>();

  init(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);

    const a = this.ctx.createGain();
    const b = this.ctx.createGain();
    a.gain.value = 1;
    b.gain.value = 0;
    a.connect(this.musicBus);
    b.connect(this.musicBus);
    this.musicGains = [a, b];
    this.applyVolumes();
  }

  resume(): void {
    this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (this.musicOn && this.musicTimer === null) this.startMusic();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    // Volume is separate from the on/off switch. The switch stops in-flight
    // nodes; this only changes the bus gain for sounds already allowed.
    this.applyVolumes();
  }

  setSfxOn(on: boolean): void {
    this.sfxOn = on;
    if (!on) this.stopSfx();
    this.applyVolumes();
  }

  private stopSfx(): void {
    for (const node of this.sfxNodes) {
      try {
        node.stop();
      } catch {
        // An already-ended node is a no-op.
      }
    }
    this.sfxNodes.clear();
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (!on) this.stopMusic();
    else if (this.ctx && this.musicTimer === null) this.startMusic();
    this.applyVolumes();
  }

  duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.volumes.master, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? this.volumes.sfx : 0, this.ctx.currentTime, 0.05);
    const music = this.musicOn ? this.volumes.music * (this.ducked ? 0.4 : 1) : 0;
    this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.08);
  }

  // ------------------------------------------------------------------ SFX

  play(name: Sfx, pitch = 1): void {
    // Gate at the source. With SFX off, no oscillator or buffer is created.
    if (!this.ctx || !this.sfxOn || this.volumes.sfx <= 0) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'click':
        this.blip(880, t, 0.05, 0.18, 'triangle');
        break;
      case 'hover':
        this.blip(1240, t, 0.03, 0.06, 'sine');
        break;
      case 'dice':
        this.noise(t, 0.22, 0.28, 1800);
        this.blip(180, t + 0.05, 0.08, 0.12, 'square');
        break;
      case 'hop':
        // Each hop gets its own pitch so a run of tiles does not sound mechanical.
        this.blip(520 * pitch, t, 0.07, 0.09, 'sine', 740 * pitch);
        break;
      case 'cash':
        this.blip(1046, t, 0.09, 0.15, 'triangle');
        this.blip(1568, t + 0.07, 0.12, 0.12, 'triangle');
        break;
      case 'spend':
        this.blip(392, t, 0.12, 0.13, 'triangle', 262);
        break;
      case 'purchase':
        [523, 659, 784, 1046].forEach((f, i) => this.blip(f, t + i * 0.06, 0.12, 0.12, 'triangle'));
        break;
      case 'build':
        this.noise(t, 0.14, 0.2, 900);
        this.blip(146, t, 0.16, 0.16, 'sine', 110);
        break;
      case 'mortgage':
        this.blip(330, t, 0.22, 0.14, 'sawtooth', 180);
        break;
      case 'card':
        this.noise(t, 0.16, 0.16, 3200);
        break;
      case 'jail':
        this.blip(110, t, 0.3, 0.2, 'square', 70);
        this.noise(t, 0.32, 0.18, 700);
        break;
      case 'fail':
        this.blip(160, t, 0.28, 0.18, 'sawtooth', 90);
        break;
      case 'detective':
        [392, 466, 622, 466].forEach((f, i) => this.blip(f, t + i * 0.11, 0.14, 0.12, 'triangle'));
        break;
      case 'gavel':
        this.noise(t, 0.12, 0.32, 400);
        this.blip(90, t, 0.2, 0.24, 'sine', 60);
        break;
      case 'verdict':
        [523, 392, 523, 659].forEach((f, i) => this.blip(f, t + i * 0.13, 0.2, 0.14, 'triangle'));
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.blip(f, t + i * 0.12, 0.3, 0.16, 'triangle'));
        break;
    }
  }

  private blip(
    freq: number,
    at: number,
    duration: number,
    gain: number,
    type: OscillatorType,
    toFreq?: number,
  ): void {
    if (!this.ctx || !this.sfxOn) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), at + duration);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(g).connect(this.sfxBus);
    this.sfxNodes.add(osc);
    osc.addEventListener('ended', () => this.sfxNodes.delete(osc), { once: true });
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private noise(at: number, duration: number, gain: number, cutoff: number): void {
    if (!this.ctx || !this.sfxOn) return;
    const src = this.createNoise(duration, gain, cutoff, this.sfxBus);
    this.sfxNodes.add(src);
    src.addEventListener('ended', () => this.sfxNodes.delete(src), { once: true });
    src.start(at);
  }

  private createNoise(duration: number, gain: number, cutoff: number, bus: AudioNode): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;
    src.connect(filter).connect(gainNode).connect(bus);
    return src;
  }

  // ---------------------------------------------------------------- music

  private currentTrack(): Track {
    return TRACKS[this.trackIndex]!;
  }

  private canPlayOpus(): boolean {
    if (typeof Audio === 'undefined') return true;
    return Boolean(new Audio().canPlayType('audio/ogg; codecs="opus"'));
  }

  private ensurePlayers(): boolean {
    if (this.players || !this.ctx || !this.musicGains) return Boolean(this.players);
    const created: HTMLAudioElement[] = [];
    for (let slot = 0; slot < 2; slot += 1) {
      const element = new Audio();
      element.preload = 'none';
      element.loop = false;
      element.crossOrigin = 'anonymous';
      const source = this.ctx.createMediaElementSource(element);
      source.connect(this.musicGains[slot]!);
      created.push(element);
    }
    this.players = [created[0]!, created[1]!];
    return true;
  }

  private trackUrl(track: Track): string {
    return assetUrl(this.canPlayOpus() ? track.file : track.fallback);
  }

  private loadTrack(index: number, slot: 0 | 1): HTMLAudioElement | null {
    if (!this.players) return null;
    const track = TRACKS[index]!;
    const element = this.players[slot];
    const url = this.trackUrl(track);
    if (element.dataset.track !== track.id || element.src !== url) {
      element.pause();
      element.src = url;
      element.dataset.track = track.id;
      element.load();
    }
    return element;
  }

  /** Test/UI-visible snapshot; contains no audio samples. */
  musicInfo(): {
    id: string;
    title: string;
    index: number;
    bpm: number;
    bars: number;
    duration: number;
    step: number;
    playing: boolean;
    musicOn: boolean;
    context: AudioContextState | 'none';
    crossfades: number;
    source: string;
    songs: Array<{ id: string; title: string; duration: number; file: string }>;
  } {
    const track = this.currentTrack();
    const element = this.players?.[this.activeMusicSlot];
    return {
      id: track.id,
      title: track.title,
      index: this.trackIndex,
      bpm: track.bpm,
      bars: track.bars,
      duration: Math.round(songDuration(track)),
      step: 0,
      playing: Boolean(element && !element.paused && this.musicTimer !== null),
      musicOn: this.musicOn,
      context: this.ctx?.state ?? 'none',
      crossfades: this.crossfades,
      source: this.trackUrl(track),
      songs: TRACKS.map((entry) => ({
        id: entry.id,
        title: entry.title,
        duration: Math.round(songDuration(entry)),
        file: entry.file,
      })),
    };
  }

  /** Skip immediately, using the same crossfade as a natural track ending. */
  skipSong(): void {
    if (!this.players) {
      this.trackIndex = this.songDeck.next();
      return;
    }
    void this.beginCrossfade(this.songDeck.next());
  }

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null || !this.musicOn) return;
    if (!this.ensurePlayers() || !this.players || !this.musicGains) return;
    const slot = this.activeMusicSlot;
    const element = this.loadTrack(this.trackIndex, slot);
    if (!element) return;
    const gain = this.musicGains[slot];
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    element.currentTime = 0;
    void element
      .play()
      .then(() => {
        if (!this.ctx || this.musicTimer !== null) return;
        gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.4);
        this.musicTimer = window.setInterval(this.musicTick, 500);
      })
      .catch(() => {
        // Autoplay was blocked or the file was unavailable. The next user
        // gesture calls resume() again; keep the toggle honest and stopped.
        this.stopMusic();
      });
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    if (this.crossfadeTimer !== null) window.clearTimeout(this.crossfadeTimer);
    this.musicTimer = null;
    this.crossfadeTimer = null;
    this.transitioning = false;
    for (const element of this.players ?? []) {
      element.pause();
      element.currentTime = 0;
    }
  }

  private musicTick = (): void => {
    if (!this.ctx || !this.players || this.transitioning) return;
    const element = this.players[this.activeMusicSlot];
    if (!element || element.paused || !Number.isFinite(element.duration) || element.duration <= 0) return;
    if (element.duration - element.currentTime <= 2.4) {
      void this.beginCrossfade(this.songDeck.next());
    }
  };

  /**
   * Start the incoming track on the idle bus, fade it up over 2.2 s and fade the
   * outgoing track down over the same interval. The old element is paused only
   * after its fade, so there is no silent gap or click.
   */
  private async beginCrossfade(next: number): Promise<void> {
    if (!this.ctx || !this.players || !this.musicGains) {
      this.trackIndex = next;
      return;
    }
    if (this.transitioning) return;
    this.transitioning = true;
    if (this.crossfadeTimer !== null) window.clearTimeout(this.crossfadeTimer);
    const outgoingSlot = this.activeMusicSlot;
    const incomingSlot: 0 | 1 = outgoingSlot === 0 ? 1 : 0;
    const outgoing = this.players[outgoingSlot];
    const incoming = this.loadTrack(next, incomingSlot);
    if (!incoming) {
      this.transitioning = false;
      return;
    }
    const now = this.ctx.currentTime;
    const fade = 2.2;
    const outGain = this.musicGains[outgoingSlot];
    const inGain = this.musicGains[incomingSlot];
    outGain.gain.cancelScheduledValues(now);
    outGain.gain.setValueAtTime(Math.max(0.0001, outGain.gain.value), now);
    outGain.gain.linearRampToValueAtTime(0.0001, now + fade);
    inGain.gain.cancelScheduledValues(now);
    inGain.gain.setValueAtTime(0.0001, now);
    incoming.currentTime = 0;
    try {
      await incoming.play();
    } catch {
      // A blocked incoming track must not kill the one already playing.
      inGain.gain.setValueAtTime(0.0001, now);
      this.transitioning = false;
      return;
    }
    inGain.gain.linearRampToValueAtTime(1, now + fade);
    this.trackIndex = next;
    this.activeMusicSlot = incomingSlot;
    this.crossfades += 1;
    this.crossfadeTimer = window.setTimeout(() => {
      outgoing.pause();
      outgoing.currentTime = 0;
      this.transitioning = false;
      this.crossfadeTimer = null;
    }, fade * 1000 + 80);
  }
}

export const audio = new AudioEngine();
