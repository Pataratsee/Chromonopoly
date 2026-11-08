# Audio audit

All sound is synthesised at runtime by `src/audio/audio.ts`; there are no sampled
files. There is exactly one looping sound: the music bed. It contains no percussion.
The old eighth-note noise shaker was removed because it sounded like a looping
drum SFX and ran on the music toggle, not the SFX toggle. Every other sound is a
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
| shaker / drum | Deleted from the music bed in Round 7. It was an unpitched noise burst on every eighth note, indistinguishable from a looping drum effect. |
| `mortgage` | Mortgage is covered by the generic `cash`/`spend` event; the unused sample is retained only in the synth table. |
| `gavel` | The verdict cue uses `verdict`; the separate gavel cue is not wired to a control. |

## Music

`AudioEngine.startMusic()` starts one 8-bar, 120 BPM interval. It is the only
looping sound. `stopMusic()` clears the interval; toggling Music off or muting the
browser calls it through `setMusicOn()`. The music ducking path only changes gain,
never starts another interval.

## SFX on/off gate

`AudioEngine.play()` returns before any node is created when `sfxOn` is false.
`blip()` and `noise()` repeat that check at the node level. `setSfxOn(false)`
stops every source tracked in `sfxNodes` and clears the set. The saved setting is
applied in `src/main.ts` before the first pointer/key gesture, so a reload cannot
briefly play SFX. Music has its own toggle and its own bus; the SFX switch never
stops or starts the music interval.

## Loop / retrigger regression check

The previous click/tick loop came from interaction feedback being fired by state
updates rather than by a user action. The current tree has:

- no `pointerover`, `mouseover`, `animationiteration` or `setInterval` audio call;
- no audio call inside `render()`, `update()` or `event()` except the explicit
  event-kind branches above;
- only one `audio.play('dice')` and one `audio.play('click')` call site.

Static audit commands used (Round 7 rerun):

```bash
rg -n "audio\\.play|setInterval|pointerover|mouseover|animationiteration" src
rg -n "audio\\.play\\('(click|hover|dice|hop|cash|spend|purchase|build|mortgage|card|jail|fail|detective|gavel|verdict|victory)'" src
```

Result: all `audio.play` call sites are event handlers; the only interval is the
music loop in `AudioEngine.startMusic()`. There is no drum/shaker call.

## Round 7 runtime proof

**Verified** in `docs/round7-proof/audio-10min.log`, `audio-toggle.log` and
`audio-music-toggle.log`.

- Left SFX off for the full 10 minutes while music ran: `elapsed=600s`,
  `buffers=0` (no SFX buffer was created), 2,888 music oscillators, 2,888 stops,
  no page errors.
- Turned SFX on and triggered one roll: `buffers=1`; switching SFX off then
  stopped the one source still in flight.
- Switched music off while SFX stayed on: oscillator delta was 0 over 5 seconds
  with 0 SFX buffers, so the music interval and the SFX bus are independent.
- The 10-minute script's post-run Settings click was blocked by a chance overlay;
  the two toggle checks above are separate runs and do not depend on that click.
- The only looping sound remains the music bed; the removed shaker was its
  eighth-note noise burst, which is why the old bed sounded like a drum loop.
