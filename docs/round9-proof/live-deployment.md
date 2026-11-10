# Round 9 live deployment proof — 2026-11-10

Client: `https://pataratsee.github.io/Chromonopoly/`

Server: `https://chromonopoly-server.onrender.com`

Repository: `https://github.com/Pataratsee/Chromonopoly`

## Deployments

| Commit | Result |
|---|---|
| `94dfbfb` | GitHub Pages deployed successfully. Render build succeeded, then the service exited 1 while restoring the Round 8 save. |
| `d113086` | Render deployed successfully; live with protocol 3. |

The first Render failure was:

```text
TypeError: Cannot read properties of undefined (reading 'length')
    at groupBuildingCount (.../dist-server/index.js:4256:78)
    at World.restore (.../dist-server/index.js:6280:26)
```

Round 8 saved `TileState.building`; Round 9 expects `TileState.buildings[]`. `restoreTile()` now
converts the old flag to one rank-1 building, fills missing tile fields and marks restored seats
offline. A legacy seat without a token is claimed by its first token-bearing Round 9 join.
Regression: `tests/world.test.ts` — “restores a Round 8 building flag and lets its seat be claimed”.

## Live health after the fix

```json
{
  "ok": true,
  "players": 2,
  "online": 0,
  "soloTables": 1,
  "version": "d113086415568a28680c946b02aa2fb3d93324ae",
  "protocol": 3
}
```

The restored players confirm the old database was read without a startup crash. `uptime` and `seq`
are intentionally omitted because they change on every request.

## Live browser smoke test

- Loaded the deployed Pages client (`assets/index-BmUSN0eL.js`) and the 3D menu.
- Cleared the pre-fix console buffer, then started Single Player → New Game.
- `GET /api/solo?key=…` returned 200. The table showed LiveProbe77 at $1,500 plus Mr. Ledger,
  Penny Sharp and Count Deed, with “Your turn”.
- Clicked ROLL. The HUD showed “YOU ROLLED 2 + 3”; the roll button disabled and the offer resolved.
- Mr. Ledger then rolled 5 + 1 and the board advanced to the bot turn. The new session produced no
  console exceptions and no failed requests.

## Not proven by this live smoke test

- The full eight-scenario Playwright suite was not replayed after the hotfix; it passed on `94dfbfb`
  before the migration change. The hotfix only touches server restore/claim behavior, and the full
  248-test unit suite plus typecheck and production build passed after it.
- Multiplayer was not separately opened on the live origin after the hotfix.
- No physical low-end device or iOS/Safari run.
