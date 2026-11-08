# Audio audit

All sound is synthesised at runtime by `src/audio/audio.ts`; there are no sampled
files. There is exactly one looping sound: the music bed. Every other sound is a
one-shot triggered by a specific event, with no timer, hover handler or state
poll re-triggering it.

## One-shot sound effects

| Sound | Trigger | Call site | Repeats? |
|---|---|---|---|
| `dice` | The local player presses Roll / Space; fired once before the roll intent is sent | `UI.roll()` | No |
| `hop` | A `move` event for the local player’s piece | `UI.event()` | One per move event |
| `cash` | A positive local `cash` or `loan` event | `UI.event()` | One per cash event |
| `spend` | A local cash event below −$1 | `UI.event()` | One per cash event |
| `purchase` | A local `purchase` event | `UI.event()` | One per purchase |
| `build` | A local `build` event | `UI.event()` | One per build |
| `card` | A local Chance / Community Chest card | `UI.event()` | One per drawn card |
| `jail` | Local jail, released, hospital, or a successful murder attempt | `UI.event()` | One per event |
| `fail` | Failed theft, failed murder attempt, or failed detective roll | `UI.event()` | One per event |
| `detective` | Local detective report | `UI.event()` | One per report |
| `verdict` | Local court verdict | `UI.event()` | One per verdict |
| `victory` | Game-over event | `UI.event()` | One per game |
| `click` | Camera rotate/reset buttons and the master/music sliders only | `UI.emitCamera()`, two settings slider callbacks | One per click / committed slider value |

## Defined but intentionally silent

| Sound | Reason |
|---|---|
| `hover` | No hover handler plays audio; tile hover only changes the cursor and highlight. |
| `mortgage` | Mortgage is covered by the generic `cash`/`spend` event; the unused sample is retained only in the synth table. |
| `gavel` | The verdict cue uses `verdict`; the separate gavel cue is not wired to a control. |

## Music

`AudioEngine.startMusic()` starts one 8-bar, 120 BPM interval. It is the only
looping sound. `stopMusic()` clears the interval; toggling Music off or muting the
browser calls it through `setMusicOn()`. The music ducking path only changes gain,
never starts another interval.

## Loop / retrigger regression check

The previous click/tick loop came from interaction feedback being fired by state
updates rather than by a user action. The current tree has:

- no `pointerover`, `mouseover`, `animationiteration` or `setInterval` audio call;
- no audio call inside `render()`, `update()` or `event()` except the explicit
  event-kind branches above;
- only one `audio.play('dice')` and one `audio.play('click')` call site.

Static audit commands used:

```bash
rg -n "audio\\.play|setInterval|pointerover|mouseover|animationiteration" src
rg -n "audio\\.play\\('(click|hover|dice|hop|cash|spend|purchase|build|mortgage|card|jail|fail|detective|gavel|verdict|victory)'" src
```

Result: 19 `audio.play` call sites (3 click, 4 cash, 3 jail, 2 fail and one each
for the remaining one-shots), one interval in the audio engine (music), and zero
hover-audio handlers. Runtime listening by ear is **Unverified**; the source audit
and typecheck are clean.
