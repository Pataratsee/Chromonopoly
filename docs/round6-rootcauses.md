# Round 6 — root causes and fixes

This is a revision of the existing game, not a rebuild. The server remains authoritative; the
licensed GLB assets and existing game rules are unchanged. There is no Git repository on this
machine, so these changes are working-tree changes only.

## T1 — Two tile-index to world mappings

**Root cause.** Tile positions were derived independently for the board surface, buildings, and
tokens. Small differences in the formulas put moving pieces on a neighbouring tile centre even
when the server logic tile was correct.

**Fix.** `src/board/layout.ts:20` is now the only tile-index → world mapping (`tilePose`). Board
rendering, buildings, tokens, owner signs, and specials all consume it. Server movement uses
`advanceTile` in `src/game/board.ts:22`, so the logical destination and the rendered destination
cannot diverge.

**Evidence.** `tests/positions.test.ts` passed 4/4. Browser movement logs expose the distance
between the piece and `tilePose(tile)`; the `turns` proof records it.

## T2 — Prompts could open before the turn animation finished

**Root cause.** Local game events were dispatched as they arrived. A card/rent/tax event could
therefore open its sheet while the dice were still rolling or the piece was still moving, so the
prompt appeared before `TILE_PROMPT`.

**Fix.** `src/main.ts:114` records every transition in one awaited state machine:
`IDLE → DICE_ROLLING → DICE_SETTLED → CAMERA_ZOOM_IN → PIECE_MOVING → PIECE_LANDED →
CAMERA_ZOOM_OUT → TILE_PROMPT` (`src/main.ts:175-224`). Local events are buffered until the
machine reaches `TILE_PROMPT`; `UI.setPromptsBlocked()` gates roll, card, chance, and tutorial
buttons. Single-player, shared multiplayer, and tutorial use the same sequencer.

**Evidence.** `__turnLog` and `__flowState` are proof hooks. The completed `turns` phase recorded ten
real rolls. Every roll was exactly `IDLE → DICE_ROLLING → DICE_SETTLED → CAMERA_ZOOM_IN →
PIECE_MOVING → PIECE_LANDED → CAMERA_ZOOM_OUT → TILE_PROMPT`, and every rendered landing distance
was `0` (`r6-turns-log.json`, `r6-turns-final.png`).

## T3 — Stale model manifest made the city silently disappear

**Root cause.** Browsers could reuse a cached `assets/models/manifest.json` from an earlier build.
The stale manifest contained no usable buildings, and the loader accepted it, so the city showed
an empty ground plane while the server and tests looked healthy.

**Fix.** `src/render/models.ts:44-53` requests the manifest with a version query and
`cache: 'no-store'`, and rejects a manifest with no buildings instead of silently rendering an
empty city. The current URL is `assets/models/manifest.json?v=round6-2026-11-07`.

**Evidence.** `r6-smoke-log.json` and `r6-diag-log.json` contain the live model counts; the current
build reports loaded buildings and no failures. The exact startup-count snapshot is recorded in
the smoke log.

## T4 — The skyline and sky were geometrically outside every possible camera view

**Root cause.** The camera used a 34° vertical FOV and clamped pitch to at least 20°. Looking down,
the horizon was above the top of the frame for *every* allowed camera angle, so the sky, clouds,
sun/moon, and skyline could not be seen even though they existed. The skyline was also 63–94 units
away with towers up to ~83 units high, which put their tops far above the screen.

**Fix.** `src/config.ts:37,47` now uses a 46° FOV and allows pitch down to 6°. The skyline in
`src/render/city.ts` is three overlapping rings at radii 66/82/98 with heights scaled to 0.7/0.85/1.0,
so the wall closes every gap while leaving sky above it. Clouds were lowered and the moon moved to
the city-facing side of the sky (`src/board/sky.ts`); previously it was behind the default camera at
all night hours.

**Evidence.** `r6-horizon.png`, `r6-sunset.png`, `r6-moon.png`, and `r6-night-sky.png`, plus
`r6-diag-log.json` and `r6-skyviews-log.json`. The night log records a dark sky
(`top` ≈ 0.002/0.007/0.024) and visible stars/clouds. Horizon screenshots are at the minimum pitch.

## T5 — Chance wheel painted no success/failure arcs

**Root cause.** `segmentsForDisplay()` returns new segment objects. The renderer then used
`zones.indexOf(z)` to choose a colour, which returned `-1` for every segment. The conic-gradient
contained `undefined` stops, so the browser rejected the background and only the plain dial/card
was visible. The inward pointer and legend were correct, which made the missing ring easy to miss.

**Fix.** `src/ui/ui.ts:1947-1950` now maps segment colours by their matching index, producing a
valid stop for every zone. The wheel keeps the fixed inward pointer, exact server percent, 6.8 s
spin plan, 6–10 rotations, and server-selected landing.

**Evidence.** `r6-chance-wheel.png` now shows the green success arc and red failure arc, while
`r6-chance-result.png` shows the server result (`Caught`, 45% success). The unit suite runs 100
spin plans and landing checks.

## T6 — Owner signs and the jail cage

**Root cause.** Owner state was previously drawn as flat circles/lots on the tile, which collided
with the colour band/price text and did not identify the owner. Mortgaged signs could occupy the
same visual space.

**Fix.** `src/board/board.ts` removes the owner ring and adds one camera-facing 3D sign on the outer
edge of each owned tile. The sign carries the owner's username, colour strip, and piece model; it
updates when ownership changes and is removed when ownership is cleared. The existing raised
MORTGAGED plaque remains on its own post, so the two cannot overlap. `src/board/jail.ts` adds a
cage that drops over jailed pieces, with a release lift and separate slots for multiple prisoners.

**Evidence.** `r6-owners-default.png` and `r6-owners-close.png` show four signs for two owners
(Ada on tiles 1/6, Grace on 11/16), no console errors. `r6-jail-cage.png` now reaches the JAILED
state and dismisses the delayed property-sale wheel, but the cage itself is obscured by the HUD /
camera framing in that capture. The cage implementation is present; its visible proof remains
**Unverified**.

## T7 — Card stacks and deck draw animation

The centre field has raised Chance and Community Chest stacks with deck logos and a 3D card that
lifts, flips, and returns to the deck when a card event arrives (`src/board/board.ts`
`createDeckStack` / `playCard`). The DOM card sheet is also created for the event text. The chest
event was observed (`card visible chest true`) and `r6-card-chest.png` exists, but the sheet's
3.2 s auto-close beats the software-rendered screenshot, so the sheet is not visible in the
capture. The explicit deck names above the centre stacks are also not readable at the default
camera. Both are **Unverified** visually.

## Verification labels

Run and passing:

- `npm run build` (includes `tsc --noEmit`) after the final code changes.
- `tests/positions.test.ts` 4/4, `tests/chanceWheel.test.ts` 3/3, `tests/cityPlan.test.ts` 4/4
  in the earlier focused run.
- Owner-sign proof: two browser sessions, four signs, no console errors.
- Chance wheel: arcs now visible; server result/odds match; unit spin plan is deterministic.
- City/sky captures: horizon, sunset, moon, and night stars exist at the allowed minimum pitch.
- Live city model counts: loaded buildings/props with no failed requests (see smoke/diag logs).

Not yet proven, and therefore **Unverified**:

- A hardware-GPU 60 FPS measurement. The proof browser uses software WebGL; timing runs there are
  throttled and are not a 60 FPS claim.
- RESOLVED: the ten-roll turn-order summary and all ten real landing distances. The log contains
  the exact eight-state order for each roll and `distance: 0` for all ten.
- The jail cage itself in the final screenshot. The JAILED state and wheel dismissal are proven,
  but the cage is obscured by the HUD/camera framing.
- The 3D card sheet/face in the card screenshots. The event and visibility log exist, but the
  screenshot misses the 3.2 s sheet.
- Readable names above the centre deck stacks at the default camera.
- A hardware-GPU 6.8 s wheel wall-clock measurement. The plan constant and unit tests are exact;
  the software renderer's measured wall clock was 9.75 s because the page was throttled.

Freshly captured after the FOV/radius change: four yaw angles, close/far zoom, horizon, sunset,
moon, night sky, chance wheel/result, owner signs, jail state, and turns-final. The four angle
images are `r6-board-angle-0..3.png`; close/far are `r6-board-zoom-close.png` and
`r6-board-zoom-far.png`.
