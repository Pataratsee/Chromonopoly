# Round 10 performance report

## Round 10 measurement (supersedes Round 9)

Measured 10 November 2026 in the Round 10 Playwright pass. The page ran the Low
quality preset at 1280×720 in a solo table with the HUD visible, using headless
Chromium with `--enable-unsafe-swiftshader` and CDP 4× CPU throttling.

- Sampling window: 45.0 s, 222 requestAnimationFrame intervals.
- **Average: 4.92 FPS; p50 200 ms; p95 216.7 ms; p99 250 ms.**
- Scene: 447 draw calls, 38,483 triangles, 900 points, 0 lines.
- Raw trace: `docs/round10-proof/x1-fps-4x.json`.
- Screenshot: `docs/round10-proof/x1-perf-low-4x.png`.

The requested 30 FPS at 4× CPU is **not met** under headless SwiftShader. This is
a real measured failure, not a pass. A physical low-end Chromebook was not
available, so the Chromebook half of the requirement remains **Unverified**.

### Why the Round 9 table is not used

The Round 9 harness reported exactly 75 FPS with identical 13.33 ms deltas under
unthrottled, 4× CPU and 2× GPU modes. Identical timing across throttled modes is
not usable evidence, so the Round 10 in-page rAF trace above is the current
result. The old table is retained below only as historical output.

## Round 9 historical report

Measured on 2026-11-09 with `node scripts/round9-perf.mjs` in headless Chromium on this desktop.
Harness: `scripts/round9-perf.mjs`; raw output: `docs/round9-proof/perf-low.json`. The server was
started by the harness on port 8793 with `CHROMONOPOLY_TEST=1`, `BOTS=0`; the page used the Low
quality preset, a solo table and the full HUD at 1280×720.

## Headline

- **Cold load:** 705 ms wall time with the browser cache disabled. DOMContentLoaded 100 ms, load
  100 ms, app-ready mark 428 ms.
- **Frame rate:** 75 FPS average over 449 samples in 6,000 ms.
- **Frame time:** 13.33 ms average, 13.4 ms p95.
- **Long frames:** 0 frames over 20 ms; 0 over 33 ms.
- **Render load:** 39,178 triangles, 453 draw calls, 900 points, 0 lines in the full Low frame.
- **Island:** 4,392 triangles, 58 detail meshes, 90 petals (separate audit).

These figures were identical in the unthrottled, 4× CPU, 2× GPU-workload and combined runs:

| Run | CPU throttle | GPU workload | Samples | Average | FPS | p95 | >20 ms | >33 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Low, 1280×720, unthrottled | 1× | 1× | 449 | 13.33 ms | 75 | 13.4 ms | 0 | 0 |
| Low, 4× CPU | 4× | 1× | 449 | 13.33 ms | 75 | 13.4 ms | 0 | 0 |
| Low, 2× GPU workload | 1× | 1.414× pixel ratio | 449 | 13.33 ms | 75 | 13.4 ms | 0 | 0 |
| Low, 4× CPU + 2× GPU | 4× | 1.414× pixel ratio | 449 | 13.33 ms | 75 | 13.4 ms | 0 | 0 |

The rendered frame counter advanced in every run (665 / 1,163 / 1,661 / 2,158), so the identical
timing is not a stalled render loop; the browser is capped near 75 Hz and all measured frames fit
inside that budget. The 4× CPU mode uses Chromium's CDP CPU throttling; the 2× GPU mode raises the
device pixel ratio to √2, which increases raster work.

## What this does and does not prove

It proves the Low preset holds the display cap with no frame over 20 ms on this machine, including
under the requested 4× CPU and 2× GPU-workload settings, and that the full scene is 39,178 triangles
with 453 draw calls. It does **not** prove performance on a physical low-end phone, GPU, or browser;
the harness is headless Chromium on the development desktop. The 75 FPS figure is the display cap,
not a measured ceiling.

Cold load was measured locally with the cache disabled, not over a throttled mobile network. The
requested “under 8 seconds” cold-load target is met with a wide margin locally (705 ms), but this is
not a network-throttled field measurement.

## Budget context

The board removed the old city backdrop, so the Low frame is now dominated by the island, board,
licensed token/building models, HUD and lighting. The island itself is 4,392 triangles. There is no
separate before/after city capture in this round; the city was replaced before the final harness
run, so this report measures the delivered scene only.
