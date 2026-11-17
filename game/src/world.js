// The game's rules and state, with no drawing and no browser in it: the lantern spirit, the
// pools of rising light-orbs and drifting shadow-wisps, the light meter, burst, combo, score,
// lives and level. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import { BURST, COMBO, FIELD, LEVEL, LIGHT, LIVES, ORB, PLAYER, POOL, WISP } from './config.js';

export const KIND_ORB = 0;
export const KIND_WISP = 1;

export const EVENT_COLLECT = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_BURST = 8;
export const EVENT_LEVEL = 16;
export const EVENT_LIGHT = 32;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, invulnerable: 0 };
  const orbs = [];
  for (let index = 0; index < POOL.orbs; index += 1) {
    orbs.push({ active: false, x: 0, baseX: 0, y: 0, speed: 0, swayAmp: 0, swayFreq: 0, phase: 0 });
  }
  const wisps = [];
  for (let index = 0; index < POOL.wisps; index += 1) {
    wisps.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, swayAmp: 0, swayFreq: 0, phase: 0, homes: false });
  }
  const particles = [];
  for (let index = 0; index < POOL.particles; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, r: 255, g: 220, b: 120 });
  }
  const state = {
    player,
    orbs,
    wisps,
    particles,
    score: 0,
    best: 0,
    lives: LIVES,
    level: 1,
    elapsed: 0,
    light: LIGHT.max,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    burstCooldown: 0,
    orbTimer: 0,
    wispTimer: 0,
    trailTimer: 0,
    flash: 0,
    toast: '',
    toastTimer: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = 0;
    for (const orb of orbs) orb.active = false;
    for (const wisp of wisps) wisp.active = false;
    for (const particle of particles) particle.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.light = LIGHT.max;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.burstCooldown = 0;
    state.orbTimer = 0.4;
    state.wispTimer = 1.6;
    state.trailTimer = 0;
    state.flash = 0;
    state.toast = '';
    state.toastTimer = 0;
  }

  function freeOrb() {
    for (let index = 0; index < orbs.length; index += 1) if (!orbs[index].active) return orbs[index];
    return null;
  }

  function freeWisp() {
    for (let index = 0; index < wisps.length; index += 1) if (!wisps[index].active) return wisps[index];
    return null;
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function emit(x, y, vx, vy, life, size, r, g, b) {
    const particle = freeParticle();
    if (particle === null) return;
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.max = life;
    particle.size = size;
    particle.r = r;
    particle.g = g;
    particle.b = b;
  }

  /** A ring of sparks around (x, y); count and speed spread the burst. */
  function emitRing(x, y, count, speed, life, size, r, g, b) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + random() * 0.5;
      const v = speed * (0.5 + random() * 0.7);
      emit(x, y, Math.cos(angle) * v, Math.sin(angle) * v, life * (0.6 + random() * 0.6), size, r, g, b);
    }
  }

  function spawnOrb(anywhere) {
    const orb = freeOrb();
    if (orb === null) return;
    orb.active = true;
    orb.baseX = 40 + random() * (FIELD.width - 80);
    orb.x = orb.baseX;
    orb.y = anywhere ? random() * FIELD.height : FIELD.height + 24;
    orb.speed = ORB.riseMin + random() * ORB.riseJitter + ORB.risePerLevel * (state.level - 1);
    orb.swayAmp = 20 + random() * 30;
    orb.swayFreq = 0.8 + random() * 0.8;
    orb.phase = random() * Math.PI * 2;
  }

  function spawnWisp() {
    let active = 0;
    for (const wisp of wisps) if (wisp.active) active += 1;
    if (active >= Math.min(4 + state.level, WISP.maxActive)) return;
    const wisp = freeWisp();
    if (wisp === null) return;
    wisp.active = true;
    const edge = random();
    const speed = WISP.speedMin + random() * WISP.speedJitter + WISP.speedPerLevel * (state.level - 1);
    if (edge < 0.4) {
      wisp.x = -30;
      wisp.y = 80 + random() * (FIELD.height - 160);
      wisp.vx = speed;
      wisp.vy = 0;
    } else if (edge < 0.8) {
      wisp.x = FIELD.width + 30;
      wisp.y = 80 + random() * (FIELD.height - 160);
      wisp.vx = -speed;
      wisp.vy = 0;
    } else {
      wisp.x = 80 + random() * (FIELD.width - 160);
      wisp.y = -30;
      wisp.vx = (random() - 0.5) * speed;
      wisp.vy = speed * 0.6;
    }
    wisp.swayAmp = 14 + random() * 22;
    wisp.swayFreq = 0.7 + random() * 0.9;
    wisp.phase = random() * Math.PI * 2;
    wisp.homes = state.level >= 3 && random() < 0.3;
  }

  function orbInterval() {
    return Math.max(ORB.minInterval, ORB.interval * ORB.intervalScale ** (state.level - 1));
  }

  function wispInterval() {
    return Math.max(WISP.minInterval, WISP.interval * WISP.intervalScale ** (state.level - 1));
  }

  function loseLife(events, why) {
    state.lives -= 1;
    player.invulnerable = PLAYER.invulnerable;
    if (state.lives <= 0) return events | EVENT_OVER;
    return events | why;
  }

  function doBurst() {
    state.light -= LIGHT.burstCost;
    state.burstCooldown = BURST.cooldown;
    state.flash = 1;
    emitRing(player.x, player.y, 26, 260, 0.5, 3, 255, 220, 130);
    let events = EVENT_BURST;
    for (const wisp of wisps) {
      if (!wisp.active) continue;
      const d2 = dist2(wisp, player);
      if (d2 < BURST.radius * BURST.radius) {
        wisp.active = false;
        state.score += BURST.dissolvePoints;
        emitRing(wisp.x, wisp.y, 8, 120, 0.45, 3, 180, 140, 220);
      } else if (d2 < BURST.pushRadius * BURST.pushRadius) {
        const d = Math.sqrt(d2) || 1;
        const push = 320 * (1 - d / BURST.pushRadius);
        wisp.vx += ((wisp.x - player.x) / d) * push;
        wisp.vy += ((wisp.y - player.y) / d) * push;
      }
    }
    return events;
  }

  /**
   * One fixed step. `input` is {ax, ay} in [-1, 1] plus an optional `burst` flag. With
   * `harmless` set (the title screen's backdrop) things drift but nothing touches the player
   * and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      state.toast = `Level ${level} — bayang makin cepat`;
      state.toastTimer = 2.2;
      events |= EVENT_LEVEL;
    }
    if (state.toastTimer > 0) state.toastTimer = Math.max(0, state.toastTimer - dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 3);
    if (state.burstCooldown > 0) state.burstCooldown = Math.max(0, state.burstCooldown - dt);
    if (state.comboTimer > 0) {
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer === 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    // Steering: accelerate toward the input, friction when it lets go, clamp to the field.
    player.vx += input.ax * PLAYER.accel * dt;
    player.vy += input.ay * PLAYER.accel * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    if (input.ax === 0) {
      const stop = Math.min(Math.abs(player.vx), PLAYER.friction * dt);
      player.vx -= Math.sign(player.vx) * stop;
    }
    if (input.ay === 0) {
      const stop = Math.min(Math.abs(player.vy), PLAYER.friction * dt);
      player.vy -= Math.sign(player.vy) * stop;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // Sparkle trail while the lantern moves.
    state.trailTimer -= dt;
    if (speed > 60 && state.trailTimer <= 0) {
      state.trailTimer = 0.04;
      emit(player.x, player.y + 10, -player.vx * 0.08 + (random() - 0.5) * 30, 30 + random() * 30, 0.55, 2.5, 255, 205, 110);
    }

    // Spawning.
    state.orbTimer -= dt;
    if (state.orbTimer <= 0) {
      spawnOrb(false);
      state.orbTimer += orbInterval();
    }
    if (!harmless) {
      state.wispTimer -= dt;
      if (state.wispTimer <= 0) {
        spawnWisp();
        state.wispTimer += wispInterval();
      }
    }

    // Burst, before collisions so a burst at the last moment still saves the lantern.
    if (!harmless && input.burst && state.burstCooldown === 0 && state.light >= LIGHT.burstCost) {
      events |= doBurst();
    }

    // The light drains; empty light costs a life and the lantern relights at half.
    if (!harmless) {
      state.light -= LIGHT.drainPerSecond * dt;
      if (state.light <= 0) {
        state.light = LIGHT.respawn;
        events |= loseLife(events, EVENT_LIGHT);
        if (events & EVENT_OVER) return events;
      }
    }

    // Orbs rise with a sway; a touch collects one.
    const collectD2 = (PLAYER.radius + ORB.radius) * (PLAYER.radius + ORB.radius);
    for (const orb of orbs) {
      if (!orb.active) continue;
      orb.y -= orb.speed * dt;
      orb.x = orb.baseX + Math.sin(state.elapsed * orb.swayFreq + orb.phase) * orb.swayAmp;
      if (orb.y < -30) {
        orb.active = false;
        continue;
      }
      if (harmless) continue;
      if (dist2(orb, player) < collectD2) {
        orb.active = false;
        state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
        state.comboTimer = COMBO.window;
        state.multiplier = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / COMBO.perStep));
        state.score += ORB.points * state.multiplier;
        state.light = Math.min(LIGHT.max, state.light + LIGHT.orbGain);
        emitRing(orb.x, orb.y, 8, 110, 0.4, 2.5, 255, 220, 110);
        events |= EVENT_COLLECT;
      }
    }

    // Wisps drift (some home in at higher levels); a touch costs a life.
    const hitD2 = (PLAYER.radius + WISP.radius - 6) * (PLAYER.radius + WISP.radius - 6);
    for (const wisp of wisps) {
      if (!wisp.active) continue;
      if (wisp.homes && !harmless) {
        const dx = player.x - wisp.x;
        const dy = player.y - wisp.y;
        const d = Math.hypot(dx, dy) || 1;
        wisp.vx += (dx / d) * WISP.homeAccel * dt;
        wisp.vy += (dy / d) * WISP.homeAccel * dt;
        const ws = Math.hypot(wisp.vx, wisp.vy);
        if (ws > WISP.homeSpeed) {
          wisp.vx = (wisp.vx / ws) * WISP.homeSpeed;
          wisp.vy = (wisp.vy / ws) * WISP.homeSpeed;
        }
      }
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt + Math.sin(state.elapsed * wisp.swayFreq + wisp.phase) * 14 * dt;
      if (wisp.x < -60 || wisp.x > FIELD.width + 60 || wisp.y < -60 || wisp.y > FIELD.height + 60) {
        wisp.active = false;
        continue;
      }
      if (harmless || player.invulnerable > 0) continue;
      if (dist2(wisp, player) < hitD2) {
        wisp.active = false;
        state.light = Math.max(0, state.light - LIGHT.hitLoss);
        const dx = player.x - wisp.x;
        const dy = player.y - wisp.y;
        const d = Math.hypot(dx, dy) || 1;
        player.vx += (dx / d) * 260;
        player.vy += (dy / d) * 260;
        emitRing(player.x, player.y, 14, 180, 0.5, 3, 170, 120, 220);
        events |= loseLife(events, EVENT_HIT);
        if (events & EVENT_OVER) return events;
      }
    }

    // Particles fade and drift.
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 2.4 * dt;
      particle.vy *= 1 - 2.4 * dt;
    }
    return events;
  }

  reset();
  // A fresh world starts with a few orbs already in the air, so the first frame is alive.
  for (let index = 0; index < 6; index += 1) spawnOrb(true);
  return { state, reset, step };
}
