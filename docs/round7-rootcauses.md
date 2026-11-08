# Round 7 — root causes and fixes

This is a revision of the existing game. The server remains authoritative and the
licensed GLB assets stay. Every entry names the old broken code that was deleted,
not a second path left beside it. Proof lives in `docs/round7-proof/`.

Legend: **Verified** = observed in the running game / test run on this machine.
**Unverified** = code is in place but the proof was not run.

## U1 — 3D tile props read as player pieces

**Root cause.** Round 6 put GLB props on the tile tops (`BoardView` special-tile
models: train, lightbulb, faucet, chest, question mark, purse, ring). They used
the same silhouette language as the token models, so at the default camera the
board looked crowded with extra players.

**Fix.** `src/board/board.ts` no longer requests any special-tile model. Every
special tile is a flat canvas texture (SVG-style drawing) applied to the tile
surface: orange question mark, blue chest, tax, railroad, utility, GO, Jail,
Free Parking and Go To Jail. Names are drawn above the artwork and auto-fit to
the tile. Tick marks: raised tile/bevel/frame/centre props remain; the fountain
is removed (U17).

**Status. Verified** — `r7-tiles-north.png`, `r7-tiles-east.png`, `r7-tiles-south.png`
and `r7-tiles-west.png` show flat painted special-tile art with the name above the
symbol; no special-tile GLB is requested. Player-built structures are separate
U15 gameplay objects, not tile art.

## U2 — Multiplayer had no real accounts

**Root cause.** The socket `hello` accepted any display name and created a seat
from it. Sessions were ephemeral, there was no password, and the shared table
kept guest/bot-like seats from earlier tests.

**Fix.** `server/db.ts` stores accounts and hashed sessions in SQLite. Passwords
use bcrypt cost 11 and are never returned. `server/index.ts` exposes
`/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`,
rate-limits login attempts, and rejects an unauthenticated multiplayer `hello`.
`src/ui/ui.ts` adds the liquid-glass Log in / Create account screen with top
errors, case-insensitive unique 3–16 character usernames, and passwords ≥ 6.
`src/net/client.ts` sends the bearer token on the socket. A one-time purge
removes all legacy guest/bot seats and old test rows. Multiplayer never adds
bots; solo stays account-free.

**Status. Verified** — `auth.log`: register 201, duplicate 409, wrong password 401,
second login 200 for the same account, session 200, missing token 401, and no
password or hash in any payload. `/api/health` reports only account-backed
players; the shared world adds no bots.

## U3 — Looping drum-like sound

**Root cause.** The music bed scheduled an unpitched noise burst (the “shaker”)
on every eighth note at 120 BPM. It was part of the music loop, not an SFX, but
it sounded exactly like a looping drum and kept going while SFX was off. The SFX
bus also had no on/off gate at the source, and in-flight one-shots were not
tracked, so switching SFX off could leave a tail playing.

**Fix.** The shaker was deleted from `src/audio/audio.ts` (`musicNoise` and its
call are gone); music is now plucks and bass only. `AudioEngine.play`, `blip`
and `noise` return before creating any node when `sfxOn` is false.
`setSfxOn(false)` stops every tracked source immediately. Music has its own
toggle and own bus. The saved switches are applied in `src/main.ts` before the
first gesture unlocks audio.

**Status. Verified** — `audio-10min.log`: **600 s** with SFX off, `buffers=0`,
2,888 music oscillators created, 2,888 stopped and no page errors. The separate
`audio-toggle.log` records one roll creating one buffer and switching SFX off
stopping the in-flight source. `audio-music-toggle.log` records an oscillator
delta of 0 over 5 s after Music was switched off, with 0 SFX buffers.

## U4 — Follow camera too far away and off-centre

**Root cause.** The follow path reused the wide default orbit radius and only
lerped position, so the acting piece stayed small and the framing target was
shared with the board overview.

**Fix.** `src/config.ts` owns the CameraRig constants: pitch 46°, follow radius
8.8, minimum radius 7.2. `SceneRig.follow()` damps toward a centred target at
the tight radius; the Round 6 sequence (dice → zoom → follow → land → 1 s →
zoom out → prompt) is untouched.

**Status. Verified** — `r7-follow-camera.png` shows the acting piece centred with
the board tight in frame; the pitch is 46° and the follow radius is 8.8.

## U5 — Buy prompt and Properties tab used different cards

**Root cause.** The buy prompt built an ad-hoc tile sheet with price and rent
only; the Properties tab built a second, different summary. There was no shared
component, so the two drifted.

**Fix.** `src/ui/ui.ts` has one `propertyCard()` and one `propertyActions()`
used by the buy prompt, the tile sheet and the Properties tab. The card has the
colour band, name, full rent ladder, build cost, mortgage value, price, owner,
buildings and mortgaged status; actions render below the same card.

**Status. Verified** — `after-proof.log` records `cards_identical true` for St.
Charles Place in the Properties tab and the tile sheet;
`r7-properties-card.png` and `r7-tile-card.png` show the shared card.

## U6 — Bank theft was a fixed $150–$600 with fixed odds

**Root cause.** The old `theft` intent targeted `'bank'` and rolled a fixed
55% chance for a random $150–$600. The amount and odds were server constants,
not player choices, and the UI had no warning screen.

**Fix.** `robbery` is a separate server intent. `robberyChance(amount)` is a
straight line from 20% at $50,000 to 5% at $100,000; the UI slider uses the same
function and shows live odds, and the warning screen states the amount,
percentage and jail consequences. The server validates the amount, rolls the
same percentage and records the result in the chance wheel. The old bank branch
was removed from `theft`.

**Status. Verified** — `robbery-1000.log`: $50,000 won 220/1000 (22%), $100,000
won 52/1000 (5.2%). `r7-robbery-min.png`, `r7-robbery-max.png` and
`r7-robbery-warning.png` show the slider ends, live odds and warning.

## U7 — Owner sign included the piece image

**Root cause.** The owner sign texture drew the owner’s token silhouette beside
the name, so the sign was both crowded and confusable with a piece.

**Fix.** `src/board/board.ts` draws only the owner colour and username on the
same-size sign, with the tile-text auto-fit routine filling the sign. The
pop-in and no-overlap rules are kept.

**Status. Verified** — `r7-owner-sign-short.png` shows `bob` as one large line;
`r7-owner-sign-long.png` and `r7-owner-sign-long-crop.png` show the 15-character
name as two large lines, both filling the plaque without clipping. The owner
plaque hides while the larger MORTGAGED plaque occupies the same edge.

## U8 — Minimum zoom too far out

**Root cause.** The orbit clamp reused the old wide minimum radius and a near
plane tuned for the overview, so close inspection was impossible.

**Fix.** `CAMERA.minRadius` is 7.2 and `CAMERA.near` is 0.06; wheel zoom targets
the cursor point and damps. Clipping protection stays at the near plane and
minimum radius.

**Status. Verified** — `r7-zoom-closest.png` shows the closest orbit with no
clipping; the wheel target follows the cursor point in `CameraRig.zoom()`.

## U9 — Stretched, repeating city

**Root cause.** `src/render/city.ts` multiplied `scale.y` by a height variant and
widened tall ids with `scale.x/z *= 1.7`; the skyline widened every model by
2.2. That is non-uniform scaling, so the kits looked stretched. Building ids
came from a short repeating list, roofs shared one material, and the four side
middles used the sparse repeat rows.

**Fix.** `placeBuilding` now receives a model id and never touches scale; variety
comes from the 32 licensed models. `decorate` deterministically tints wall
materials, tints the highest mesh as a roof from a six-colour palette, and adds a
loaded rooftop prop (barrel, crate, satellite or tree) — no primitive geometry,
so the no-handmade-models check stays green. `cityPlan.ts` uses a fixed seed and
dense slots for all four sides. Skyline ranks use one uniform size per rank and a
mixed model palette.

**Status. Visuals Verified; 60 FPS not demonstrated** — eight 45° views are in
`r7-city-*.png` with `r7-city-contact.jpg`. `city.log` reports requested 990,
loaded 990, failed 0, 3097 meshes and 0 non-uniform meshes. A headed Chromium
run at 1280×800 measured **58.3 FPS average** over 174 frames (p95 26.7 ms,
45 frames over 20 ms, 3 over 33 ms) with 0 errors in `perf-headed.log`. That is
close to, but not a verified, 60 FPS; the headless sample produced only one
frame and is not usable evidence.

## U10 — Underworld actions leaked into the public log

**Root cause.** Theft, robbery, murder and detective outcomes called the shared
`logLine`, which is the public feed. Result data existed only inside the chance
event, so there was no dedicated outcome screen.

**Fix.** Successful underworld outcomes are recorded only in the player’s
private history; `sendToJail` publishes the full jail record. `GameEvent.outcome`
carries amount, target, reputation delta and detail, and `UI.showOutcome()`
renders a success/failure result screen. The Detective tab is a separate bottom
tab with target picker, $10,000 fee, odds, hire and findings list.

**Status. Verified** — `r7-robbery-result.png` shows the failure result screen;
`r7-theft-success.png` shows the success result screen from a real theft.
`jail-record.log` plus `r7-log-after-robbery.png` show the full settled jail
record. After the successful theft, `theft-bank.log` records
`publicLogLeaked: false` on the Main log.

## U11 — Board glow during the day cycle

**Root cause.** The renderer built an `UnrealBloomPass` and the board materials
used emissive highlights; the day cycle changed scene lighting that also hit the
board, so the board brightened and bloomed with the sky.

**Fix.** The composer/bloom pass is deleted. Board, tile, frame and token
materials have no emissive contribution. The day/night cycle only moves the sky
dome and city window emissive; the board keeps one constant light rig.

**Status. Verified** — sunrise, noon, sunset and night screenshots are in
`r7-sky-*.png`; `sky-board-diff.log` reports a board-mask mean difference of
about 0.004–0.008/255, leaving only idle piece motion.

## U12 — No player logs or market feed

**Root cause.** The server had one public log and no per-recipient filtering or
price history.

**Fix.** `PublicState.playerLogs` holds server-filtered, timestamped per-player
entries; `marketFeed` holds symbol, old/new price, percent, direction and time.
The UI Log sheet has Main log / Player logs / Market feed sub-tabs. A player’s
own trades are written to their player log. Private reputation and other
players’ detective findings never enter another viewer’s log.

**Status. Verified** — `r7-log-main.png`, `r7-log-players.png`,
`r7-log-player-detail.png` and `r7-log-market.png` show the Main log, per-player
filtered logs with timestamps, and the Market feed in separate tabs.

## U13 — Messages appeared behind panels

**Root cause.** Each panel owned its own error element inside its own stacking
context, so a sheet or the chance wheel covered the message.

**Fix.** One `#toast-layer` at `z-index: 600` above every sheet, modal and wheel;
`UI.toast()` is the only path for errors, warnings and confirmations, and
messages carry a reason. Loan errors quote the live limit and the requested
amount.

**Status. Verified** — `panels-proof.log` records the toast layer at z-index 600
over a sheet at z-index 60; `r7-bank-error-on-top.png` shows the exact loan error
above the open Bank sheet.

## U14 — Loan limit was too low and fixed

**Root cause.** The loan cap was a small fixed multiple of cash, not net worth,
and the Bank panel did not show it.

**Fix.** `loanCap(netWorth) = max(10_000, 3 × net worth)` is recalculated live
from cash + deed values + buildings. The Bank panel and every loan error show
the current limit. 2% interest per turn is unchanged.

**Status. Verified** — `r7-bank-limit.png` shows the $10,000 floor on a low-net-worth
account and `r7-bank-error-on-top.png` repeats it in the rejected-loan reason.
After `amy` gained cash, `r7-bank-limit-live.png` and `theft-bank.log` show the
limit at **$17,650**, above the floor, with `max(10_000, 3 × net worth)` in code
and 2% interest unchanged.

## U15 — Multiplayer building required the full group and had few types

**Root cause.** `canBuild` always required a full colour group, and the build UI
offered a handful of hardcoded types with no data-driven costs or previews.

**Fix.** `canBuild` takes the mode: multiplayer allows any owned street, solo
keeps full-group houses/hotels. `BUILDING_CATALOG` in `src/game/buildings.ts` has
32 types in categories, each with cost/rent multiple/blurb and aone-to-one model id. The build sheet is a category grid with model preview, cost, income
and a Build button; one slot per tile, 50% refund on replacement, the existing
60-building cap, and group synergy only for a full group. Every model is in the
manifest and `CREDITS.md`. `BuildingLayer` now loads
`BUILDING_META[type].model` rather than passing the type key to the manifest;
the old mismatch made non-house buildings disappear silently. Load failures are
logged instead of swallowed.

**Status. Verified** — `r7-build-grid.png` shows the seven-category sheet and the
run logged 32 build buttons. On `Mediterranean Ave`, `amy` owned one street with
no full group and built a Corner Shop (`r7-build-single-street.png`,
`r7-build-single-street-card.png`). After the model-id fix,
`r7-build-single-street-model.png` shows the loaded GLB and the scene reports one
building child with no errors. The 60-building performance cap was not
load-tested; that performance item remains Unverified.

## U17 — Bad centre fountain

**Root cause.** The centre used a fountain GLB that did not fit the Monopoly Go
style and dominated the empty field.

**Fix.** The fountain request and its placement function were deleted from
`src/board/board.ts`; the centre keeps only the flat field and existing
non-fountain props.

**Status. Verified** — `r7-board-default.png` shows the centre field with no
fountain; the fountain code is absent from `src/board/board.ts`.

## Final checks (2026-11-08)

`docs/round7-proof/final-checks.log` records the final source state after the last
BuildingLayer fix:

- `npm test`: **226/226 passed** in 7 files, including the 1,000-roll robbery test.
- `npm run build`: passed the no-handmade-models check, `tsc --noEmit`, Vite and
the server bundle.
- `npm run typecheck`: passed independently after the owner-sign and
BuildingLayer changes.

Open limitations, stated rather than inferred:

- **U9 — 60 FPS:** the city looks varied and complete in eight views. The headed
  GPU run measured **58.3 FPS average at 1280×800** (p95 26.7 ms, 45 long frames
  over 20 ms, 3 over 33 ms). This is not claimed as a 60 FPS pass.
- **U15 — 60-building cap:** the 32-type sheet and a real single-street build are
  verified; the cap exists in rules and tests, but a 60-structure load test was
  not run.
- **U1 interpretation:** special-tile art is flat and model-free; a player-built
  structure is a separate U15 gameplay object on the owned tile.
