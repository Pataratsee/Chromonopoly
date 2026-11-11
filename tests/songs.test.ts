import { describe, expect, it } from 'vitest';
import { TRACKS, SongDeck, songDuration } from '../src/audio/songs';

describe('Round 10: eight calm licensed tracks', () => {
  it('has eight distinct arrangements, each between two and four minutes', () => {
    expect(TRACKS).toHaveLength(8);
    expect(new Set(TRACKS.map((song) => song.id)).size).toBe(8);
    expect(new Set(TRACKS.map((song) => song.title)).size).toBe(8);
    for (const song of TRACKS) {
      const seconds = songDuration(song);
      expect(seconds, `${song.title} is too short`).toBeGreaterThanOrEqual(120);
      expect(seconds, `${song.title} is too long`).toBeLessThanOrEqual(240);
      expect(song.file.endsWith('.ogg')).toBe(true);
      expect(song.fallback.endsWith('.m4a')).toBe(true);
    }
    // The six tempos/forms are genuinely different, not renamed copies.
    expect(new Set(TRACKS.map((song) => song.bpm)).size).toBe(8);
    expect(new Set(TRACKS.map((song) => song.bars)).size).toBeGreaterThanOrEqual(4);
  });

  it('plays every song once per cycle and never repeats across a boundary', () => {
    let seed = 0x5eed1234;
    const rng = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const deck = new SongDeck(TRACKS.length, rng);
    const draws = Array.from({ length: TRACKS.length * 4 }, () => deck.next());

    for (let cycle = 0; cycle < 4; cycle += 1) {
      const slice = draws.slice(cycle * TRACKS.length, (cycle + 1) * TRACKS.length);
      expect(new Set(slice).size, `cycle ${cycle} skipped a song`).toBe(TRACKS.length);
    }
    for (let i = 1; i < draws.length; i += 1) {
      expect(draws[i], `song repeated at draw ${i}`).not.toBe(draws[i - 1]);
    }
  });
});
