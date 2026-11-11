# Round 10 browser proof

These are real browser artefacts, not mock-ups. Chromium ran through Playwright
against the built server with the `?e2e` harness. The main session used
1280×720, Low quality and the full HUD; the contact sheets used 1600×1000. The
launch used `--enable-unsafe-swiftshader` because this machine has no hardware
WebGL in headless mode.

## Results

| Item | Result | Evidence |
|---|---|---|
| X1 Performance | **FAILED TARGET** — 4.92 FPS average at Low + 4× CPU; p95 216.7 ms | `x1-fps-4x.json`, `x1-perf-low-4x.png` |
| X2 Island | Verified — four orbit angles, below, default and max zoom; all decorations visible | `x2-island-*.png`, `x2-island-views.json` |
| X3 Camera follow | Verified — full DICE → camera → piece → landed flow | `x3-camera-flow.json`, `x3-camera-follow-moving.png`, `x3-camera-landed.png` |
| X4 Bots | Verified — Mr. Ledger (`cautious`) thinking, 28 pacing/log entries | `x4-bot-thinking.png`, `x4-bot-pacing.json` |
| X5 Market | Verified — 28 options, one terminal, one canvas chart, changing server price | `x5-live-market.png`, `x5-market.json` |
| X6 Busted | Verified — real arrest overlay, text and ARIA | `x6-busted.png`, `x6-busted.json` |
| X7 Jail release | Verified — “Pay $250 to get out”, 5% title, successful release | `x7-jail-release.png`, `x7-jail.json` |
| X8 Upgrade cost | Verified — $150 → $450, disabled “Need $450” | `x8-upgrade-live-cost.png`, `x8-upgrade-disabled-reason.png`, `x8-upgrade.json` |
| X9 Building perks | Verified — House and Hotel cards with Perk/Trade-off in solo | `x9-building-perks.png`, `x9-building-perks.json` |
| X10 Model audit | Verified — 136 GLBs / 413 primitives / 186 uses, 0 failures; 104 piece cards + 32 buildings rendered | `round10-model-audit.*`, `x10-contact-pieces.png` (1600×3171), `x10-contact-buildings.png` (1600×1124), `x10-contact-sheets.json` |
| X11 Court | Verified — two clients, real filed case reopened as “Open cases … v. … · awaiting defendant”; both consoles clean | `x11-court.png`, `x11-court-filed.png`, `x11-court.json` |
| X12 Music | Verified — all 8 tracks, `Dawn Ledger` streaming as `.ogg`, CC0 licence and eight hashes; playing state true | `x12-music-runtime.json`, `x12-music-runtime.png` |
| X13 Soak | **PARTIAL** — 100/100 connected and recovered, 5/5 drops recovered, restart 1.96 s, 0 dropped, action p95 0.03 ms; **ping p95 270 ms and tick p95 423 ms exceed 150 ms** | `soak-100.json`, `soak-server.log` |

## How the evidence was produced

- The final **all-in-one X1–X9 browser pass completed green** in 1.9 minutes and
  wrote `x1-x9-summary.json` and `x1-x9-console-network.json` directly. The
  45-second X1 trace was captured separately and reused for that functional
  pass; the trace file is the measured 4.92 FPS result. X6/X7 also have a
  standalone focused pass. X11, X10 and X12 each have their own browser pass.
- X6/X7 use a test-only quiet jail setup so the unrelated sale wheel cannot
  cover the custody/release controls; the production wheel is unchanged.
- X10 reads every shipped GLB through the same asset loader used by the game.
- X11 creates a real case on the server and reopens the court sheet before
  asserting the open case.
- X12 reports the live `musicInfo()` snapshot and checks the committed licence
  hashes.
- X13 uses an isolated built server on port 8791 with 100 clients, a server
  restart at 50%, five forced disconnects at 20%, and 12,000 real roll intents.
- Verification commands: `npm test`; `npm run build`; and the focused
  `npx playwright test tests/e2e/round10.spec.ts` runs. The full proof command is
  `npm run proof:round10`.

## Limits and unverified items

- X1's 30 FPS requirement is **not met** in headless SwiftShader. No physical
  low-end Chromebook was available, so field performance is **Unverified**.
- X13's connection/recovery/delta/backpressure behaviour passed, but end-to-end
  latency did not: ping p95 270 ms and tick p95 423 ms versus a 150 ms target.
- Music was checked structurally and at runtime; subjective listening quality
  was **not** auditioned here.
- X1–X9 browser execution covered the listed interactions, but not every
  possible jail cause, every device pixel ratio or a multi-hour game.
- The contact sheets are visual audit artefacts; the authoritative material
  pass/fail data is `docs/round10-model-audit.json`.
