# Chromonopoly 3.0 — Revision Final Report

Date: 2026-11-07  
Target: `/home/christian/Desktop/LittleProjects/Chromonopoly 3.0`  
Nature: revision of the existing game. The server-authoritative world, economy,
public multiplayer world, licensed GLB pipeline and existing flows were kept.

## 1. Implemented

- **R1/R2 — Chance and modals:** Chance is a page-level overlay above every
  sheet, banner and dock. It opens at rest with the server's percentage, requires
  **Spin**, lands on the server result and requires **Continue**. Sheets are
  centred, compact, full-viewport-backed and scroll internally.
- **R3 — Market:** summary cash/holdings/made/lost/net plus per-holding
  quantity, average cost, value and P/L.
- **R4 — Dock:** larger labelled icons, labelled Camera/Log/Court/Pieces and
  replaced gavel/pawn-plus SVGs.
- **R5 — Audio:** the looping interaction click was removed; the audit is in
  `docs/audio-audit.md`.
- **R6 — No bots in multiplayer:** the public world seeds no AI and rejects
  legacy bot seats. Solo still fills three AI rivals.
- **R7 — Properties/Trade:** My properties, Everyone and Trade; server-locked
  cash-and-property offers; atomic swap; accept, decline and counter.
- **R8 — Physical dice:** two bevelled dice roll on the table centre for the
  local roller, with the HUD mirror; other clients do not see the animation.
- **R9 — MORTGAGED signs:** a large camera-facing 3D plaque with wooden post,
  dark-red plate, cream SDF lettering and gold coin. It is shown on the
  mortgagee's tile instead of a flat label.
- **R10 — City:** an inner ring road, lane markings, crossings, sidewalk,
  radial avenues, traffic, walkers, street furniture and a dense 40-building
  city wall one block back. The final camera shows the city around the board.
- **R11 — Travel orientation:** cars, walkers and board pieces face their path
  tangent; pieces ease through corners and return to a camera-facing rest.
- **R12 — Board typography:** self-hosted Lilita One SDF lettering with dark ink,
  compact names and the expanded fit tests. Fredoka remains credited and
  self-hosted but is no longer used for the board labels.
- **R13 — Sky:** eight-minute sunrise/day/sunset/night cycle with moving sun and
  moon, stars, clouds, street glow and a separate fixed board light rig.
- **R14 — Menu/tutorial:** the menu piece caption is gone, How to Play is
  single-player only, and the interactive tutorial runs over a live solo table
  with highlights, skip/exit and a finish action.
- **Camera framing:** default radius 27 and target offset `framingY: -2.2` keep
  the full board between the top HUD and bottom dock. Stable centred framing is
  now the default; the follow toggle remains available in Settings.
- **Court live evidence:** an open Court sheet updates its evidence rows and Sue
  enablement when a private dossier arrives, without closing the sheet or
  discarding a claim being typed.
- **Earlier sections:** solo turn gating and equal stacks, shared multiplayer
  board, stock cost basis, jail outcomes, detective, theft, murder warning,
  private reputation, card decks, renamed pieces, dark mode, UI scale, restart
  and return-to-menu remain wired.

## 2. Tested

### Completed checks

- `npm run typecheck` — **pass** (ran after the Court live-update change).
- `npm test` — **212/212 pass** in `rules` (23), `world` (28) and `fit` (161).
  The build-time no-handmade-models check passes: 72 licensed token models,
  24 licensed building models, 0 primitive objects outside board/UI.
- `npm run build` — **pass**, including the model check, TypeScript, Vite and
  server bundle.
- **Browser journeys — 8/8 have a recorded pass**, split across four
  invocations because the serial file exceeds one local command window:
  rent-evasion success, rent-evasion caught and jail release in the first run;
  detective evidence after the live Court update; settlement; and court-win,
  court-loss and theft in the final run. The first three predate the Court-only
  fix; every Court-dependent journey was rerun after that fix.
- Two test-harness races were corrected during verification: the chance overlay
  now gets a realistic appearance wait, and cash polls allow for the slow
  headless renderer. The Court sheet also updates private evidence in place.
- **Camera-fit matrix** at the actual 3D projection, with no page errors:

  | Viewport | GO tile center / dock top | Far corner center / top HUD bottom |
  |---|---|---|
  | 1280×720 | 541.5 / 590 | 115.8 / 95 |
  | 1440×900 | 676.9 / 770 | 144.8 / 95 |
  | 1920×1080 | 812.3 / 950 | 173.8 / 95 |
  | 2560×1440 | 1083.0 / 1310 | 231.7 / 95 |
  | 2560×1080 (21:9) | 812.3 / 950 | 173.8 / 95 |

  All four corner tiles remain inside the play area at every size. The left rail
  also stays clear of the left corner.
- **Visual evidence:** `screenshots/rev8-final-default-1280.png`,
  `screenshots/rev8-final-default-1440.png`, plus sign evidence
  `screenshots/rev7-sign-1440.png`, `rev7-sign-rotated.png` and
  `rev7-sign-crop.png`. The full city and ring road are visible; the mortgage
  plaque remains readable after camera rotation.
- The two-client cash reproduction used by the journey checks showed the actor's
  private cash reaching `$2,000` and the rent sheet opening correctly.

### Not run in this final pass

- `tests/e2e/modes.spec.ts`, `tests/e2e/trade.spec.ts` and
  `tests/e2e/smoke.spec.ts` have recorded passes from the earlier verification
  pass but were not rerun after the final camera/type/city changes.
- `tests/e2e/screens.spec.ts` (light/dark and 80–130% UI scale panel matrix) and
  `perf.spec.ts` were not run in this pass.
- No single aggregate all-tests invocation completed; the journey results are
  from split invocations.

## 3. Not done

- A real iPhone/Safari hardware pass has not been performed. Layout/fit was
  checked in Chromium only.
- Hardware 60 FPS was not measured.
- Audio was not listened to at runtime; only the source audit is complete.
- The tutorial was not played start-to-finish in a browser.
- The physical dice animation, all follow-camera states and every sky preset
  were not photographed.
- Each of the six chance-event types and the counter-trade browser flow were not
  individually scripted.
- The complete light/dark × 80/100/130% matrix was not captured.

## 4. Unverified / honest limitations

- The city now reads as a dense ring around the board, but it is still an
  interpretation of the supplied references rather than a street-for-street
  reproduction. Near-camera density and distant skyline silhouettes remain
  approximate.
- At the default full-board view, tile labels are small at 1280×720; they are
  fitted and readable when zoomed, not large enough to read every name at a
  glance at that viewport.
- Headless screenshots are evidence of composition and absence of page errors,
  not proof of physical-device rendering or frame rate.
- The Court evidence refresh is covered by the detective journey; other open
  panels were not re-audited for live private-state updates.

## 5. How to run

Requirements: Node.js 22.18 or newer.

```bash
npm install
npm run dev:all        # Vite client + persistent game server
# production locally
npm run build
npm start
```

Checks:

```bash
npm run typecheck
npm test
npx playwright test tests/e2e/flows.spec.ts
```

Playwright builds the client/server, starts an isolated server on port 8790 and
uses `/tmp/chromonopoly-e2e.db`. The long-lived local preview used port 8791; the
isolated final visual/preview server used 8792. Neither is part of production.

## 6. Assets and credits

The complete inventory is in `CREDITS.md` and `src/assets/manifest.json`; every
asset entry has a source, author and licence. All 3D city/building/token assets
are Kenney CC0. Board and SDF text use **Lilita One** (Juan Pablo del Peral, SIL
OFL 1.1), self-hosted at `public/fonts/LilitaOne-Regular.ttf` with
`LilitaOne-OFL.txt`. Inter and Outfit remain the UI fonts. All audio is
synthesised at runtime; icons and dice are original project work.

## 7. Files changed in this revision

- Rendering/camera: `src/config.ts`, `src/render/scene.ts`,
  `src/render/city.ts`, `src/board/cityGround.ts`, `src/board/board.ts`,
  `src/board/layout.ts`, `src/board/textFit.ts`.
- UI/state: `src/ui/ui.ts`, `src/ui/styles.css`, `src/ui/settings.ts`,
  `src/main.ts`, `index.html`.
- Game/server: `src/game/rules.ts`, `src/game/types.ts`, `src/game/cards.ts`,
  `server/world.ts`, `server/index.ts`, `server/net.ts`.
- Assets: licensed GLBs, `src/assets/manifest.json`, text embedding scripts,
  `public/fonts/LilitaOne-Regular.ttf`, `public/fonts/LilitaOne-OFL.txt`.
- Tests/docs: `tests/fit.test.ts`, `tests/e2e/*.spec.ts`,
  `docs/revision-plan.md`, `docs/audio-audit.md`, `CREDITS.md`, this report.
- Evidence: `screenshots/rev8-final-default-*.png`, `rev7-sign-*.png` and the
  earlier city/mortgage captures.

There is no Git repository in this project, so these are working-tree changes
rather than commits.
