#!/usr/bin/env node
/** Regenerates CREDITS.md from the model manifest, so credits cannot drift. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'public/assets/models/manifest.json'), 'utf8'));

const rows = manifest.assets
  .slice()
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  .map(
    (a) =>
      `| ${a.kind} | ${a.name} | ${a.author} | [${a.file}](${a.sourceUrl}) | ${a.license} | Re-materialed into the shared family, pivoted and scaled at load |`,
  );

const md = `# Credits

Chromonopoly ships **only downloaded, licensed 3D models**. No model in this
project was authored, sculpted, generated or assembled by the developer. The
flat board, its tiles, owner rings and the entire interface are geometry allowed
by the brief; every token, building and prop is a file from the manifest below.

## 3D models

All models are by **${manifest.author}**, released under **${manifest.license}**
(${manifest.licenseUrl ?? 'https://creativecommons.org/publicdomain/zero/1.0/'}).
Files are mirrored from the author's own kit archives via the
[kenney mirror](https://github.com/shorepine/kenney); each entry records the
exact source page used.

| Kind | Name | Author | Source | Licence | Modifications |
|---|---|---|---|---|---|
${rows.join('\n')}

Every modification is limited to the four permitted kinds: scale, rotation,
pivot recentring and material recolouring. No geometry was edited.

## Fonts

| Font | Author | Source | Licence |
|---|---|---|---|
| Inter (variable) | Rasmus Andersson | https://github.com/rsms/inter | SIL Open Font License 1.1 |
| Outfit (variable) | Smartsheet / Rodrigo Fuenzalida | https://fonts.google.com/specimen/Outfit | SIL Open Font License 1.1 |

Both are self-hosted in \`public/fonts/\`. The board renders SDF text with
[troika-three-text](https://github.com/protectwise/troika) and measures glyphs
with [opentype.js](https://opentype.js.org/).

## Audio

All music and sound effects are **synthesised at runtime** by
\`src/audio/audio.ts\` (Web Audio oscillators, filtered noise and a compressor).
No sampled or third-party audio is shipped, so there is nothing to license and
the loop is seamless by construction. The soundtrack is an original
I–vi–IV–V progression at 120 BPM.

## Icons and UI

Interface icons are a small hand-authored inline SVG set in
\`src/ui/ui.ts\` (stroke icons, MIT-equivalent use). No icon pack was copied.

## Libraries

| Library | Licence |
|---|---|
| three.js | MIT |
| troika-three-text | MIT |
| opentype.js | MIT |
| Vite | MIT |
| Vitest | MIT |
| ws | MIT |
| @gltf-transform/* | MIT |
| Playwright | Apache-2.0 |
`;

await writeFile(path.join(ROOT, 'CREDITS.md'), md);
console.log(`CREDITS.md written with ${manifest.assets.length} licensed models.`);
