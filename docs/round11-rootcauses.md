# Round 11 root causes and fixes

Only items actually changed in this pass are listed as fixed. Unimplemented items are deliberately absent rather than given a speculative root cause. Line numbers refer to the files after this edit.

## Y6 — build slots and duplicates

**Root cause:** `src/game/buildings.ts:480` still used `BUILD_SLOT_TIERS` with 2/3/4 slots; `src/game/rules.ts:245-260` rejected a second building of the same type. The UI therefore looked like a reduced catalogue, especially in solo where only House/Hotel are legal by design.

**Fix:** `BUILD_SLOTS = 3` in `src/game/buildings.ts:481`; `DUPLICATE_RETURN_FACTORS = [1, 0.7, 0.5]` at line 484 and `duplicateFactor()` at 491. Duplicate rejection deleted from `canBuild`. `src/game/perks.ts` applies the factor to each copy. `src/game/rules.ts:177-181` applies the diminishing extra-copy factor to multiplayer rent. Slot-specific upgrade/sell added to `Intent` and `server/world.ts` (build/upgrade/sellBuilding). UI text at `src/ui/ui.ts:932` now states the real rule.

## Y13 — jail release

**Root cause:** `src/game/rules.ts:70` had `jailFeeRate: 0.05` and `server/world.ts:881` computed from it; three UI titles repeated “5%”.

**Fix:** rate is `0.1`; the server function remains the only calculator and floors at `$50`; UI titles now say 10%. Unit test `tests/round11.test.ts` covers tiny and huge cash. Browser proof: $5,000 cash → “Pay $500 to get out”.

## Y12 — BUSTED circles

**Root cause:** `src/ui/ui.ts` appended `.busted-cuffs` with two child circles, and `src/ui/styles.css` drew and animated them.

**Fix:** DOM and CSS deleted, including the reduced-motion selector. Browser screenshot confirms bars/lights/vignette/word remain and no circles are present.

## Y8 — BUSTED appeared before the crime wheel

**Root cause:** `src/ui/ui.ts:2317` handled the server’s `jail` event immediately with `showBusted()`, while the failed robbery/murder also queued a chance wheel. The server emits the crime wheel first and the jail-sale wheel second, so BUSTED covered the first wheel and the result card could appear out of order.

**Fix:** `showOutcome()` and `showBusted()` now return promises. `queueChance()` accepts an `after` callback. A failed crime wheel awaits the wheel, then the result card, then BUSTED. A jail-sale wheel is queued through the same chain and BUSTED is suppressed within 5 s to avoid a duplicate. A direct non-chance jail still shows BUSTED immediately. `tests/e2e/round10.spec.ts` X6-X7 passed after the change.

**Still unproven:** the required 100 ms DOM/canvas audit for every chance event type, and the full IDLE→…→EFFECTS_APPLIED sequence.

## Y2 — sea, under-island clouds, size and watertight shell

**Root cause:** `src/board/island.ts` constructed a `PlaneGeometry(360,360)` sea at y = −18 and an `InstancedMesh` of 28 boxes at y ≈ −14, both below the island. The shell radius was 13.4 and the bottom ended in a duplicated tip ring, creating degenerate faces. Decorations sat at radius 8.6–11.8.

**Fix:** sea and cloud meshes/materials/functions deleted. Shell rings enlarged to 17.2/16.9/15.8/13.6/9.1/3.4/0.9; last ring is closed by a cap at y = −14.6 instead of a degenerate tip strip. Lawn 9.9→13.2, plaza 7.65→9.75. Detail group base scale 1.3 pushes props outward. No 24-view or topology audit was run.

## Y11 — campfire

**Root cause:** the fire was a single orange `BoxGeometry(0.6, 1.1, 0.6)` and only its Y scale moved.

**Fix:** `src/board/island.ts:273` now creates three additive flame billboards from a generated flame texture, a ground-only additive glow disc, and 18 capped spark points. Animation is in `IslandLayer.update()`; no real-time light is added. Day/night screenshots were **not** taken.

## Y5 — market candles and one-click trading

**Root cause:** `NetClient.requestMarket()` (`src/net/client.ts:225`) silently dropped the request when the socket was not yet open, and `openMarket()` requested once with no retry. The chart then stayed on “Waiting for server candles”. Separately, `submit()` required a second click unless the removed setting was enabled.

**Fix:** the market panel retries the request every 2 s up to three times and still uses the live `state.candles` fallback. `submit()` sends immediately; `Max Buy`/`Max Sell` send immediately. The `oneClickTrade` setting was removed from `Settings`, defaults and the settings sheet. **Not browser-proven after this change.**

## Y4 — obsolete generated-music path

**Root cause:** `scripts/generate-music.mjs` and `package.json`’s `music:generate` script remained as the provenance/generator path, although the runtime already streamed eight calm files.

**Fix:** generator deleted; package script, CREDITS, audio licence and audio audit no longer point at it. The eight CC0 Ogg/AAC masters remain. No chiptune or 8-bit runtime code remains; the SFX oscillator path is sound effects, not music.

## Y1 — initial load

**Root cause:** `src/board/textFit.ts` eagerly shipped `opentype.js` (451 kB of source) for tile labels, the entry bundle was 327.5 kB gzip, and the Node production server served the 933 kB JavaScript file with no content encoding. On Fast 3G the parse could not begin until the raw file had transferred, so the app did not start for 9.9 s.

**Fix:** tile fitting now measures the loaded `FontFace` through Canvas 2D; the test keeps real glyph metrics via an injected measurer. The production server negotiates gzip with `Vary: Accept-Encoding`. `scripts/check-load-budget.mjs` fails the build above 300 kB initial JS gzip. Result: 267.1 kB gzip, cold desktop 1.17 s, warm 1.02 s, Fast 3G 4.71 s. The 4× CPU + Fast 3G stress profile remains 12.08 s and is recorded as a limitation.

## Y3 — turn-order proof

**Root cause of the gap:** the turn pointer and 15 s bot watchdog existed, but no test exercised 200 games or a forced stalled turn. `tests/round11-turn-order.test.ts` now runs 200 seeded games on the human → bot ring, rejects every off-turn roll, and verifies the 20 s watchdog. No gameplay rule changed.

## Y8 — full chance audit

`tests/e2e/round11.spec.ts` now drives theft, robbery, murder, detective, wipe and jail chance events, records DOM insertion timestamps and the wheel state machine, and asserts exactly one overlay with result/BUSTED after `LANDED`. The jail duplicate-wheel path in `src/ui/ui.ts` was fixed: the generic chance queue owns the wheel, and the jail switch no longer enqueues a second one.

## Y11 — campfire proof

The close-up now targets the fire's world position (the detail group is scaled 1.3) and locks the rig so `clampPivot` cannot pull the shot back to the board. Day/night screenshots are real browser captures.

## Still not done

Y7 payback validation/simulation, Y9 rendered colour re-audit (the existing blocking material audit passes), Y10 device-local Continue, and Z1–Z7 beyond the recovery of Git metadata. Those are **not claimed** as complete.
