# Chromonopoly revision plan and status

Target: this repository, `Chromonopoly 3.0` — the existing TypeScript/Three.js
web game. The older Unity folder named in the brief is not this codebase.

## Scope retained

- One persistent public multiplayer world on the Node/WS server. Money, deeds,
  shares, loans, jail, court and reputation are server-owned; intents are
  idempotent and private payloads stay private.
- Three.js board, server-authoritative economy, licensed GLBs, liquid-glass HUD,
  market/bank/underworld/court/properties panels, AI solo mode and reconnect.
- No rebuild of the working server or asset pipeline.

## Revision delivered

- **R1/R2 — Chance and modals:** page-level chance overlay above every sheet and
  banner; server result, manual Spin and Continue; full-viewport blurred
  backdrop; centred, internally scrolling sheets.
- **R3 — Market:** summary and per-holding quantity, average cost, value, P/L.
- **R4 — Dock:** large labelled icons; labelled Camera/Log/Court/Pieces.
- **R5 — Audio:** no looping interaction click; `docs/audio-audit.md` records
  every one-shot call site.
- **R6 — Modes:** the public world has no bots; solo seats three AI rivals.
- **R7 — Properties/Trade:** My properties/Everyone/Trade; server-locked
  cash-and-property trades; accept, decline and counter.
- **R8 — Dice:** two physical dice at the board centre for the local roller,
  settled by the server result, with the HUD mirror.
- **R9 — MORTGAGED:** camera-facing 3D plaque with post, dark plate, SDF lettering
  and gold coin; shown instead of a flat label.
- **R10 — City:** ring road, crossings, radial avenues, sidewalk, a close
  40-building wall plus near/mid/far frontages, traffic, walkers, trees, lights,
  benches, cafes and night glow.
- **R11 — Movement:** cars, walkers and pieces travel facing their path tangent;
  pieces ease through corners and return to a camera-facing rest.
- **R12 — Board type:** Lilita One self-hosted SDF text, compact names, dark
  ink, larger fit area and 161 label-fit tests. Fredoka remains credited but is
  no longer used for the board.
- **R13 — Sky:** eight-minute day/night cycle, moving sun and moon, stars,
  clouds, street glow, with a separate fixed board light rig.
- **R14 — Menu/tutorial:** piece caption removed; How to Play is single-player
  only; tutorial overlays a live solo table with highlights, skip/exit and
  finish.
- **Camera/Court:** stable default framing keeps all four corners inside the
  safe area at every required viewport; follow remains a setting. An open Court
  sheet now refreshes private evidence and Sue enablement in place.

## Verification (2026-11-07)

- `npm run typecheck` — passed after the final UI change.
- `npm test` — **212/212 passed** (`rules` 23, `world` 28, `fit` 161); model
  check passed (72 licensed token models, 24 buildings, 0 primitives outside
  board/UI).
- `npm run build` — passed (model check, TypeScript, Vite and server bundle).
- `flows.spec.ts` — **8/8 journeys have a recorded pass** across split runs:
  rent-evasion success/caught, jail release, detective evidence, settlement,
  court win, court loss and theft. The serial file is too slow for one local
  command window; the first three predate the Court-only fix, and all
  Court-dependent journeys were rerun after it.
- Camera-fit measurements at 1280×720, 1440×900, 1920×1080, 2560×1440 and 21:9:
  all four corner tile centres remain above the dock and below the top HUD, with
  no page errors. Evidence in `screenshots/rev8-final-default-1280.png` and
  `rev8-final-default-1440.png`.
- Mortgage sign evidence: `screenshots/rev7-sign-1440.png`,
  `rev7-sign-rotated.png`, `rev7-sign-crop.png`.
- The final court runs confirmed the expected `$3,700` win, `$2,850` loss and
  jail outcome; the chance overlay appeared and resolved in each.

## Not rerun after the final visual changes

- `modes.spec.ts` and `trade.spec.ts` have recorded passes from the earlier
  verification pass, but no full rerun after the final camera/type/city work.
- `smoke.spec.ts`, `screens.spec.ts` (light/dark × 80–130% panel matrix) and
  `perf.spec.ts` were not rerun.
- Real-device iOS/Safari layout and hardware 60 FPS were not measured.
- Runtime audio listening, the full tutorial, every chance-event type and the
  counter-trade browser flow remain unverified.

## Constraints honoured

- No handmade 3D objects outside the permitted board/UI/dice geometry; the
  build-time model check remains authoritative.
- Server authority and private state were preserved.
- Licensed assets remain credited in `CREDITS.md`; Lilita One is covered by
  `public/fonts/LilitaOne-OFL.txt`.
- Claims above are limited to the commands and captures actually completed.
