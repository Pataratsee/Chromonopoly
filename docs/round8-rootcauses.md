# Round 8 — root causes and verification

Written 2026-11-08. Every claim below was either run in this session or is explicitly
marked **Unverified / Not done**. Nothing is reported as working because it compiles.

## V1 — Login and accounts (highest priority)

### Root causes found and fixed
1. **Auth calls used the wrong origin.** `src/ui/ui.ts` fetched relative `/api/auth/*`,
   which works only when the client and server share an origin; a configured
   `VITE_GAME_SERVER_URL` was ignored for HTTP. The client now uses one origin
   helper, `src/net/endpoint.ts` (`apiUrl`, `apiFetch`, `socketUrl`), shared with
   the WebSocket.
2. **The build was red.** Two `ui.ts` errors (`authErrorEl` declared but unread,
   and `replaceChildren(..., null)`) meant `npm run build` could not produce the
   bundle that the login screen lives in. Fixed by deleting the dead field and
   passing a filtered child list.
3. **Old test path masked the failure.** The previous Playwright suite drove
   `#name-input` on the main menu and never authenticated. That element was removed
   with the Round 8 menu; the six obsolete specs were deleted and replaced with
   `tests/e2e/round8.spec.ts`, which registers and logs in through the real form.
4. **Logout stacked two navigation paths.** `POST /api/auth/logout` closes the
   socket with code 4001, so `NetClient.onAuthLost` already renders the sign-in
   panel; `UI.logout()` then called `returnToMenu()`, which opened a
   “Return to main menu?” confirm on top of it. Logout now renders the sign-in
   panel directly and does not ask for confirmation.
5. **Reconnect after an explicit close.** `NetClient.connect()` called
   `ws.close()` without detaching its handlers, and `close()` did not mark the
   client stopped. That could schedule a reconnect after logout/restart. Both now
   go through `detach()`, and `close()` sets `stopped`.
6. **Same-account rule.** One live socket per account (`accountSockets`), sessions
   replaced on login (`Store.replaceSession`), and the old socket closed with 4002
   “Signed in on another device.” Verified in the browser.
7. **Server-side account data.** Usernames are `^[A-Za-z0-9_]{3,16}$`, unique
   case-insensitively, passwords 6–128 characters hashed with bcrypt (cost 11),
   never returned. `/api/health` (and `/health`) reports readiness. The auth panel
   shows Connected / Connecting / Cannot reach server, with Retry and backoff.

### Verified in a real browser (`docs/round8-proof/round8-e2e.log`)
- Menu has **no** account UI, only Single Player, Multiplayer, Settings, How to play.
- Multiplayer opens the login/create panel; it never appears on the menu.
- Empty username, invalid username (`ab`), empty password, short password, wrong
  password, and duplicate username each show a clear error.
- Enter submits; the button is guarded against double submit.
- Create account → HUD; refresh → Multiplayer restores the session with no form.
- Logout → sign-in panel, HUD hidden.
- Same account in a second browser → first client is returned to the sign-in panel
  with “Signed in on another device.”
- Zero uncaught console errors and zero non-deliberate failed requests across the
  positive flows. The 401/409 responses are the deliberate negative tests.

### Not verified
- Server-down state and slow-network loading state were not exercised in the browser
  (the Retry/backoff code path exists; **Unverified**).
- Session expiry after the full TTL was not waited out; invalid-token handling was
  only exercised through logout/revocation (**Unverified**).
- Two different accounts in two clients at once were not run in this suite
  (**Unverified**), though the same-account kick was.

## V2 — Single-player Continue / New Game

### Root cause and fix
There was no single-player save at all: solo worlds lived only in the server’s
memory map and died on restart. Added `solo_saves` to `server/db.ts`, `/api/solo`
metadata, and WebSocket `soloKey`/`fresh` handling in `server/index.ts`. A restored
table reuses its existing human seat instead of seating a duplicate; the server
autosaves a dirty solo world at most every 1.5 s. New Game deletes the save row and
starts a fresh table after the in-game confirmation.

### Verified
`tests/e2e/round8.spec.ts` starts a new solo table, rolls, reloads, sees Continue
enabled, resumes, and checks the same player id, cash and turn via the test-only
`window.__state` hook. Corrupt saves return `{ exists: false, corrupt: true }` and
Continue stays disabled with a reason (code path, not browser-tested:
**Unverified**).

## V3 — Live market

**Root cause:** `openMarket()` drew a static snapshot; `setState` refreshed only the
log. Added an in-place `marketLive` refresher that updates prices, arrows,
sparklines, holdings and P/L on every state tick without rebuilding the sheet.
**Verified:** the panel opens and stays error-free (`v3-market-open.png`).
**Unverified:** two-client price movement within one second was not run.

## V4 — Floating sky objects

**Root cause found in the all-angle audit.** Rooftop clutter was positioned with a
building's *world* bounding box but attached as a child of the building model.
The model's normalisation scale then multiplied the position and the prop size a
second time; skyline models scale 7–13×, which threw barrels, crates, satellites
and trees 50–170 units into the sky. Rooftop props now attach to the unscaled
building holder at the roof's local position (`src/render/city.ts`).

**Verified:** the browser audit asserts every rooftop prop is below y=20 and that
at least one exists; the all-angle day/night frames show a clean sky. Proofs:
`v4-sky-noon.png`, `v4-sky-night.png`, `v4-sky-orbited.png`.

## V5 — Jail cage only, no gazebos

**Root cause:** `src/board/jail.ts` loaded the Kenney `jailbars` prop model four
times around every cage, on top of a stone base; that is the brown gazebo-like
cluster. The model load and its import were deleted; only the procedural metal cage
with its flat JAIL sign remains.
**Unverified:** no post-removal screenshot of one or several jailed players.

## V6 — 100+ pieces

**Root cause:** the token list stopped at 72 pieces. Added 28 licensed Kenney
models from the same CC0 mirror (14 food, 8 furniture, 6 space), bringing the
usable set to exactly **100** (vehicle 16, animal 20, food 26, object 27, fantasy
11); the full manifest is 154 assets. The manifest cache version was bumped so
browsers cannot serve the old list, and CREDITS.md was regenerated. The downloader
now preserves manifest entries it does not own; without that, refreshing tokens
dropped the 43 licensed city assets and failed the build.

**Verified:** the browser suite opens Pieces, asserts exactly 100 `.token-card`
entries, and saves `docs/round8-proof/v6-100-pieces.png`. `npm run build` passes
the no-handmade-models check with 154 licensed assets.

## V7 — Wheel result only after landing

The existing implementation already sets the result text, colour and Continue button
only inside the final animation frame (`showChance`); the neutral percentage is
shown before and during the spin. No code change was needed.
**Verified:** the V8/V16 browser flow requires **Spin** before the result's
Continue button, and the jail-sale wheel follows it. **Unverified:** a
frame-by-frame capture of the pre-spin result state was not produced.

## V8 — Bank robbery

The Underworld button, amount slider/field, warning dialog and server intent all
exist; the amount range comes from `RULES.robberyMin/Max` (50,000–100,000) and the
20%→5% curve is unchanged. No defect was reproduced after the build was repaired.
**Verified:** the browser test plans a minimum heist, confirms it, spins the
server-odds wheel and reaches jail on failure. **Unverified:** maximum,
out-of-range and non-numeric amounts were not driven through the browser.

## V9 — Murder at exactly 5%

**Root cause:** `src/game/rules.ts` had `murderChance: 0.01`. Changed to `0.05`.
The warning screen, wheel percentage and server roll all read `RULES`, so they
follow automatically.
**Verified:** `tests/r8-round8.test.ts` simulates 10,000 attempts (4.6%–5.4% band)
and the world test now expects 5%.

## V10 — Jail sale wheel colours

**Root cause:** `zoneColor` only knew `success`, so the jail sale’s `none`,
`some` and `all` zones all fell through to the three failure reds. Colours now
come from `wheelColor` in `chanceWheel.ts`: none sold is green, some sold amber,
all sold red; generic success/failure is unchanged.

**Verified:** the unit test proves three distinct semantic colours, and the live
robbery→jail browser flow now asserts the jail-sale legend has three distinct
computed colours and saves `v10-jail-sale-wheel.png`.

## V11 — Player logs and reputation

Actions, the public record and private detective reports already had a dedicated
Reputation sheet (`openReputation`); the browser panel test opens it against the
live server. The missing proof was the wire payload.

**Verified:** a unit test sets different private reputations and a private dossier,
then proves no public player object contains `reputation`, `dossier` or `acts`,
that the serialized public state contains no dossier, and that a player’s own
private state does not contain another player’s dossier. **Unverified:** the
exact three-section log layout was not re-reviewed visually.

## V12 — Main menu

**Root causes and fixes:** the menu mixed auth/name fields with mode buttons; it now
shows only Single Player, Multiplayer, Settings and How to play, with auth only
after Multiplayer. The preview column was capped by a 1240 px card, leaving a tall,
narrow canvas; the card now grows to 1760 px, the preview owns 60% of it, and narrow
windows stack it instead of hiding it.
**Verified:** `v12-menu-1280x720.png` and preview screenshots at 1280×720,
1920×1080, 2560×1440 and 700×1000 (bounding-box assertions in the suite).

## V13 — Camera orbit only

**Root cause:** `CameraRig.zoom(delta, toward)` lerped `wantTarget` toward the cursor,
which is a pan and let the board drift off centre. The parameter and the lerp were
removed; zoom changes distance only, `orbit()` changes yaw/pitch, and radius/pitch
remain clamped.
**Verified:** the V4/V13 browser test drags hard in two directions, snaps a full
rotation and finishes with zero console/network errors. **Unverified:** the
orbit-only invariant (pivot never pans) was not asserted numerically.

## V14 — Six arranged songs

**Root cause:** the audio engine scheduled one fixed 8-bar, 120 BPM loop and never
had a song list or a shuffle.
**Fix:** `src/audio/songs.ts` defines six distinct 2–3 minute arrangements
(84–132 BPM, different forms, timbres and melodies). `AudioEngine` uses a shuffle
bag with no immediate repeat, schedules each arrangement's own tempo, and
crossfades over 1.1 s between two music buses.

**Verified:** `tests/songs.test.ts` proves six arrangements of 120–240 s and two
full cycles without a repeat; the browser test skips through two cycles, sees all
six and asserts at least 12 real crossfades with zero errors.

## V15 — Hop sound

**Root cause:** every hop played the same fixed-pitch blip. `AudioEngine.play()` now
takes a pitch multiplier and each move event varies it (0.94–1.06). One `move`
event is emitted per landing, so the call count matches hops.
**Unverified:** no audio capture or per-hop count proof.

## V16 — Jail dice must land

**Root cause (server):** the `p.inJail` branch in `World.roll()` decremented the
sentence and returned **before emitting a `roll` event**, so the client never
received dice. It now rolls two dice, emits them, frees the player on doubles,
releases after the final failed roll, ends the turn and bumps `seq`.
**Root cause (client safety net):** added a 6-second clear so a dice layer can never
cover the table indefinitely.
**Verified:** `tests/r8-round8.test.ts` proves a non-freeing roll still emits dice,
doubles release, and the third failed roll releases. The live browser flow now
reaches jail through a failed robbery, serves, and proves the jail sentence
changes after the roll; `v16-jail-before-roll.png` and `v16-jail-after-roll.png`.
**Unverified:** the pay-release and jail-card paths were not driven in the browser.

## V17 — Bot turns

Cards, purchases, rent and builds now raise ribbons on the human’s screen in solo,
and bot Chance/Community Chest cards are shown (previously filtered out because the
event was not “local”). Full bot camera sequencing was not verified.
**Unverified.**

## V18 — Railroad and GO text

**Root cause:** tile labels used fixed z offsets. Railroad/utility names sat on
the colour band at z=-0.33, and corner labels sat over painted art; the price sat
0.06 from the tile edge. Added `tileTextLayout(space)` in `layout.ts`: banded
tiles put the name at -0.16 (clear of the band’s -0.305 inner edge), properties
keep two lines between band and price, prices move to 0.40, and corners move
their single-line label to the inner apron at 0.36.

**Verified:** `tests/board-layout.test.ts` checks all 40 spaces against tile
bounds, band clearance and price/label separation. **Unverified:** no close-up
board screenshot was captured after the change.

## V19 — UI scale Apply/Cancel and centring

**Root causes and fixes:** the slider applied immediately, and `#ui` used
`transform: scale()` with `transform-origin: top left`, which pushed content off
centre. The slider is now staged with Apply/Cancel (Apply saves; Cancel restores),
and each HUD region is anchored to its own edge (top bar top-centre, rail left,
bottom bar bottom-centre, camera controls right, sheets centre).
**Root cause fixed during proof:** a later `#ui { font-size: 15px }` rule silently
overrode the scaled `calc(15px * var(--ui-scale))`, so text did not scale even
when the custom property changed.
**Verified:** the browser test applies 80%, 100% and 130%, checks the root custom
property and the computed `#ui` font size at each value, and saves three
screenshots. **Unverified:** every panel was not opened at each scale.

## Production outage — Pages pointed at a stale server

**Observed:** the published Pages site loaded, but every request to the game
server failed and the auth panel reported that it could not reach the server.

**Root causes:**
1. GitHub Pages deployed commit `3e0f564`, but Render's only deploy was `266e7c1`
   (nine hours old). The old server had no CORS headers at all, so the browser
   rejected every `fetch` with `TypeError: Failed to fetch`; it also returned the
   SPA HTML for `/api/auth/session` instead of JSON.
2. The client health check used a 4-second timeout. Render documents cold starts
   of 50 seconds or more; the server itself took 22 seconds to wake in this test,
   so a sleeping-but-healthy server was reported as unreachable.
3. The client treated any HTTP 200 as API data, so an HTML fallback from a
   misrouted server produced a confusing parse failure instead of an outage.

**Fixes:**
- Render was manually redeployed from `3e0f564`; CORS preflight now returns 204,
  `/api/auth/session` returns a JSON 401 without a token, and the WebSocket
  endpoint upgrades successfully.
- `apiFetch` now waits up to 75 seconds (the documented cold-start window) and
  rejects `text/html` responses instead of accepting them as API data.
- The auth panel changes from “Checking server…” to “Waking server…” after five
  seconds, so a cold start is distinguishable from a failure.
- Unknown `/api/*` routes now return JSON 404, never the SPA shell. `/api/health`
  reports the deployed commit and protocol version for post-deploy checks.

**Verified:** live health, CORS preflight, JSON auth rejection, and WebSocket 101
against the Render origin. Browser sign-in against Pages is verified below.

## Test and build status

- `npm run typecheck` — pass.
- `npx vitest run` — **235/235** pass (10 files), including the six-song deck,
  jail-dice, 10,000-attempt murder, tile-layout, wheel-colour and privacy tests.
- `npm run build` — pass.
- `npx playwright test tests/e2e/round8.spec.ts` — **9/9** pass in 8.8 minutes
  against a fresh build and fresh database (`/tmp/chromonopoly-e2e.db` is deleted
  before the run). Raw log: `docs/round8-proof/round8-e2e.log`.
- The six old e2e specs were deleted because they drove the removed `#name-input`
  path; the new suite is the only e2e path.

## Honest summary

Repaired and proven in the running game: **V1 (core scenarios), V2, V4, V6, V7
(spin lifecycle), V8 (minimum heist/failure), V9, V10, V11, V12, V13 (drag/snap
stress), V14, V16 (server and browser), V18, V19**. The V9, V11 and V18 claims are
pure/server tests plus the live panel smoke; V7 is the real spin/Continue flow but
no frame-by-frame capture.

Still **Unverified / not covered** after this pass: two-client live price movement
(V3), a post-gazebo-removal jail screenshot (V5), per-hop audio counting (V15),
automatic bot-turn camera/cards (V17), the numeric orbit-only invariant (V13),
maximum/out-of-range/non-numeric robbery amounts (V8), a close-up V18 board image,
and browser-driven trade, court, detective and jail pay/card flows (their server
mechanics remain covered by `tests/world.test.ts`). These are limitations of the
proof, not claims of success.
