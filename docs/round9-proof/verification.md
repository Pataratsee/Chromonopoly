# Round 9 verification record

Executed on 2026-11-09 from `/home/christian/Desktop/LittleProjects/Chromonopoly 3.0`.

## Commands and results

| Command | Result | Log / artifact |
|---|---|---|
| `npm run build` | exit 0; model check, TypeScript, Vite and server bundle; client 1,100.99 kB / 319.35 kB gzip, CSS 47.68 kB / 10.86 kB gzip, server 242.1 kb | `build.log` |
| `npm run typecheck` | exit 0 | `typecheck.log` |
| `npx vitest run` | 12 files, 248/248 tests pass after the save-migration test | `vitest.log` |
| `npx playwright test -g "W2:\|W1:\|W3/W6:\|W5:"` | 4/4 pass | `playwright-final-a.log` |
| `npx playwright test -g "W4:\|W7:\|W13:"` | 3/3 pass | `playwright-final-b.log` |
| `npx playwright test -g "W9/W10/W11/W12:"` | 1/1 pass | `playwright-final-c.log` |
| `npx playwright test -g "W13:" --repeat-each=3` | 3/3 pass after the retarget fix | `playwright-w13-repeat.log` |
| `node scripts/round9-perf.mjs` | exit 0; Low, 4 runs | `perf-low.json` |
| `node_modules/.bin/vite-node scripts/round9-market-sim.ts` | exit 0; 10,000 players | `market-sim.json` |

The Playwright suite is split into three commands because the two-client
`W9/W10/W11/W12` journey takes about 4.4 minutes and the local command window caps a single
synchronous run. All three groups were rerun after the final source and test edits. The
`W9/W10/W11/W12` test sets its own 420 s budget; its body completes in about 4.4 minutes.

## Round 9 browser scenarios

All tests live in `tests/e2e/round9.spec.ts` and use the real built client and server at
`http://127.0.0.1:8790`, with `/api/test/reset` before each test. Each test fails on any console
error, page error, failed request or HTTP status ≥400.

| Spec | What the running game proved | Proof |
|---|---|---|
| `W2` | Four preview labels inside the 3D preview at 1280×720, 1920×1080, 2560×1440, 760×900 and dark 1280×720; no pair overlaps | `w2-menu-0-1280x720.png` … `w2-menu-4-dark-1280x720.png` |
| `W1` | Duplicate-name rejection toast; WebSocket close and automatic same-seat reconnect; second browser reclaims the seat and cash | `w1-*.png` |
| `W3/W6` | Cash chip at Bank/Market/Properties/pending rent; disabled second loan; one global toast above the sheet | `w6-*.png` |
| `W5` | Wheel `IDLE→READY→SPINNING→LANDED→RESULT_SHOWN→CLOSED`, 100 ms samples, result only after the stop | `w5-wheel-100ms.json`, two wheel frames |
| `W4` | Four island angles, default and closest zoom; 4,392 island triangles; 39,466–39,472 full-frame triangles at 477–480 calls | `w4-island-*.png`, `w4-island-triangles.json` |
| `W13` | Rival dice, token follow, landing, 900 ms pause, zoom-out, buffered card; clean console | `w13-bot-turn.png`, `w13-bot-log.json` |
| `W7` | Live drag, wheel zoom and resize keep the orbit pivot inside its radius | `w7-camera-resize.png` |
| `W9/W10/W11/W12` | Live rank-1 rent example at the player's cash; murder warning, 5% wheel and forced-success transfer of three properties; wipe confirmation, 15% wheel, records erased; live market tick | `w9-rent-example.png`, `w10-*.png`, `w11-*.png`, `w12-live-market.png` |

## Unit and simulation coverage

`tests/round9.test.ts` covers:

- username normalization and offensive-name rejection;
- duplicate name, wrong token, right-token reclaim and name release;
- five offline hours selling the five cheapest deeds with the cheapest building refunded 50%;
- no token or token hash in public/private payloads;
- no second loan until full repayment, then allowed again;
- 2/3/4 building slots, 3×/9×/27× upgrades, four building types, fifth rejected, independent rank;
- payer-cash rent at 1%, 40%, two rank-4 buildings at 55%, and the minimum.

`tests/camera.test.ts` runs 1,000 randomized orbit/zoom/snap/focus/follow sequences and asserts the
pivot stays within 1.25 board units. `tests/world.test.ts` covers murder transfer, wipe success and
failure, private audiences and the server economy.

Market simulation: 10,000 players, 16 ticks, median −3.87%, 34.78% profitable, 19.36% above +5%,
0.53% above +25%, max +41.38%, min −33.04%. Raw data in `market-sim.json`; analysis in
`docs/market-balance.md`.

Performance: 75 FPS / 13.33 ms average / 13.4 ms p95 / no frame over 20 ms at 1280×720 Low, in the
unthrottled, 4× CPU, 2× GPU-workload and combined runs; cold cache-disabled load 705 ms. Raw data in
`perf-low.json`; analysis and limitations in `docs/perf-report.md`.

## Live deployment — 2026-11-10

- GitHub Pages run `42729652927` completed successfully for `94dfbfb` and serves the new client.
- The first Render deploy (`94dfbfb`) failed while restoring the Round 8 snapshot because old tiles
  had `building` instead of `buildings[]`. The migration fix `d113086` deployed successfully and
  reports `protocol:3` from live health.
- The live Pages menu, new solo table and a `2 + 3` roll followed by Mr. Ledger's turn were
  exercised against `d113086` with no new console exceptions or failed requests. Details:
  `docs/round9-proof/live-deployment.md`.

## Limitations — not claimed as verified

- **No physical low-end hardware.** Performance was measured in headless Chromium on this desktop
  with CDP CPU throttling and a raised device pixel ratio, not on a budget phone or integrated GPU.
- **No iOS/Safari run.** Browser proof is Chromium only.
- **W1 offline sale is unit-tested only.** No browser test advances the server clock by hours; the
  server-restart reconnect path was not exercised.
- **W8 full visual matrix is not browser-proven.** One live rank-1 house is shown in Properties, and
  four simultaneous mixed-rank buildings are unit-tested, but no screenshot isolates all four visual
  ranks on the board.
- **W12 is a model, not a live 10,000-player session.** The simulation uses independent random
  players and the real price/fee/spread functions.
- **W13 depends on random bot events.** It passed three consecutive runs after the retarget fix, but
  the test does not force a specific card or purchase every time.
- **Cold load is local and cache-disabled.** It is not a throttled-network field measurement.
- **The full browser suite was not replayed after the live save-migration hotfix.** The eight
  Playwright scenarios passed on `94dfbfb`; after Render failed to restore the old save, `d113086`
  was verified with 248 unit tests, a production build and a live solo smoke test (menu, new table,
  `2 + 3` roll, bot turn, clean console). Multiplayer was not separately smoke-tested live.
- Commit, push and deployment were performed. See `docs/round9-proof/live-deployment.md`.
