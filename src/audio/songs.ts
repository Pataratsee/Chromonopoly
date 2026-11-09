/**
 * The six music arrangements. Kept free of Web Audio types so the tempo,
 * length and shuffle rules can be unit-tested in Node.
 */

export type Song = {
  id: string;
  title: string;
  bpm: number;
  /** Bars before the next song starts. 16 steps per bar. */
  bars: number;
  /** One chord (MIDI notes) per progression step, repeated to fill the bars. */
  chords: readonly (readonly number[])[];
  /** Bass root for each progression step. */
  roots: readonly number[];
  /** Semitone offsets over the chord root for the lead line. */
  melody: readonly number[];
  lead: OscillatorType;
  bass: OscillatorType;
  pad: OscillatorType;
  arp: boolean;
  sparkle: boolean;
};

export const SONGS: readonly Song[] = [
  {
    id: 'opening-bell',
    title: 'Opening Bell',
    bpm: 108,
    bars: 64,
    chords: [
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ],
    roots: [48, 43, 45, 41],
    melody: [0, 4, 7, 9, 7, 4, 2, 0],
    lead: 'triangle',
    bass: 'sine',
    pad: 'sine',
    arp: true,
    sparkle: true,
  },
  {
    id: 'title-deeds',
    title: 'Title Deeds',
    bpm: 120,
    bars: 72,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ],
    roots: [45, 41, 48, 43],
    melody: [0, 3, 7, 10, 7, 3, 5, 3],
    lead: 'sine',
    bass: 'triangle',
    pad: 'sine',
    arp: true,
    sparkle: false,
  },
  {
    id: 'jailhouse-shuffle',
    title: 'Jailhouse Shuffle',
    bpm: 96,
    bars: 64,
    chords: [
      [52, 55, 59],
      [48, 52, 55],
      [55, 59, 62],
      [50, 54, 57],
    ],
    roots: [40, 36, 43, 38],
    melody: [0, 3, 5, 6, 7, 6, 5, 3],
    lead: 'triangle',
    bass: 'sine',
    pad: 'triangle',
    arp: false,
    sparkle: true,
  },
  {
    id: 'skyline-nocturne',
    title: 'Skyline Nocturne',
    bpm: 84,
    bars: 64,
    chords: [
      [50, 53, 57],
      [46, 50, 53],
      [53, 57, 60],
      [48, 52, 55],
    ],
    roots: [38, 34, 41, 36],
    melody: [0, 3, 7, 12, 10, 7, 3, 0],
    lead: 'sine',
    bass: 'sine',
    pad: 'sine',
    arp: true,
    sparkle: false,
  },
  {
    id: 'market-motion',
    title: 'Market Motion',
    bpm: 132,
    bars: 96,
    chords: [
      [53, 57, 60],
      [50, 53, 57],
      [46, 50, 53],
      [48, 52, 55],
    ],
    roots: [41, 38, 34, 36],
    melody: [0, 4, 7, 9, 12, 9, 7, 4],
    lead: 'triangle',
    bass: 'triangle',
    pad: 'sine',
    arp: true,
    sparkle: true,
  },
  {
    id: 'last-circuit',
    title: 'Last Circuit',
    bpm: 116,
    bars: 80,
    chords: [
      [55, 59, 62],
      [52, 55, 59],
      [48, 52, 55],
      [50, 54, 57],
    ],
    roots: [43, 40, 36, 38],
    melody: [0, 2, 4, 7, 9, 7, 4, 2],
    lead: 'triangle',
    bass: 'square',
    pad: 'triangle',
    arp: true,
    sparkle: true,
  },
];

/** Length of one full arrangement in seconds. */
export function songDuration(song: Song): number {
  return (song.bars * 4 * 60) / song.bpm;
}

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/**
 * Shuffle bag: every song plays once per cycle, and a cycle boundary never
 * repeats the song that just finished.
 */
export class SongDeck {
  private bag: number[] = [];
  private last = -1;

  constructor(
    private readonly count = SONGS.length,
    private readonly rng: () => number = Math.random,
  ) {
    if (count < 1) throw new Error('A song deck needs at least one song.');
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
