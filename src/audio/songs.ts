/**
 * The eight calm, original instrumental tracks. Metadata is kept free of Web
 * Audio types so duration, licence and shuffle rules are testable in Node.
 * The audio files are Opus with an AAC fallback for Safari, mastered offline.
 */

import trackData from './tracks.json';

export type Track = {
  id: string;
  title: string;
  /** Path relative to public/. Opus is preferred when the browser supports it. */
  file: string;
  /** AAC fallback for browsers without Ogg Opus. */
  fallback: string;
  bpm: number;
  bars: number;
  beatsPerBar: number;
  mood: string;
};

export const TRACKS: readonly Track[] = trackData;

/** Duration of one full arrangement in seconds. */
export function songDuration(track: Track): number {
  return (track.bars * track.beatsPerBar * 60) / track.bpm;
}

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/**
 * Shuffle bag: every track plays once per cycle, and a cycle boundary never
 * repeats the track that just finished.
 */
export class SongDeck {
  private bag: number[] = [];
  private last = -1;

  constructor(
    private readonly count = TRACKS.length,
    private readonly rng: () => number = Math.random,
  ) {
    if (count < 1) throw new Error('A song deck needs at least one track.');
  }

  next(): number {
    if (this.bag.length === 0) {
      this.bag = Array.from({ length: this.count }, (_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.rng() * (i + 1));
        const swap = this.bag[i]!;
        this.bag[i] = this.bag[j]!;
        this.bag[j] = swap;
      }
      if (this.bag.length > 1 && this.bag[0] === this.last) {
        const swap = this.bag[0]!;
        this.bag[0] = this.bag[1]!;
        this.bag[1] = swap;
      }
    }
    const next = this.bag.shift()!;
    this.last = next;
    return next;
  }
}
