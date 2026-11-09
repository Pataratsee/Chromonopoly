import { describe, expect, it } from 'vitest';
import { SPACES } from '../src/game/board';
import { HAS_BAND, tileTextLayout } from '../src/board/layout';

const BAND_INNER_EDGE = -0.305;

describe('Round 8: tile text layout', () => {
  it('keeps every name and price inside its tile and off the colour band', () => {
    for (const space of SPACES) {
      const layout = tileTextLayout(space);
      const corner = space.index % 10 === 0;
      const singleLine = corner || space.type !== 'property';
      const halfHeight = (layout.nameSize * 1.1 * (singleLine ? 1 : 2)) / 2;

      expect(layout.nameZ - halfHeight, `${space.name} name top`).toBeGreaterThan(-0.5);
      expect(layout.nameZ + halfHeight, `${space.name} name bottom`).toBeLessThan(0.5);

      if (HAS_BAND(space)) {
        expect(layout.nameZ - halfHeight, `${space.name} overlaps the band`).toBeGreaterThan(BAND_INNER_EDGE);
      }
      if (space.price > 0) {
        expect(layout.priceZ + 0.07, `${space.name} price runs off the tile`).toBeLessThan(0.5);
        expect(layout.priceZ - 0.07, `${space.name} price overlaps the name`).toBeGreaterThan(
          layout.nameZ + halfHeight,
        );
      }
      if (corner) {
        // The painted art owns the centre; the 3D label belongs on the apron.
        expect(layout.nameZ, `${space.name} label still covers the art`).toBeGreaterThanOrEqual(0.3);
      }
    }
  });
});
