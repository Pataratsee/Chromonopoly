# Round 11 proof

Observed on 2026-11-11 from this workspace and the production build, not from a mock server.

## Commands and outcomes

| Check | Command | Result |
|---|---|---|
| Unit suite | `npx vitest run` | **15 files, 258/258 passed** (`unit-tests.log`) |
| Production build | `npm run build` | **passed**, model audit passed, JS **955.87 kB / 267.1 kB gzip**, budget gate passed |
| Y1/Y2/Y11/Y5 browser proof | `npx playwright test tests/e2e/round11.spec.ts -g "Y1/Y2/Y11/Y5"` | **1 passed in 2.0 min** |
| Fast 3G | same spec, `-g "Fast 3G reaches"` | **1 passed**, cold **4,709 ms** |
| Y8 + campfire | same spec, `-g "Y8:|campfire is visible"` | **2 passed in 2.0 min** (`e2e-y8-campfire.log`) |
| Original custody proof | `npx playwright test tests/e2e/round10.spec.ts -g "X6-X7"` | **1 passed in 23.9 s** (`e2e-x6-x7.log`) |

## Y1 — load

- Initial JS is **267.1 kB gzip**, below the 300 kB budget. The build now fails above 300 kB (`scripts/check-load-budget.mjs`).
- Cold desktop board ready: **1,172 ms**; warm cached: **1,023 ms**.
- Fast 3G (1.6 Mbps, 150 ms RTT): **4,709 ms**, below 8 s.
- The 4× CPU + Fast 3G stress probe was **12,081 ms**; that harsher profile is recorded as a limitation, not a pass.

## Y2 — island

`y2-island-angle-0.png` … `y2-island-angle-23.png` are 24 equally spaced real renders. `y2-island-24-views.json` records the same audit for every angle: `solid: true`, `skyOnly: true`, 3,261 island triangles, 88 details, 48 petals. `y2-island-24-contact.jpg` is the contact sheet. The sea plane and under-island cloud mesh are absent.

## Y3 — turn order

`tests/round11-turn-order.test.ts` runs **200 deterministic seeded games**. Every active seat must be the previous seat or the next alive seat in the human → bot ring, a non-active seat's roll must be rejected with `Wait for your turn.`, and all 200 games make progress. A separate case advances the clock 20 s and proves the bot watchdog acts.

## Y5 — market

The every-screen smoke opens Market in the real solo app. One-click trading and candle retry are covered by the code path; the focused proof does not execute a live stock purchase.

## Y8 — chance ordering

`y8-chance-order.json` contains six real UI event sequences: theft, robbery, murder, detective, wipe and jail. In every sequence:

- exactly one chance overlay is inserted;
- wheel transitions include `LANDED`;
- the result card (when present) is inserted after `LANDED`;
- BUSTED is inserted after the result/LANDED, never before.

## Y11 — campfire

`y11-campfire-day.png` and `y11-campfire-night.png` are real close-up renders. The logs, three additive flame billboards, ground glow and sparks are visible; night mode raises the glow and flame opacity. The campfire is outside the board on the lawn.

## Y12/Y13 — custody

`busted-no-cuffs.png` shows the BUSTED bars, lights, vignette and word with no handcuff circles. `jail-release.png` and `jail-release.json` show a $500 release charge at $5,000 cash and the 10%/minimum-$50 title.

## Every-screen smoke

`every-screen-smoke.json` lists Market, Bank, Underworld, Detective, Properties, Reputation, Court, Logs, Settings, Pieces and How to play, each opened and closed in the browser. Matching screenshots are `smoke-*.png`.

## Limits

- The full Playwright suite was not run; the focused Round 11 and custody tests above were.
- The 4× CPU Fast 3G stress profile remains over 8 s.
- Untested in this pass: Y7 payback simulation, Y9 rendered colour re-audit, Y10 device-local save, and Z1–Z7. These are not claimed as complete.
- Git metadata was recovered from the bundled `.git-upload` clone; commit/tag/push result is recorded in the final delivery message.
