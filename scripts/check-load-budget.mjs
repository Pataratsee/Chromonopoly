#!/usr/bin/env node
/**
 * Y1 hard gate: the JavaScript the browser must parse before the menu paints.
 * Vite writes one entry today; if it is split, every modulepreload is counted.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 300 * 1024;
const html = readFileSync('dist/index.html', 'utf8');
const refs = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
if (!refs.length) throw new Error('No JavaScript entry found in dist/index.html');

let total = 0;
for (const ref of refs) {
  const file = join('dist', ref.replace(/^\.?\//, ''));
  const bytes = statSync(file).size;
  const gz = gzipSync(readFileSync(file), { level: 9 }).length;
  total += gz;
  console.log(`${ref}: ${(bytes / 1024).toFixed(1)} kB, ${(gz / 1024).toFixed(1)} kB gzip`);
}
console.log(`Initial JS gzip: ${(total / 1024).toFixed(1)} kB / ${(LIMIT / 1024).toFixed(0)} kB budget`);
if (total > LIMIT) {
  console.error(`FAIL: initial JavaScript exceeds the Y1 budget by ${((total - LIMIT) / 1024).toFixed(1)} kB gzip.`);
  process.exit(1);
}
console.log('PASS: initial JavaScript is within the Y1 budget.');
