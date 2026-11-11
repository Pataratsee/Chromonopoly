# Audio audit

## Music

Eight original instrumental cues ship as streamed files in `public/audio/`.
They were produced for this project and are dedicated to the public domain under
CC0-1.0. `public/audio/LICENSE.md` records the licence, duration and SHA-256 of
every Ogg Opus and AAC/M4A file.

| Track | Duration | Ogg Opus | AAC fallback |
|---|---:|---|---|
| Dawn Ledger | 140.0 s | 1.8 MB | 1.7 MB |
| Quiet Harbor | 144.0 s | 1.9 MB | 1.8 MB |
| Sunday Market | 137.1 s | 1.9 MB | 1.7 MB |
| Amber Window | 139.0 s | 1.8 MB | 1.7 MB |
| Slow Auction | 137.1 s | 1.7 MB | 1.6 MB |
| Riverstone | 154.8 s | 2.0 MB | 1.9 MB |
| Paper Skies | 138.0 s | 1.9 MB | 1.7 MB |
| Late Harvest | 130.9 s | 1.7 MB | 1.6 MB |

- Playback uses `HTMLAudioElement` media sources into the Web Audio graph, so
  tracks stream and are not decoded at boot.
- The browser selects Opus when `canPlayType('audio/ogg; codecs="opus"')` is
  supported, otherwise AAC/M4A.
- A 2.2-second equal-power crossfade runs between tracks.
- Shuffle never repeats a track until the current eight-track deck is empty.
- Music, master and SFX volumes have independent buses; court dialogue and
  menus duck music rather than stopping or restarting it.
- The music element is created lazily after a user gesture, so autoplay policy
  does not produce a console error.
- Skipping tracks and changing track are serialised through the same media
  element; a second player is never created.

## Sound effects

SFX remain original Web Audio synthesis. `AudioEngine.play()` creates one voice
per explicit game event and returns immediately when SFX is off. There is no
hover, polling or animation-triggered SFX loop.

| Sound | Trigger |
|---|---|
| `dice` | Local player presses Roll / Space |
| `hop` | Local `move` event |
| `cash` / `spend` | Local positive / negative cash event |
| `purchase` | Local purchase event |
| `build` | Local build event |
| `card` | Local Chance / Community Chest card |
| `jail` / `fail` | Local jail / failed action |
| `detective` | Local detective report |
| `verdict` | Local court verdict |
| `victory` | Game-over event |
| `click` | Camera controls and committed volume sliders |

## Runtime evidence

`docs/round10-proof/x12-music-runtime.json` records the live streamed track state
from the Round 10 browser pass. Subjective listening quality was not auditioned
in the headless proof environment; file formats, durations, checksums,
licensing, lazy loading and crossfade implementation are verified.
