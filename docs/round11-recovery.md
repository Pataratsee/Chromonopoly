# Round 11 recovery checklist

Audited 2026-11-11 against the current source, the Round 6–10 documents, `AUDIT.md`, `FINAL_REPORT.md`, the board data and the test suite. This is a status record, not a claim that the earlier round text is complete: the original per-round prompt files were not all present, so the checklist uses the earlier root-cause docs and the rules restated in Round 11.

Legend: **Working** = exercised in this pass; **Broken** = known defect in the current code; **Missing** = no implementation found; **Partial** = implementation exists but the Round 11 acceptance test was not run.

## Core game and board

| Feature | Status | Evidence / note |
|---|---|---|
| 40-space board, 28 buyable spaces, board layout | Working | `src/game/board.ts`, existing layout/fit tests (161 fit cases). |
| Single-player standard houses/hotels | Working | `canBuild` solo branch; solo deliberately exposes only House/Hotel. This is the intended Y6 rule, not a lost catalogue. |
| Single-player Continue / New Game | Partial | Server-backed solo save and session reclaim exist; Round 11 device-local/no-server Continue is not implemented. |
| Strict human → bot seat order | Working | **Y3 proved:** 200 seeded games and the 20 s bot watchdog pass in `tests/round11-turn-order.test.ts`. |
| Bots roll visibly, camera follows, prompts wait | Partial | Existing Round 10 X3/X4 flow; not re-run after these edits. |
| Doubles / three-doubles jail | Working | Existing world flow and tests. |
| 28 properties buildable, exactly 3 multiplayer slots | Working | **Y6 fixed in this pass.** `BUILD_SLOTS = 3`; all property spaces use it. |
| Duplicate building types | Working | **Y6 fixed.** Duplicate rejection removed; duplicate return factors `1 / 0.7 / 0.5`. |
| Per-building rank and slot-specific upgrade/sell | Working | **Y6 fixed.** Intent carries an optional slot; UI sends it; server uses it. |
| Build cost exceeds expected income / payback simulation | Missing | No Y7 validation script or 10,000-game payback run. |
| Island is bigger, decorations pushed out | Working | **Y2 proved:** 24 real renders (`y2-island-angle-*.png`) and a 24-view contact sheet; solid shell audit. |
| Island watertight / no gaps | Partial | **Y2 changed:** redundant degenerate tip strip replaced by a closed bottom cap. No topology test or 24-view proof. |
| No ocean or sea below island | Working (code) | **Y2 fixed:** sea plane and `SEA` material deleted. No browser screenshot. |
| No clouds below island | Working (code) | **Y2 fixed:** 28-block under-island cloud mesh deleted. Sky sprites remain above. No browser screenshot. |
| Campfire looks like fire | Working | **Y11 proved:** real day/night close-ups show three flame billboards, glow, sparks and logs. |
| No floating objects | Partial | Round 8 scan not re-run after island resize. |

## Economy and UI

| Feature | Status | Evidence / note |
|---|---|---|
| Jail release is 10% of current cash, minimum $50 | Working | **Y13 fixed.** `RULES.jailFeeRate = 0.1`; server computes all release costs; browser showed “Pay $500 to get out” at $5,000. |
| Jail fee never zero, displayed = charged | Working | Unit test covers $0, $10, $499, $500, $1k, $1m, $1b; browser test charged and released. |
| BUSTED has no handcuff circles | Working | **Y12 fixed.** DOM and CSS deleted; screenshot `busted-no-cuffs.png`. |
| Chance result does not appear before wheel LANDED | Working | **Y8 proved:** six event types, one overlay each, DOM/result/BUSTED timestamps after wheel LANDED (`y8-chance-order.json`). |
| Stock candles load within 2 s | Partial | **Y5 changed:** request retry every 2 s (3 retries) and live candle fallback. Root server request already existed; the likely loss was a request sent before the socket opened. Not browser-proven. |
| Buy/Sell/Max Buy/Max Sell are one click | Working (code) | **Y5 fixed:** confirmation state and setting removed. Not browser-proven after edit. |
| Max Buy rounds down; Max Sell sells all | Working (code) | Existing `maxBuyShares`; no new browser proof. |
| All 32 building models coloured | Working | Existing blocking audit: 136 GLBs, 413 primitives, 186 material uses, 0 failures. Contact sheets from Round 10. |
| Calm lo-fi soundtrack, 8 tracks, CC0, no chiptune | Working | Eight Opus/AAC tracks remain, 130.9–154.8 s; obsolete synth generator deleted. Runtime audition not repeated. |
| Lazy thumbnails / IndexedDB cache | Partial | Lazy thumbnail observer exists; no IndexedDB cache. |
| Music lazy/streamed, shuffle/crossfade | Working | Existing `src/audio/audio.ts`; Round 10 X12 proof. |
| Load under Y1 budgets | Working | **Y1 fixed:** 267.1 kB JS gzip; cold 1.17 s, warm 1.02 s, Fast 3G 4.71 s; build budget gate. See `docs/load-report.md`. |
| Market one-click setting removed | Working | Setting removed from `Settings`, defaults and UI. |
| Help/tutorial refreshed for Round 11 rules | Working | Help/tutorial now state three slots, duplicate 100/70/50 returns, solo House/Hotel, 10%/$50 jail fee and one-click market. |
| Keyboard shortcuts, sound HUD button, reduced motion | Partial | Space roll and Esc close exist; no HUD sound button; reduced-motion setting exists. |
| Auto-quality from measured FPS | Missing | No Y3 auto-quality controller. |
| Developer F2 panel | Missing | No Z1 panel. |
| Autosave and crash screen | Missing | No Z2 crash/reload screen. |
| Server validation / anti-abuse hardening | Partial | Existing rate limit, idempotency, server-owned rolls. No new Z6 audit. |
| Git release and `v0.11.0` tag | Partial | `.git` metadata restored from `.git-upload` with the real origin; commit/tag/push is performed after this document was written. |

## Final verification

- `npx vitest run`: **15 files, 258/258 passed** (`docs/round11-proof/unit-tests.log`).
- `npm run build`: **passed**; model audit passed; JS **955.87 kB / 267.1 kB gzip**; budget gate passed.
- Round 11 browser proof: **passed** for Y1/Y2/Y11/Y5 in 2.0 min, Fast 3G in 4.71 s, and Y8 in six real event sequences.
- `npx playwright test tests/e2e/round10.spec.ts -g "X6-X7"`: **1 passed** in 23.9 s, including a real release payment.
- Visual inspection: 24 island angles show no sea or under-island clouds; BUSTED has no cuffs; campfire reads day/night.
- Still not implemented: Y7 payback simulation, Y9 rendered colour re-audit, Y10 device-local save, Z1–Z7.
