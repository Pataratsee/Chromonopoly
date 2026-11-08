/**
 * All audio is synthesised here — no sampled material, so the licence is ours.
 * One master bus -> limiter -> destination; music and SFX have their own gains.
 */

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
  private musicTimer: number | null = null;
  private step = 0;
  private volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
  private musicOn = true;
  private ducked = false;

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
    this.applyVolumes();
  }

  resume(): void {
    this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (this.musicOn && this.musicTimer === null) this.startMusic();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
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
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, this.ctx.currentTime, 0.05);
    const music = this.musicOn ? this.volumes.music * (this.ducked ? 0.4 : 1) : 0;
    this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.08);
  }

  // ------------------------------------------------------------------ SFX

  play(name: Sfx): void {
    if (!this.ctx) return;
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
        this.blip(520, t, 0.07, 0.09, 'sine', 740);
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
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), at + duration);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(g).connect(this.sfxBus);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private noise(at: number, duration: number, gain: number, cutoff: number): void {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(at);
  }

  // ---------------------------------------------------------------- music

  /**
   * I–vi–IV–V in C major, 120 BPM, 8-bar loop with plucked melody, bass and
   * shaker. Synthesised so the loop is seamless and unlicensed.
   */
  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const stepMs = (60_000 / 120) / 4;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      this.musicStep(this.step, this.ctx.currentTime + 0.02);
      this.step = (this.step + 1) % 128;
    }, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private musicStep(step: number, at: number): void {
    const bar = Math.floor(step / 16) % 8;
    const beat = step % 16;
    const chords = [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
    ];
    const chord = chords[bar]!;
    const roots = [65.41, 55.0, 43.65, 49.0];
    const melody = [0, 4, 7, 4, 9, 7, 4, 2];

    if (beat % 4 === 0) this.pluck(chord[0]!, at, 0.32, 0.16, 'sine');
    if (beat % 4 === 2) this.pluck(roots[bar % 4]!, at, 0.3, 0.2, 'triangle');
    if (beat % 2 === 0) this.pluck(chord[(beat / 2) % chord.length]!, at, 0.22, 0.08, 'sine');
    if (beat % 4 === 1 || beat % 4 === 3) this.noise(at, 0.05, 0.05, 7000);
    if (beat % 8 === 0 || beat % 8 === 6) {
      const note = chord[0]! * 2 ** (melody[(bar + beat) % melody.length]! / 12);
      this.pluck(note, at, 0.26, 0.11, 'triangle');
      this.pluck(note * 2, at + 0.09, 0.2, 0.05, 'sine');
    }
  }

  private pluck(freq: number, at: number, duration: number, gain: number, type: OscillatorType): void {
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
    osc.connect(filter).connect(g).connect(this.musicBus);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
}

export const audio = new AudioEngine();
