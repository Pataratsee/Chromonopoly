/**
 * All audio is synthesised here — no sampled material, so the licence is ours.
 * One master bus -> limiter -> destination; music and SFX have their own gains.
 * Music is a shuffle bag of six full arrangements with a crossfade at each
 * boundary, so it does not loop or repeat the same song back-to-back.
 */

import { SONGS, SongDeck, midiToHz, songDuration, type Song } from './songs';

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
  /** Two music buses let one arrangement fade out under the next. */
  private musicGains: [GainNode, GainNode] | null = null;
  private activeMusicGain: 0 | 1 = 0;
  private musicTimer: number | null = null;
  private songIndex = 0;
  private songStep = 0;
  private crossfades = 0;
  private readonly songDeck = new SongDeck(SONGS.length);
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

  private currentSong(): Song {
    return SONGS[this.songIndex]!;
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
    songs: Array<{ id: string; title: string; duration: number }>;
  } {
    const song = this.currentSong();
    return {
      id: song.id,
      title: song.title,
      index: this.songIndex,
      bpm: song.bpm,
      bars: song.bars,
      duration: Math.round(songDuration(song)),
      step: this.songStep,
      playing: this.musicTimer !== null,
      musicOn: this.musicOn,
      context: this.ctx?.state ?? 'none',
      crossfades: this.crossfades,
      songs: SONGS.map((entry) => ({
        id: entry.id,
        title: entry.title,
        duration: Math.round(songDuration(entry)),
      })),
    };
  }

  /** Skip immediately, using the same crossfade as a natural song ending. */
  skipSong(): void {
    this.advanceSong();
  }

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.songStep = 0;
    if (this.musicGains) {
      const now = this.ctx.currentTime;
      const active = this.musicGains[this.activeMusicGain];
      const inactive = this.musicGains[this.activeMusicGain === 0 ? 1 : 0];
      active.gain.cancelScheduledValues(now);
      active.gain.setValueAtTime(1, now);
      inactive.gain.cancelScheduledValues(now);
      inactive.gain.setValueAtTime(0, now);
    }
    this.musicTimer = window.setTimeout(this.musicTick, 0);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private musicTick = (): void => {
    if (!this.ctx || this.musicTimer === null) return;
    const song = this.currentSong();
    const destination = this.musicGains?.[this.activeMusicGain] ?? this.musicBus;
    this.musicStep(song, this.songStep, this.ctx.currentTime + 0.05, destination);
    this.songStep += 1;
    if (this.songStep >= song.bars * 16) this.advanceSong();
    const stepMs = 60_000 / song.bpm / 4;
    this.musicTimer = window.setTimeout(this.musicTick, stepMs);
  };

  /**
   * Move to the next song in the shuffle bag. The outgoing bus fades over
   * 1.1 s while the incoming bus rises, so there is no silent gap or cut.
   */
  private advanceSong(): void {
    const next = this.songDeck.next();
    if (!this.ctx || !this.musicGains) {
      this.songIndex = next;
      this.songStep = 0;
      return;
    }
    const now = this.ctx.currentTime;
    const outgoing = this.musicGains[this.activeMusicGain];
    const incomingIndex: 0 | 1 = this.activeMusicGain === 0 ? 1 : 0;
    const incoming = this.musicGains[incomingIndex];
    this.songIndex = next;
    this.songStep = 0;
    this.activeMusicGain = incomingIndex;

    outgoing.gain.cancelScheduledValues(now);
    outgoing.gain.setValueAtTime(outgoing.gain.value, now);
    outgoing.gain.linearRampToValueAtTime(0.0001, now + 1.1);

    incoming.gain.cancelScheduledValues(now);
    incoming.gain.setValueAtTime(0.0001, now);
    incoming.gain.linearRampToValueAtTime(1, now + 1.1);
    this.crossfades += 1;
  }

  private musicStep(song: Song, step: number, at: number, destination: AudioNode): void {
    const bar = Math.floor(step / 16) % song.chords.length;
    const beat = step % 16;
    const chord = song.chords[bar]!;
    const root = song.roots[bar % song.roots.length]!;

    if (beat % 4 === 0) {
      this.pluck(midiToHz(chord[0]!), at, 0.34, 0.12, song.pad, destination);
    }
    if (beat % 4 === 2) {
      this.pluck(midiToHz(root), at, 0.3, 0.17, song.bass, destination);
    }
    if (song.arp && beat % 2 === 0) {
      this.pluck(midiToHz(chord[(beat / 2) % chord.length]! + 12), at, 0.18, 0.05, song.lead, destination);
    }
    if (beat === 0 || beat === 6) {
      const melody = song.melody;
      const semitone = melody[(bar * 2 + (beat === 6 ? 1 : 0)) % melody.length]!;
      const note = midiToHz(chord[0]! + 12 + semitone);
      this.pluck(note, at, 0.26, 0.1, song.lead, destination);
      if (song.sparkle) {
        this.pluck(note * 2, at + 0.09, 0.18, 0.035, 'sine', destination);
      }
    }
    if (song.sparkle && beat === 12) {
      this.pluck(midiToHz(chord[2]! + 24), at, 0.2, 0.04, 'sine', destination);
    }
  }

  private pluck(
    freq: number,
    at: number,
    duration: number,
    gain: number,
    type: OscillatorType,
    destination: AudioNode = this.musicBus,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    osc.type = type;
    osc.frequency.value = freq * 2;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(filter).connect(g).connect(destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
}

export const audio = new AudioEngine();
