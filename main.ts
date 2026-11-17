// Lentera — Penjaga Cahaya: a best-game-01 entry (Node 22, standard library only). The game is
// this directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and the program hands
// it in. It copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// The game: you are a small lantern spirit flying through a twilight valley, gathering light
// orbs, dodging shadow wisps, keeping your light alive. Title screen, score, combo, lives,
// levels, light meter, burst, pause, game over and restart, synth sound, no libraries.
// Put 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;

function fail(message) {
  throw new Error(`Lentera build: ${message}`);
}

// Fail fast when the game itself is missing, so a broken entry never ships silently.
if (!existsSync(join(here, 'game', 'index.html'))) fail('game/index.html is missing');

// Screenshots are what the judge sees first: require 1-4, each within the 256 KiB cap.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shots = readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name)).sort();
if (shots.length === 0) fail('screenshots/ holds no PNG or JPEG file');
if (shots.length > MAX_SCREENSHOTS) fail(`screenshots/ holds ${shots.length} images, at most ${MAX_SCREENSHOTS} allowed`);
const shotBytes = shots.map((name) => {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > MAX_SCREENSHOT_BYTES) fail(`${name} is ${bytes} bytes, over the ${MAX_SCREENSHOT_BYTES} byte cap`);
  return { name, bytes };
});

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Lentera build: game/ copied, ${shots.length} screenshot(s) (${shotBytes.map((s) => `${s.name} ${s.bytes}B`).join(', ')}), dossier.json written to ${out}`);
