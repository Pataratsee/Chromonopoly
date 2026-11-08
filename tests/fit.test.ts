import { readFileSync } from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { fitText, measure } from '../src/board/textFit';
import { boardName, contentBox, HAS_BAND } from '../src/board/layout';
import { SPACES } from '../src/game/board';

const file = readFileSync(path.join(process.cwd(), 'public/fonts/LilitaOne-Regular.ttf'));
const font = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const RESOLUTIONS = [
  { w: 1280, h: 720, name: '1280x720' },
  { w: 1920, h: 1080, name: '1920x1080' },
  { w: 2560, h: 1440, name: '2560x1440' },
  { w: 2560, h: 1080, name: '21:9' },
];

describe('tile text fits its content box', () => {
  for (const res of RESOLUTIONS) {
    for (const space of SPACES) {
      it(`${space.name} at ${res.name}`, () => {
        const box = contentBox(space);
        const corner = space.index % 10 === 0;
        const fit = fitText(font, boardName(space), box, corner ? 0.28 : 0.24);

        expect(fit.lines.length).toBeLessThanOrEqual(2);
        expect(fit.width).toBeLessThanOrEqual(box.w + 1e-9);
        expect(fit.height).toBeLessThanOrEqual(box.h + 1e-9);
        expect(fit.size).toBeGreaterThan(corner ? 0.18 : 0.13);

        // No word may be broken by the wrapper.
        const joined = fit.lines.join(' ');
        expect(joined.replace(/\s+/g, ' ')).toBe(boardName(space).replace(/\s+/g, ' '));

        // Re-measuring the chosen size must agree with the reported width.
        for (const line of fit.lines) {
          expect(measure(font, line, fit.size)).toBeLessThanOrEqual(fit.width + 1e-6);
        }
      });
    }
  }

  it('keeps the text inside the tile and below the band', () => {
    for (const space of SPACES) {
      const box = contentBox(space);
      if (HAS_BAND(space)) expect(box.h).toBeLessThanOrEqual(0.84 - 0.2 + 1e-9);
      expect(box.w).toBeLessThanOrEqual(0.94 + 1e-9);
    }
  });
});
