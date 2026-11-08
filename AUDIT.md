# Chromonopoly 3.0 — Audit

Written before any production code. Everything below was checked on this machine
(2026-11-07, Linux, Node v26.13.0) or is labelled as an assumption.

---

## 1. Environment and skills reviewed

**Tooling available:** Node 26.13, npm 12.2.2, git 2.56, ImageMagick, ffmpeg,
Chromium (via the desktop browser panel), no Blender, no Unity, no Google
Chrome CLI. No `bun`, no `pnpm`, no `python` model tooling.

**Skills read and applied:**

| Skill | Applied to |
|---|---|
| `ponytail` (full) | Smallest complete implementation: one config file, one board file, one reducer, no speculative abstractions. |
| `frontend-design` | Typography (Inter + Outfit, self-hosted), palette tokens, one bold moment per screen, restraint. |
| `brainstorming` | Replaced by the supplied 17-section brief, which is already a complete design document. No approach selection needed; the brief fixes the approach. |
| `executing-plans` | Inline execution of the brief's phase order with a written ledger (this file + `PHASES.md`), no check-ins between phases. |
| `design-review` / `ux-review` / `map-systems` / `design-system` | Their checklists (states, empty/error states, contrast, acceptance criteria, dependency order) are followed, but their `.claude/` scaffolding does not exist in this workspace and was not created — the project brief overrides the workflow. |

`agent-arena`, `team-narrative`, `obsidian-vault`, `balance-check`, `estimate`,
`playtest-report`, `ultrathink` were invoked by the prompt but are not applicable
to a solo build of a fixed spec (no multi-model routing configured, no vault, no
sprint history). `ultrathink` was run for its output only.

---

## 2. Reference study — every file in `ReferencePics/`

**Important finding:** the reference folder is not what its filenames claim.

### 2.1 `ReferencePics/web` — 16 images (`monopoly-go-*.jpg`)

Verified with `file` and by viewing each image. The set is **mixed mobile-game
marketing art, not 8 Monopoly Go screenshots**:

| File | Actually is | What it shows / what is good / what is cheap |
|---|---|---|
| `monopoly-go-1.jpg` (512²) | **Ludo Club** app icon | Flat 4-colour quadrants, white pips, heavy extruded logo. Good: confident flat colour blocks. Cheap: no depth, no materials. Not a source for this project. |
| `monopoly-go-2.jpg` (48²) | 1 KB favicon | Unusable. |
| `monopoly-go-3.jpg` (PNG 1600×2133) | **Ludo King** "Customise your game" store art | Market stalls with black/white striped awnings, blue gradient sky, glossy plastic dice. Good: glossy toy material, bright jewelled product thumbnails on a quiet field. Cheap: busy, sticker-collage composition. |
| `monopoly-go-4.jpg` (PNG 1024×500) | **Stumble Guys** key art | Saturated sky/cyan, chunky characters, strong rim light. Good: silhouette-first characters, warm/cool split lighting. |
| `monopoly-go-5.jpg` (PNG) | **Stumble Guys** "Customize" screen | Full 3D character on a stage, card grid, strong vignette. Good: one hero object, restrained chrome. Cheap: dense UI, small type. |
| `monopoly-go-6.jpg` (JPEG) | Generic mobile "Chat with friends!" | Cream sheet + dark ink, rounded inset rows. Good: iOS-like grouped list, generous row height. |
| `monopoly-go-7.jpg` (JPEG) | **Dice Dreams** "ROLL" | Purple sky, gold coins, glossy dice, big yellow 3D title. Good: bounce/coin-burst energy, chunky gold. Cheap: oversaturated carnival. |
| `monopoly-go-8.jpg` (JPEG 1260×2736) | **Pokémon TCG Pocket** share screen | Pastel gradient, frosted card. Good: soft material, clean hierarchy. |
| `monopoly-go-9.jpg` (JPEG) | **Dice Dreams** | Beach scene, cartoon mascot, blue water. Not applicable. |
| `monopoly-go-10.jpg` (JPEG) | 3D printed Monopoly token photo | Real metal-ish dog/car/cow tokens on a green board. Useful as token silhouette reference only. |
| `monopoly-go-11.jpg` (PNG 1600×900) | **Genuine Monopoly Go gameplay** | The single real reference: pale mint board, large flat tiles with thin white borders and dark caps labels, red ribbon "IT'S GO TIME", metal tokens (dog, dinosaur, iron, cow) at true scale, toy city in the board centre, palm trees outside, low 35° isometric camera, soft contact shadows. Supports the brief's warm-cream + jewel-band direction; Monopoly Go itself uses a pale mint field. |
| `monopoly-go-12.jpg` (JPEG) | Monopoly Go promo art | Collage of Mr. Monopoly. Not a gameplay reference. |
| `monopoly-go-13.jpg` (PNG 1080×1920) | **Monopoly Go dice collection** | Cream card tiles in a 4-column grid on blue, gold numerals, isometric die icons. Excellent reference for the token-picker card grid. |
| `monopoly-go-14.jpg` (JPEG) | **Dice Dreams** | Mascot on a float. Not applicable. |
| `monopoly-go-15.jpg` (JPEG) | **Stumble Guys** gameplay | White name labels over characters, slanted objective banner. |
| `monopoly-go-16.jpg` (JPEG) | "EXPLORE!" city islands | Isometric miniature city islands floating on mint, soft shadows, saturated roofs. Strong reference for **building silhouettes** and board-centre dressing. |

Also in `web/`: `preview-6/7/8/9/11/13/16.png` are duplicates of the above at
column width, except `preview-7.png` (a "Share cards" screen) and
`preview-9.png` (Obsidian-style note). No new information.

### 2.2 `ReferencePics/` root — 23 extensionless files

- `1`–`11` are **saved Google Image Result HTML pages**, not images. Their
  `<title>` reveals the origin: Monopoly Go promo (thewhyofplay), Monopoly Go
  Venice board, an Amazon listing, a TalkAndroid screenshot, a MyMiniFactory
  print, two Unity Asset Store packs, an itch pack, a Printables render, an
  ArtStation Monopoly pieces render, and a RenderHub "Monopoly properties" set.
  They are bookmarks, not usable assets.
- 4 are real **pack preview HTML pages**: `cartoon-low-poly-world-map`,
  `flying-world-castle-crows-claw`, `polygonia-low-poly-city-pack`,
  `polygon-mini-city-pack`.
- **18 are 0 bytes** — failed downloads (`board-game-piece-*`, `city`,
  `city-set-proto-series`, `low-poly-assets`, `low-poly-ultimate-asset-pack`,
  `low-poly-worlds-vol-2`, `monopoly`, `polygon-city-pack-preview`,
  `realistic-chicago-buildings`, `star-wars-inspired-low-poly-buildings`).
  **No model files exist anywhere in `ReferencePics/`.**

**Consequence:** there are no user-supplied models. Sourcing falls to public
CC0 libraries (section 4).

### 2.3 Genuine Monopoly Go screenshots studied (Google Play listing)

Six real 1052×592 captures were downloaded from the official Google Play listing
and viewed (Explore, WIN/Card, ATTACK, COLLECT sticker album, STEAL, ROLL). What
they establish, concretely:

- **Camera:** true isometric, ~35.264° pitch, 45° yaw, board fills the frame with
  a small margin; tokens stay vertical to the camera, never to the board.
- **Board surface:** pale pastel field (mint/cream per board theme), tiles are
  large flat quads separated by 1 px white seams; the colour band is a solid
  strip on the **inner** edge; tile labels are small dark caps on cream; prices
  are in a tiny cream pill.
- **Tokens:** 1.5–2 tile-widths tall, chunky metal/plastic with round soft
  shadows; they float slightly above the surface and hop, not slide.
- **Buildings:** miniature toy city inside the board ring, saturated roofs,
  no outlines, strong top-left key and cool ambient.
- **HUD:** bright red-orange ribbon banner across the top with heavy white caps
  and a slight arc; circular player portrait in a gold ring top-right; currency
  pill with gold coin icon; bottom-centre primary action is a huge cream/maroon
  rounded-square "GO" button; bottom row of small icon buttons on a pale bar.
- **Palette:** gold `#F0B840`, ribbon `#E23B2E`, ink `#1E2733`, sky cyan, grass
  mint; saturated property colours on a warm neutral field.
- **Effects:** short gold spark burst on reward, scale-pop on card reveal, no
  bloom on UI chrome, soft bloom on coins only.

### 2.4 Apple Liquid Glass (HIG + WWDC25 + community CSS measurements)

- Two variants: **regular** (blurs + dims, for legibility) and **clear** (over
  rich backgrounds). Glass is a *functional* layer only: bars, sheets, floating
  controls — never content cards. One glass layer at a time.
- Geometry: concentric corner radii (inner radius = outer − inset), squircle
  curvature, large radii (20–32 px for sheets, capsule for buttons).
- Material: `backdrop-filter: blur(24–48px) saturate(180%) brightness(1.05)`,
  a radial fill (65–75 % white in light mode), a 0.5–1 px white specular rim at
  60 % on the lit edge, and a two-layer shadow (`0 1px 3px / 0 12px 32px`).
- Colour bleeds through; never flatten the backdrop to grey.
- Type: SF Pro–like; large bold title (34 px), 17 px body, 13 px secondary at
  ~60 % ink; tight tracking on display.
- Motion: 250–300 ms sheets with a spring; 120–160 ms fades; no bounce circus.
- Controls: green toggle (51×31 capsule), sliders with a 28 px white thumb,
  segmented controls in a grey track with a white sliding pill.

---

## 3. Tech choices

| Area | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript, `strict` | 5.9 | Brief requirement. |
| Bundler | Vite | 7 | Fast, plain ES modules, no framework. |
| 3D | three.js, WebGL2 | 0.181 | Brief requirement. |
| glTF | `GLTFLoader` + `DRACOLoader` + `MeshoptDecoder` | bundled with three | `.glb` from the manifest only. |
| Board text | **troika-three-text** (SDF, worker-generated) | 0.52 | Crisp at any zoom; no bitmap upscaling. |
| Text metrics | **opentype.js** parsing the same TTF | 1.3.4 | Real glyph advance widths in both browser and Node, so the 40-tile fit test runs headless. |
| Model normalisation | `@gltf-transform/core` + `functions` | 4.2 | Recentre, scale, strip animations/textures, bake transforms — geometry untouched. |
| UI | Vanilla TS + CSS, no framework | — | No generic component look; full control of the glass. |
| Server | Node 26 + `ws`, `node:sqlite` | — | No native build step; server-authoritative. |
| Tests | Vitest (rules) + Playwright (UI, screenshots, two-client race) | 3 / 1.5x | Brief requirement. |
| Audio | WebAudio synthesis for SFX + a licensed CC0 music loop | — | Zero external runtime requests. |

**Rejected:** React (generic look, bundle weight), `three-stdlib` (unneeded),
`cannon`/physics (no gameplay need), `node-canvas` (native build on this
machine), bitmap fonts (forbidden by the brief).

Node 26 can execute `.ts` directly (type stripping), so the server needs no
build step; Vite handles the client.

---

## 4. Model sourcing plan

**Verified working sources (tested with `curl` from this machine):**

| Source | Status | Notes |
|---|---|---|
| `kenney.nl` direct | **403** for scripted downloads | Site blocks non-browser fetches. |
| `poly.pizza` | **403** | Cloudflare. API needs a key. |
| `itch.io` (Kenney) | **429** rate-limited | Unreliable for automation. |
| `quaternius.com` | 200, downloads via Google Drive | Drive folder links are not scriptable. |
| `polyhaven.com` API | **200** | CC0, but realistic/high-poly style — rejected on style, not availability. |
| **`github.com/shorepine/kenney`** | **200, 4 812 `.glb` files, 40 kits** | Verified genuine Kenney CC0 kits already exported to GLB, per-kit folders. **Chosen source.** |

**Chosen library: Kenney 3D kits** (CC0 1.0, one author, one visual language:
flat-colour low-poly, bevelled, no textures, 100–900 tris). One artist means the
brief's consistency rule is satisfied by construction.

- **Tokens (60):** `cube-pets` (animals), `car` (vehicles), `food`, `pirate`
  (chest, cannon, anchor-adjacent props), `holiday` (candy cane, present,
  dreidel), `space` (rocket), `furniture` (objects), `nature` (cactus, tree),
  `marble`, `mini-market`, `castle`, `train`, `watercraft`.
- **Buildings (7 types):** `city-suburban` and `city-commercial` houses/blocks,
  `mini-market` shopfront, `building` mid-rises, `fantasy-town` landmark tower.
- **Props:** `pirate` palms + `nature` plants for the table edge; `pirate` bars
  for the jail cell.

Each model is downloaded by script, recorded in `assets/models/manifest.json`
with source URL, author (`Kenney`), kit and licence (`CC0-1.0`), normalised by
`scripts/normalize-model.ts`, and listed in `CREDITS.md`. **No model is made by
hand or procedurally**; `scripts/check-no-handmade-models.js` fails the build on
any primitive geometry outside `src/board/` and `src/ui/`.

---

## 5. Visual direction (decided from the study)

- **Board:** warm cream `#F3E4C4` field, dark walnut frame `#3E2A1E`, 1 px white
  tile seams, colour band on the inner edge, dark ink caps labels with tabular
  prices. Centre: a recessed plate carrying the logo, the two card decks and the
  dice tray.
- **Table:** deep felt `#2E6B4F` with a soft radial falloff, palms and low props
  at the corners only (never competing with the board).
- **Lighting:** warm key at 42° from upper-left (2048 shadows, bias −0.0004),
  cool hemisphere fill, warm rim from behind. ACES Filmic, sRGB, bloom only on
  emissive accents.
- **UI:** glass as a functional layer — top status capsule, bottom action bar,
  left player rail, bottom sheets. Content (settings, tile cards) sits on solid
  warm surfaces inside the sheet, per Apple's rule. Inter for UI and board
  numerals, Outfit for display/logo.
- **One bold moment:** the red-orange ribbon banner that announces ROLL / RENT /
  PURCHASE, echoing Monopoly Go, used sparingly.

---

## 6. Risks

1. **Scope.** The brief describes a 12-phase online game. Risk: shipping breadth
   without depth. Mitigation: strict phase order, every shipped control wired,
   anything unfinished named in the final report rather than stubbed in the UI.
2. **Model count vs. quality.** 60 tokens can read as a junk drawer. Mitigation:
   one author, one normalisation pass (same scale, same material family, same
   pedestal), and a thumbnail grid that renders the actual models.
3. **Text fitting.** 40 tiles × 2 labels × 4 resolutions is a real failure mode.
   Mitigation: measured fitting with opentype.js + a headless test that asserts
   every label's box fits its content box.
4. **Server authority.** Simultaneous purchases and idempotent replays are easy
   to get subtly wrong. Mitigation: single-threaded event loop + a version check
   per tile inside one transaction, plus a two-client Playwright race test.
5. **WebGL in headless Chromium.** Screenshots may fall back to software GL.
   Mitigation: `--use-gl=angle --use-angle=swiftshader` if needed; any capture
   that cannot render is reported as unverified, never faked.
6. **Audio licensing.** Music must be CC0 and seamless. If no suitable loop
   downloads, the game ships with synthesised SFX plus a synthesised music bed
   generated at runtime, credited as such — no pirated audio, ever.

---

## 7. Phase plan

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Audit, references, skills | **Done** (this file) |
| 2 | Vite + three scaffold, renderer, camera rig | **Done** |
| 3 | Models: download, normalise, manifest, credits, build check | **Done** — 83 Kenney GLBs |
| 4 | Board geometry + text fitting + test | **Done** — 161 fit cases |
| 5 | Token selector, buildings, placement | **Done** |
| 6 | UI system + all panels + settings | **Done** |
| 7 | Audio | **Done** — synthesised |
| 8 | Server: authority, atomicity, sync, persistence | **Done** |
| 9 | Economy: mortgage, loans, stocks, theft | **Done** |
| 10 | Reputation, jail, detective, lawsuits | **Done** |
| 11 | QA, screenshots, fixes | **Done** — 8 journey tests, 20 screen captures, measured load and frame time; see FINAL_REPORT.md §5 |
| 12 | Final report | **Done** — `FINAL_REPORT.md` |

## 8. What changed against this audit during the build

- **Server build:** Node 26 type-stripping could not resolve extensionless TS imports,
  so the server is bundled by `scripts/build-server.mjs` into `dist-server/index.js`.
  The note in §3 that "the server needs no build step" is superseded.
- **Models:** final count is 83 (72 tokens, 7 buildings, 4 props), all Kenney CC0 via
  the `shorepine/kenney` mirror; textures were embedded per kit so no sidecar PNGs are
  requested at runtime.
- **Dice:** no licensed die model was found, so dice are HUD pips, not 3D objects.
- **Audio:** the loop and all SFX are synthesised in WebAudio instead of a downloaded
  CC0 track; nothing third-party is shipped.
- **Board framing:** camera radius is 22.5 and the board keeps ~12% vertical margin so
  the top ribbon never covers it, instead of a literal 6% margin.
- **Buildings:** scaled to 0.5 and offset to the inner half of the tile so they never
  cover tile names or prices, per the brief.
- **References:** only one genuine Monopoly Go gameplay image exists in
  `ReferencePics`; the rest are mislabelled, HTML bookmarks or empty files. Official
  Google Play screenshots were studied as the primary reference.

## 9. Post-build verification (2026-11-07)

- `npm test` exit 0: model check plus **199/199** Vitest cases.
- Isolated Playwright flows on port 8790, `BOTS=0`: **8/8 passed** for rent evasion
  (success/caught), jail release, detective evidence, settlement, court win/loss and
  theft. The database is reset before each test; the live 8787 world was untouched.
- `tests/e2e/screens.spec.ts`: **20/20 captures** at 1280×720, 1920×1080, 2560×1440 and
  2560×1080. Review fixed fixed-height sheet dead space, 720p building clipping and a
  duplicate tile title.
- Cold load: 1,140 ms to ready / 3,506 ms wall-cold / 2,968 KB transferred; packaged
  Chromium reached ready in 349 ms. The 5-second target is met.
- Hardware frame time on the packaged Chromium, RTX 5060, 1920×1080 DPR 1, high quality:
  73.3 FPS average, 13.65 ms average, 13.5 ms p95, zero frames over 33 ms in 300
  samples. Evidence in `screenshots/perf-hardware.json`.
- Models were meshopt-compressed from 7.62 MB to 2.76 MB; thumbnails and their WebGL
  renderer are lazy. Headless SwiftShader frame results are explicitly not treated as a
  hardware 60 FPS verdict.
- Interaction fixes found by the scripted pass: tile picking now follows the click point
  (touch-safe), and the HUD no longer intercepts board clicks.
- Still unverified: 4-human session, audio by ear, reconnect mid-court, 60-building cap,
  manual camera controls, browser mortgage/loan/stock actions, integrated-GPU and DPR 2
  frame time.

