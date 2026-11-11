# Load report — Round 11

Measured 2026-11-11 from the production build in this workspace, with a cold browser cache. The server now negotiates gzip for JavaScript, CSS, HTML, JSON, SVG, TTF and glTF, matching the budget's gzip definition instead of measuring the raw 933 kB bundle.

| Measure | Value | Y1 target | Result |
|---|---:|---:|---|
| Initial JS | 955.87 kB / **267.1 kB gzip** | < 300 kB gzip | **PASS** |
| Initial CSS | 52.85 kB / 12.14 kB gzip | — | measured |
| Cold desktop board ready | **1,172 ms** | ≤ 5 s typical | **PASS** |
| Warm reload, cached | **1,023 ms** | ≤ 2 s | **PASS** |
| Fast 3G cold board ready (1.6 Mbps, 150 ms RTT) | **4,709 ms** | ≤ 8 s | **PASS** |
| Fast 3G + 4× CPU cold board ready | 12,081 ms | not the stated budget; stress probe | **FAIL / documented** |
| First-join snapshot | verification pending | < 100 kB | **Unverified** |
| Steady-state traffic/client | verification pending | < 5 kB/s | **Unverified** |
| Multiplayer join after assets | verification pending | ≤ 2 s | **Unverified** |

Fast 3G phase marks from the passing run:

```text
boot start   3,261 ms
manifest     3,537 ms
stage        3,624 ms
board        4,680 ms
island       4,687 ms
UI ready     4,709 ms
```

The JS budget is enforced by `scripts/check-load-budget.mjs`, which runs as part of `npm run build` and exits non-zero above 300 kB gzip.

## What changed

- Removed runtime `opentype.js` from the tile-text path. `src/board/textFit.ts` now measures the loaded font with Canvas 2D; the unit test keeps real glyph metrics through an injected measurer. This cut the bundle from 327.5 kB to 277.1 kB gzip before compression.
- Allowed the menu/UI to paint without waiting for every troika text SDF (`syncTexts` is now off the critical path).
- Added negotiated gzip and `Vary: Accept-Encoding` to the Node static server. This reduced the observed Fast 3G load from 11.57 s to 4.71 s.
- Added the 300 kB initial-JS build gate.

The 4× CPU probe is retained as a stress result, not presented as a pass. On that harsher profile the bundle parse alone takes about 9.9 s before `start()`; this remains a low-end-device limitation.
