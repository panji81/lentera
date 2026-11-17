// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|play2|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURST, EVENT_COLLECT, EVENT_HIT, EVENT_LEVEL, EVENT_LIGHT, EVENT_OVER } from './world.js';
import { ACTION_BURST, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, 5);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let burstQueued = false;

  // A handle for play-testing and debugging: the live state, screen and best score.
  window.__lentera = { world, get screen() { return screen; }, get best() { return best; } };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.start();
    announce(`Bermain. ${LIVES} nyawa. Kumpulkan cahaya, hindari bayang.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    sound.gameOver();
    announce(`Cahayamu padam. Skor ${world.state.score}. Terbaik ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions) sound.unlock();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Suara mati.' : 'Suara hidup.');
    }
    if (actions & ACTION_BURST) burstQueued = true;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Bermain.');
    }
  }

  /** Keyboard plus pointer steering, as one -1..1 vector for the world. */
  function steering() {
    const keys = input.keys();
    if (keys.x !== 0 || keys.y !== 0) {
      const length = Math.hypot(keys.x, keys.y) || 1;
      return { x: keys.x / length, y: keys.y / length };
    }
    const pointer = input.pointer();
    if (pointer !== null) {
      const dx = pointer.x - world.state.player.x;
      const dy = pointer.y - world.state.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 24) {
        const strength = Math.min(1, distance / 120);
        return { x: (dx / distance) * strength, y: (dy / distance) * strength };
      }
    }
    return { x: 0, y: 0 };
  }

  function step(burst) {
    if (screen === SCREEN_TITLE) {
      const t = world.state.elapsed;
      world.step(STEP, { ax: Math.sin(t * 0.4) * 0.5, ay: Math.cos(t * 0.3) * 0.4, burst: false }, true);
      return;
    }
    const steer = steering();
    const events = world.step(STEP, { ax: steer.x, ay: steer.y, burst }, false);
    if (events & EVENT_COLLECT) sound.collect(world.state.combo);
    if (events & EVENT_BURST) sound.burst();
    if (events & EVENT_LEVEL) sound.levelUp();
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) {
      sound.hit();
      announce(world.state.lives === 1 ? 'Kena bayang. 1 nyawa tersisa.' : `Kena bayang. ${world.state.lives} nyawa tersisa.`);
    } else if (events & EVENT_LIGHT) {
      sound.hit();
      announce('Cahaya habis. 1 nyawa hilang, lentera menyala lagi.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    const burst = burstQueued;
    burstQueued = false;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(burst);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting the light drain unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Lentera, Penjaga Cahaya. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
