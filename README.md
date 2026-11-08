# Chromonopoly

**Play:** [https://pataratsee.github.io/Chromonopoly/](https://pataratsee.github.io/Chromonopoly/)

Chromonopoly is a server-authoritative property board game for the browser. Buy streets, build skylines, and outlast three AI rivals in a turn-based solo table or everyone on the shared board.

The hosted game server can take up to a minute to wake after a period of inactivity.

## Local development

Requires Node.js 22.18 or newer.

```bash
npm ci
npm run dev:all
```

Open [http://localhost:5173/](http://localhost:5173/).

## Production

The frontend is built with Vite and deployed to GitHub Pages by the Pages workflow. The Node/WebSocket game server is hosted on Render. Set the repository Actions variable `VITE_GAME_SERVER_URL` to the game server's HTTPS origin before building the frontend.
