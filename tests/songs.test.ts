import { describe, expect, it } from 'vitest';
import { SONGS, SongDeck, songDuration } from '../src/audio/songs';

describe('Round 8 V14: six arranged songs', () => {
  it('has six distinct arrangements, each between two and four minutes', () => {
    expect(SONGS).toHaveLength(6);
    expect(new Set(SONGS.map((song) => song.id)).size).toBe(6);
    expect(new Set(SONGS.map((song) => song.title)).size).toBe(6);
    for (const song of SONGS) {
      const seconds = songDuration(song);
      expect(seconds, `${song.title} is too short`).toBeGreaterThanOrEqual(120);
      expect(seconds, `${song.title} is too long`).toBeLessThanOrEqual(240);
      expect(song.chords.length).toBeGreaterThanOrEqual(4);
      expect(song.melody.length).toBeGreaterThanOrEqual(8);
    }
    // The six tempos/forms are genuinely different, not renamed copies.
    expect(new Set(SONGS.map((song) => song.bpm)).size).toBe(6);
    expect(new Set(SONGS.map((song) => song.bars)).size).toBeGreaterThanOrEqual(4);
  });

  it('plays every song once per cycle and never repeats across a boundary', () => {
    let seed = 0x5eed1234;
    const rng = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const deck = new SongDeck(SONGS.length, rng);
    const draws = Array.from({ length: SONGS.length * 4 }, () => deck.next());

    for (let cycle = 0; cycle < 4; cycle += 1) {
      const slice = draws.slice(cycle * SONGS.length, (cycle + 1) * SONGS.length);
      expect(new Set(slice).size, `cycle ${cycle} skipped a song`).toBe(SONGS.length);
    }
    for (let i = 1; i < draws.length; i += 1) {
      expect(draws[i], `song repeated at draw ${i}`).not.toBe(draws[i - 1]);
    }
  });
});
