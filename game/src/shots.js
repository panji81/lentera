// The screenshot scenes behind ?shot=start|play|play2|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same frame. The careful
// pilot steers to the nearest orb, keeps clear of wisps and bursts when one closes in; the end
// scene's pilot only chases orbs and re-aims four times a second, so it is caught out once the
// wisps speed up, as a hurried player is.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
/** A wisp closer than this pushes the careful pilot away. */
const AVOID_RADIUS = 150;
/** A wisp closer than this is worth a burst. */
const BURST_RADIUS = 120;

function nearestOrb(state) {
  let best = null;
  let bestD2 = Infinity;
  for (const orb of state.orbs) {
    if (!orb.active) continue;
    const dx = orb.x - state.player.x;
    const dy = orb.y - state.player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = orb;
    }
  }
  return best;
}

/** Steer toward the nearest orb; add a push away from every close wisp; burst if one is near. */
function carefulPilot(state) {
  const player = state.player;
  let ax = 0;
  let ay = 0;
  const orb = nearestOrb(state);
  if (orb !== null) {
    ax += orb.x - player.x;
    ay += orb.y - player.y;
  } else {
    ax += FIELD.width / 2 - player.x;
    ay += FIELD.height / 2 - player.y;
  }
  let burst = false;
  for (const wisp of state.wisps) {
    if (!wisp.active) continue;
    const dx = player.x - wisp.x;
    const dy = player.y - wisp.y;
    const d = Math.hypot(dx, dy);
    if (d < AVOID_RADIUS) {
      const push = (AVOID_RADIUS - d) * 6;
      ax += (dx / (d || 1)) * push;
      ay += (dy / (d || 1)) * push;
    }
    if (d < BURST_RADIUS && state.light >= 18 && state.burstCooldown === 0) burst = true;
  }
  const length = Math.hypot(ax, ay) || 1;
  return { ax: ax / length, ay: ay / length, burst };
}

/** Chase the nearest orb and nothing else; the caller re-aims only every few steps. */
function carelessPilot(state) {
  const player = state.player;
  const orb = nearestOrb(state);
  const tx = orb === null ? FIELD.width / 2 : orb.x;
  const ty = orb === null ? FIELD.height / 2 : orb.y;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const length = Math.hypot(dx, dy) || 1;
  return { ax: dx / length, ay: dy / length, burst: false };
}

/**
 * Set `world` to the named scene (start, play, play2 or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'play2' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      const t = index * STEP;
      world.step(STEP, { ax: Math.sin(t * 0.4) * 0.5, ay: Math.cos(t * 0.3) * 0.4, burst: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const careless = name === 'end';
  let input = { ax: 0, ay: 0, burst: false };
  for (let index = 0; index < limit / STEP; index += 1) {
    if (careless ? index % 15 === 0 : true) input = careless ? carelessPilot(world.state) : carefulPilot(world.state);
    if (world.step(STEP, input, false) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
