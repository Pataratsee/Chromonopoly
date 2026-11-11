# Round 10 root causes and dispositions

Verified against the built app in Chromium on 10 November 2026. Evidence is in
`docs/round10-proof/`; the practical limits of that evidence are stated in its
README.

## X1 Performance

Root cause: the original loop had no frame budget or throttled-CPU measurement,
and the island rebuilt per-frame detail. The scene now uses instanced foliage,
one group transform for zoom travel, on-demand HUD work and a Low preset.

Measured result: Low quality at 1280×720 under 4× CDP CPU throttling for 45 s
produced **4.92 FPS average**, **216.7 ms p95**, 222 frames, 447 draw calls and
38,483 triangles. **The 30 FPS target is not met** in this headless
software-WebGL environment. The older Round 9 table reported identical 75 FPS
under every throttle level; it is retained as historical output but is not used
as Round 10 evidence. No physical Chromebook measurement was possible.

## X2 Island

Root cause: the cliff had no bottom cap and decorations were hidden at distance.
The rock is now a closed volume with top and bottom caps, the plaza is flat, and
all island decorations stay visible with distance scaling. Seven real-browser
views (four orbit angles, below, default, maximum zoom) were captured and
inspected. **Verified.**

## X3 Camera follow

Root cause: `track()` clamped the pivot to a board-centred radius after every
update. `lockOn()` bypasses only that clamp while a piece is moving. The browser
trace records `IDLE → DICE_ROLLING → DICE_SETTLED → CAMERA_ZOOM_IN →
PIECE_MOVING → PIECE_LANDED → CAMERA_ZOOM_OUT`, with moving and landed
screenshots. **Verified.**

## X4 Bots

Root cause: bots acted immediately on the server. Bot turns now use scheduled
pacing with a visible thinking state and named personality. The proof captured
Mr. Ledger (`cautious`) with “is thinking” and 28 timestamped bot log entries
over the observation window. **Verified in a solo browser session.**

## X5 Market

Root cause: the client drew one DOM row and an SVG sparkline per stock. One
canvas chart now consumes server candle history. The live browser capture saw
28 selectable options, exactly one terminal and one chart, with a changing server
price. **Verified.**

## X6 Busted

Root cause: there was no arrest presentation. A CSS-only BUSTED overlay now runs
on jail events, not releases, is skippable after one second, and respects reduced
motion. The real arrest screenshot and text/ARIA evidence were captured with the
jail-sale wheel isolated from the presentation test. **Verified.**

## X7 Jail release

Root cause: the release price used the old mortgage total. It is now
`max($50, round(cash × 5%))`, recomputed by the server. The browser showed
**“Pay $250 to get out”**, title “5% of cash, minimum $50”; clicking it released
the player. **Verified.**

## X8 Live upgrade costs

Root cause: upgrade prices were computed only when the deed sheet was built. The
sheet now refreshes the button in place from server state. Browser evidence:
`$150 → $450` after one upgrade, then disabled with title “Need $450” after cash
was reduced. **Verified.**

## X9 Building perks

Root cause: buildings had no perk data. The catalogue now supplies perk,
trade-off and fitting model data for build cards. The solo browser sheet rendered
House and Hotel cards with their Perk text; solo intentionally exposes only those
two types. **Verified.**

## X10 Model colour audit

Root cause: no automated material audit existed. `scripts/audit-model-colors.ts`
now inspects the binary GLBs and fails the build on flat white/grey or untextured
materials. Result: **136 GLBs, 413 primitives, 186 material uses, 0 failures**.
Both real contact sheets were rendered from the asset loader: 104 pieces/props
and 32 buildings, and visually checked. **Verified.**

## X11 Court

Root cause: odds and fees were fixed and the filing flow was not exercised
end-to-end. The court sheet now shows evidence, odds, claim range, escalating
filing fee and payout. The two-client browser run filed a real case and the
reopened sheet showed “Open cases … v. … · awaiting defendant”, with both clients
reporting no console or network errors. **Verified.**

## X12 Music

Root cause: six runtime-synthesised chiptune arrangements. The game now ships
eight original CC0 instrumental recordings, each 2–4 minutes, streamed as Opus
with an AAC fallback. Browser evidence reports all eight tracks, `Dawn Ledger`
playing from `/audio/dawn-ledger.ogg`, and the CC0 licence with eight SHA-256
checksums. Shuffle, no-repeat deck, 2.2 s crossfade, volume buses and court
ducking are implemented. Subjective listening was **not** auditioned in the
headless environment.

## X13 Server speed and reliability

Root cause: full-state broadcasts, no delta dedupe, no backpressure and no
health/restart proof. The server now sends one recursive delta per world per
tick with `__replace` removals, per-client backpressure, heartbeat/pong, health
metrics, structured logs, compression, rate limiting, graceful shutdown and
idempotent intents. The client applies deltas, resyncs after gaps, reconnects
with jittered backoff and queues intents.

The 600-second soak sent 12,000 real intents from 100 clients, forced five
socket drops and restarted the server at halfway. **100/100 clients connected,
100/100 seats recovered, 5/5 dropped sockets reconnected, the restart recovered
in 1.96 s, 0 updates were dropped, the delta ratio was 99.65%, and the
action-handler p95 was 0.03 ms.** The reconnect pass also found and fixed a real
server bug: a solo socket could not reclaim its own seat because `join()`
checked only the multiplayer player token, not the saved solo session.

The latency target is **not met end to end**: steady-state ping p95 was 270 ms
and server tick p95 was 423 ms at 100 independent solo tables, both above the
150 ms target. The raw result is `docs/round10-proof/soak-100.json`.

## X14 GitHub

No new commit, tag or push was requested or performed in this pass. The existing
remote and the earlier Round 10 tag are unchanged.
