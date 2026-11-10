# Round 9 root causes and status

Executed on 2026-11-09 from `/home/christian/Desktop/LittleProjects/Chromonopoly 3.0`.

Status labels:

- **Verified in browser** — exercised by Playwright in the running game, with the proof path listed.
- **Verified server/unit** — covered by `tests/round9.test.ts`, `tests/world.test.ts` or `tests/camera.test.ts` only.
- **Unverified** — implemented but not proven in the requested environment.

No item below is called browser-verified unless the corresponding Playwright test actually ran and
passed. The latest consolidated logs are `docs/round9-proof/playwright-final-a.log`,
`playwright-final-b.log` and `playwright-final-c.log`.

## W1 — accounts removed, username-only seats

Root cause: identity lived in `auth_accounts`/`auth_sessions` and the client kept a bearer session
token separate from the board seat. The board also had one name per connection and no offline
lifecycle.

Change:

- Removed the auth tables, bcrypt imports/routes and the client session API. `server/db.ts` drops
  the old tables.
- Shared name normalization and offensive-word filter in `src/game/username.ts`.
- The server stores a SHA-256 hash of a 256-bit browser secret per name. The matching token reclaims
  the seat and its data; a missing or wrong token is rejected.
- A name stays reserved while online, holding cash or a loan, or owning a deed.
- An hourly sweep sells the cheapest deed per offline hour, refunds buildings at 50%, writes the
  player's private log and catches up on reconnect.

Evidence:

- Unit: duplicate/wrong-token/right-token reclaim, release, five-hour offline catch-up and a payload
  audit that no token or token hash is broadcast (`tests/round9.test.ts`).
- Browser: `W1` in `tests/e2e/round9.spec.ts`. Two clients, duplicate-name toast, forced WebSocket
  close with automatic same-seat reconnect at the same $2,345, then a second browser reclaiming the
  seat with the saved token. Proof: `w1-username-seat.png`, `w1-duplicate-name-toast.png`,
  `w1-reconnect-same-seat.png`, `w1-second-browser-reclaim.png`.

Unverified: reconnect across a server restart, the elapsed-time offline sale in a browser, and
iOS/Safari storage behaviour.

## W2 — preview corner labels

Root cause: the four corner badges were fixed-position labels without a narrow-viewport width or
safe-area rule. At 760 px the text could exceed the available preview box and collide.

Change: frosted badges with constrained width, clamped text and corner insets that stay inside the
live 3D preview at every supported size and theme.

Evidence: browser `W2` measures all four label rectangles at 1280×720, 1920×1080, 2560×1440,
760×900 and dark 1280×720, asserting every label stays inside the preview and no pair overlaps.
Proof: `w2-menu-0-1280x720.png` through `w2-menu-4-dark-1280x720.png`, plus
`w2-menu-3-narrow-760-preview.png`.

## W3 — no repeat borrowing

Root cause: the panel recomputed a borrowing cap from the current loan and the server accepted a
second principal that still fit the cap, so reopening the panel offered another loan.

Change: the server rejects any new principal while `loan > 0` with `Repay your current loan first.`;
full repayment unlocks the next loan. The panel disables Borrow and shows the reason.

Evidence:

- Unit: first loan accepted, second rejected with that exact reason, repayment then a new loan
  accepted (`tests/round9.test.ts`).
- Browser: `W3/W6` borrows once, reopens Bank, sees the disabled button and warning, then sends a
  direct second-loan intent and sees the global rejection toast. Proof: `w6-bank-cash-and-toast.png`.

## W4 — Japanese island

Root cause: the board scene still used the old city backdrop (ring road, wall of buildings, traffic,
street furniture), which dominated the triangle and draw-call budget and read as a city rather than
the requested floating island.

Change: the city backdrop was removed from the board scene and replaced by a procedural low-poly
floating Japanese island in `src/board/island.ts` — rock underside, sea, clouds, torii, pagoda,
cherry trees, pond and bridge, stone lanterns and paths. The 32 licensed building models that remain
in the manifest are gameplay buildings placed on deeds, not a city backdrop. The build-time asset
check confirms 100 licensed token models, 32 licensed building models and no primitive stand-ins
outside `src/board` and `src/ui`.

Evidence: browser `W4` renders four orbit angles plus default and closest zoom, audits the island at
4,392 triangles (58 detail meshes, 90 petals), and records the full Low frame at 39,178 triangles and
453 draw calls. Proof: `w4-island-default.png`, `w4-island-closest.png`,
`w4-island-angle-0.png` … `w4-island-angle-3.png`, `w4-island-triangles.json`.

## W5 — chance result only after the wheel stops

Root cause: the result text was populated when the server event arrived, which could happen while
the wheel was still spinning or before the pointer had settled. There was no explicit state machine
or DOM evidence of ordering.

Change: `src/game/wheel.ts` implements `IDLE → READY → SPINNING → LANDED → RESULT_SHOWN → CLOSED`.
The dial stops completely at `LANDED`; the result and Continue button appear only after a further
1,000 ms dwell; `CLOSED` removes the overlay.

Evidence: browser `W5` samples the DOM every 100 ms and records state transitions. The recorded run
is `IDLE 4638.4 ms`, `READY 4638.5`, `SPINNING 7833.4`, `LANDED 14884.4`, `RESULT_SHOWN 16316.9`
(1,432.5 ms after landing). The 35 samples include five LANDED and seven RESULT_SHOWN frames. Every
SPINNING/LANDED sample still reads “Spin to reveal”, with no good/bad styling and no Continue button;
every RESULT_SHOWN sample is revealed and styled. The test then clicks Continue and asserts the
overlay is gone. Proof: `w5-wheel-landed-before-result.png`, `w5-wheel-result-after-stop.png`,
`w5-wheel-100ms.json`.

## W6 — cash chips and one global error/warning toast

Root cause: spending panels did not consistently show the player's cash, and the toast layer could
sit underneath a sheet, so a rejection could be hidden by the panel that caused it.

Change: every spending panel and confirmation sheet uses the same live `.sheet-cash` chip (Bank,
Market, Properties, build, pending rent/purchase). Rejections go through one `.toast-layer` above all
sheets; the test asserts the computed toast z-index is greater than the sheet z-index.

Evidence: browser `W3/W6` checks the chip at the Bank, Market, Properties and pending-rent panels,
and captures a global duplicate-loan rejection while the Bank sheet is open. Proof:
`w6-bank-cash-and-toast.png`, `w6-market-cash.png`, `w6-build-cash.png`,
`w6-pending-cash.png`.

## W7 — camera pivot safety and zoom

Root cause: orbit/zoom could move the pivot, pinch and wheel input used inconsistent scaling, and a
resize could leave the camera looking outside the board. Zoom was also able to change the target
point instead of only the distance.

Change: zoom changes distance only; the orbit pivot is clamped to a 1.25-unit board radius; drag,
wheel, pinch and resize share the same clamp. `tests/camera.test.ts` runs 1,000 randomized
orbit/zoom/snap/focus/follow sequences and asserts the pivot never leaves the radius.

Evidence: unit suite 247/247 including the 1,000-sequence camera test; browser `W7` performs a live
drag, wheel zoom and viewport resize, checks the pivot after each, and captures the resized frame.
Proof: `w7-camera-resize.png`.

## W8 — multiple buildings and ranks

Root cause: `TileState.building` was a single scalar, so a second build replaced the first and rank
had nowhere to live.

Change: `TileState.buildings: Building[]` with independent `type` and `rank`. Slots scale 2/3/4 by
list price; upgrades cost 3×/9×/27× the base build cost; selling refunds 50% of invested value. The
server rejects a full deed, duplicate type and concurrent exhaustion. The 3D layer renders one model
per building at a uniform rank scale; the Properties panel lists each type and rank and offers
upgrade/sell.

Evidence:

- Unit: four different types on a four-slot deed, a fifth rejected, house upgraded to rank 2 while
  office stays rank 1; slot and upgrade-cost assertions (`tests/round9.test.ts`).
- Browser: the live multiplayer deed in `W9/W10/W11/W12` shows `House rank 1` and `1/2 SLOTS` in the
  Properties panel with the rank included in the rent example. Proof: `w9-rent-example.png`.

Unverified in browser: four buildings simultaneously visible at mixed ranks, and the visual
readability of every rank on the board. Those exist in the renderer and are unit-covered, but no
screenshot isolates them.

## W9 — payer-cash rent

Root cause: `rentFor` returned the fixed printed table value and ignored who was paying.

Change: `multiplayerRent` uses the highest rank (1%, 5%, 10%, 40%), +10% of the percentage per
additional building, +25% per additional rank-4 building, a $10 floor and no cap. The server computes
it at landing from the payer's authoritative liquid cash. Formula and worked examples:
`docs/rent-formula.md`.

Evidence:

- Unit: rank 1 = $10,000 and rank 4 = $400,000 at a $1,000,000 payer; two rank-4 buildings = 55% /
  $550,000; empty-deed and minimum cases.
- Browser: live multiplayer cash $19,950 and a rank-1 house; the Properties example reads “highest
  rank 1”, “At your $19,950” and “$199 (1.00%)”. `19,950 × 1%` floors to 199. Proof:
  `w9-rent-example.png`.

## W10 — murder transfers property

Root cause: the success branch cleared every victim deed to the bank and discarded the buildings.

Change: on success the victim is hospitalized for 3 turns with $0 cash, loans cancelled and stocks
cleared; all deeds and buildings transfer to the murderer with ranks intact. The private result lists
the taken property names; the public hospital state makes the loss visible to the victim.

Evidence:

- Unit: `tests/world.test.ts` covers the transfer, victim hospitalization and cleared holdings.
- Browser `W9/W10/W11/W12`: the confirmation sheet states “every deed and building transfers to
  you” and “Hospital 3 turns · $0 cash”; the 5% server wheel is spun to a forced success; the result
  reads “Success”, “You took 3 properties”, lists Oriental Ave, Vermont Ave and Connecticut Ave, and
  shows reputation −45. The public state then reports the murderer as owner of tile 6. Proof:
  `w10-murder-transfer-warning.png`, `w10-murder-wheel.png`, `w10-murder-transfer-result.png`.

## W11 — record wipe

Root cause: no server action existed, so there was no atomic way to erase private/public records.

Change: $500,000 fee and a 15% server roll. Success clears private acts, jail record, unpaid-rent
record and other players' dossier findings, dismisses open suits, and resets reputation to 50;
failure keeps the records and loses the fee. The event is private to the payer. The UI requires an
explicit confirmation sheet before the wheel. The result card now uses its own `wipe` outcome kind
and reads “Record wipe” (it previously reused the detective kind and was mislabeled “Detective
report”).

Evidence:

- Server/unit: `tests/world.test.ts` covers success/failure and the private audience.
- Browser `W9/W10/W11/W12`: confirmation sheet states the $500,000 fee and 15%; the wheel has
  `data-chance="15"`; after LANDED/RESULT_SHOWN and Continue, the result reads “Record wipe”,
  “Success”, “Your private and public records are gone”, “Lost $500,000” and reputation +50. The
  Reputation panel then shows “No crimes or evasions recorded”. Proof: `w11-wipe-confirm.png`,
  `w11-wipe-wheel.png`, `w11-wipe-success.png`.

## W12 — stock market balance

Root cause: tick drift was strongly positive and trading had no fee or spread, so random buying was
profitable.

Change: `stockDrift -0.002`, `stockNoise 0.05`, `stockFee 0.005`, `stockSpread 0.005`, with a
per-tick clamp and daily rise cap. Purchases, builds and upgrades bump the affected share price.

Evidence: the 10,000-player, 16-tick simulation using the real `nextPrice`, `fundamental`, fee and
spread produced a median −3.87%, 34.78% profitable, 19.36% above +5%, 0.53% above +25%, best
+41.38% and worst −33.04%. Details: `docs/market-balance.md`; raw output
`docs/round9-proof/market-sim.json`.

Browser `W9/W10/W11/W12` opens Market, asserts 28 rows and the net summary, waits for a live price
change and captures it. Proof: `w12-live-market.png`.

## W13 — readable bot turns

Root cause: bots resolved entirely on the server between state pushes, so the human saw the result
without the dice, the piece movement, a landing beat, the camera return or the tile prompt.

Change: bot turns are presented through a sequential queue. The client shows dice, follows the
actual token, pauses 900 ms on landing, zooms back out, then releases buffered card/purchase/rent/turn
events. The queue never runs two rivals at once.

A related movement bug surfaced in the consolidated run: `sync()` could retarget a token while its
current hop was still in flight, and `land()` then snapped to the stale tile and logged a false
“piece did not land on its logic tile center” console error. `land()` now queues the remaining path
to the authoritative target before evaluating the landing. W13 then passed three consecutive
browser runs with a clean console (`playwright-w13-repeat.log`).

Evidence: browser `W13` with fast bots off records roll `1+6=7`, follow `tile 0→7`, landing on
Chance, a 900 ms pause, zoom-out, then the buffered card “Bank pays you a dividend of $50.”; the
ribbon reads “Chance / Mr. Ledger · Bank pays you a dividend of $50.” Proof: `w13-bot-turn.png`,
`w13-bot-log.json`.

## Live deployment migration — 2026-11-10

Root cause: Render restored the shared world saved by Round 8. Round 8 tiles stored a single
`building: BuildingType | null`; Round 9 reads `buildings: Building[]`. `World.restore()` called
`groupBuildingCount()` before any migration, so startup threw
`TypeError: Cannot read properties of undefined (reading 'length')` and exited 1 before the service
could listen. The same save also contained human seats with no Round 9 reclaim token, so those
seats could not be reopened.

Change: `restoreTile()` converts a legacy building flag to one rank-1 building and defaults the
missing tile fields. Restore fills every board index, marks restored seats offline and lets the
first token-bearing join claim a legacy seat. Regression: `tests/world.test.ts` — “restores a Round
8 building flag and lets its seat be claimed”.

Evidence: Render build `94dfbfb` failed with the startup error above. Build `d113086` deployed
successfully; live health reports `version:"d113086…"`, `protocol:3` and the restored players. The
live Pages client loaded, started a solo table, rolled `2 + 3`, advanced to Mr. Ledger's turn and
produced no console errors. Details: `docs/round9-proof/live-deployment.md`.

## Verification actually run

- `npm run typecheck` — pass.
- `npx vitest run` — 12 files, 248/248 tests pass after the save-migration test.
- `npm run build` — pass; model check, TypeScript, Vite and server bundle. Client 1,100.99 kB
  (319.35 kB gzip), CSS 47.68 kB (10.86 kB gzip), server 242.1 kb.
- Playwright Round 9 — eight browser scenarios across three grouped runs; see
  `docs/round9-proof/verification.md` for the command/log table and proof index.
- 10,000-player market simulation — pass, final distribution above.
- Low-quality performance harness — 75 FPS average, 13.33 ms average frame, 13.4 ms p95, no frame
  over 20 ms at 1280×720, including 4× CPU and 2× GPU workload runs; cold cache-disabled load 705 ms.
  See `docs/perf-report.md`.

Not run: a full Playwright replay after the live save-migration hotfix, a physical low-end device,
iOS/Safari, offline-sale browser elapsed-time test, server-restart reconnect, a browser screenshot
isolating four simultaneous mixed-rank buildings, or a live multiplayer smoke test after the
migration. Commit, push and deployment were performed; see
`docs/round9-proof/live-deployment.md`.
