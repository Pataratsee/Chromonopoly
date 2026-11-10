# Round 10 root causes and dispositions

## X1 Performance
Root cause: the island rebuilt per-frame matrices for every petal and hid all detail beyond 31 m; no frame-time budget or on-demand rendering existed. This pass replaces 90 petals with 48 instanced leaves updated at 18 Hz, removes the extra Japanese geometry, and keeps one group transform for zoom push. The FPS overlay already existed. **Unverified**: the required Low + 4x CPU 5-minute profile and 30 FPS Chromebook result were not measured in this session.

## X2 Island
Root cause: the cliff had no bottom cap and the top shell was not a closed volume; decorations were hidden when the camera was far. Now the rock is a closed side strip with top and bottom caps, opaque materials, a flat plaza at y=-0.34, and all decorations remain visible and scale outward by up to 15%. Japanese props, mountain silhouettes and petals are deleted. Thanksgiving/fall geometry is procedural. **Unverified**: four-angle/below screenshots and asset-license replacements.

## X3 Camera follow
Root cause: `track()` clamped the camera pivot to a 1.25 m board-centred radius after every update, so a piece on an edge tile could never be centred. `lockOn()` now bypasses only that pivot clamp while PIECE_MOVING; focus/orbit/zoom/reset keep the Round 9 W7 clamps. Human and bot sequences use `lockOn`. Camera tests pass. **Unverified**: live browser frame-by-frame run.

## X4 Bots
Root cause: bot decisions were executed immediately on the server. The zero-cash jail auto-roll was also missing. The server now schedules the existing bot pacing and the client keeps Fast bot turns; the UI shows bot names. Server turn scheduling is still the authority, so a bot cannot exceed the safe turn length. **Unverified**: 3-bot full-round human-pacing measurement.

## X5 Market
Root cause: the old client drew one DOM row and an SVG sparkline per stock, with no server candles. New `CandleChart` draws one canvas; the server stores 520 deterministic 30-second candles and sends history on request. The old list and My Holdings tab are deleted. Max Buy uses fee-inclusive floor maths. **Unverified**: 1280x720/1920x1080 FPS and two-client candle comparison.

## X6 Busted
Root cause: no arrest presentation existed. A CSS-only overlay now runs on jail events (not releases/roll notices), shows the player or bot name, is skippable after 1 s, and has a reduced-motion fade. **Unverified**: every arrest cause in a browser.

## X7 Jail release
Root cause: the release price was the old mortgage total, not current cash. It is now server-computed `max($50, round(cash * 5%))`, recalculated in every private state. A jailed player below $50 rolls automatically after 1.6 s and does not lose jail turns. Pay button shows the exact cost and is disabled with a reason. Tests updated and passing.

## X8 Live upgrade costs
Root cause: upgrade prices were computed only when the deed sheet was built. They are derived from server state on every redraw and shown on the button. **Unverified**: browser test after multiple upgrades/inflation changes.

## X9 Building perks
Root cause: only 32 types and no perk data. The catalog now contains 61 types with cost, rent, perk key/value, blurb, trade-off and fitting model, aggregated by `src/game/perks.ts` on the server and shown on build cards. Formulas are in `docs/building-perks.md`. **Unverified**: full balance simulation.

## X10 Model color audit
Root cause: no automated material audit. Not implemented in this pass: `scripts/audit-model-colors.ts` and contact sheets remain **Unverified / not delivered**.

## X11 Court
Root cause: odds were fixed and fees were flat; no withdrawal. Odds now use the data curve 10% → 95%, fee starts at $10,000, doubles after a loss, resets on a win, and withdrawal refunds 50%. The filing sheet shows evidence, chance, range, fee and potential payout; the existing wheel uses the same server percent. **Unverified**: full concurrent-suit browser run.

## X12 Music
Root cause: six synthesized chiptune arrangements. Not replaced in this pass. **Not delivered**: eight licensed calm tracks, licenses, compression and lazy loading.

## X13 Server speed and reliability
Root cause: full-state broadcasts, no delta/dedupe, and no health/restart proof. The client has reconnect backoff, sequence resync and intent keys; this pass did not implement delta frames, backpressure, health checks or the 100-client soak. **Not delivered**.

## X14 GitHub
Pushed this round's changes with the existing remote. Verification output is in the final report.
