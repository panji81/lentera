// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. The valley
// is procedural: a gradient twilight sky, twinkling seeded stars, a glowing moon, drifting clouds,
// three parallax hill layers, wandering fireflies, and the lantern spirit itself with a flickering
// flame, a radial glow and a sparkle trail. Text that holds a number is rebuilt only when the
// number changes, so a frame allocates nothing.
import { FIELD, FONT, LIVES, PALETTE } from './config.js';
import { KIND_ORB } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 140, line: 32, bottom: 72 };
const LIFE_SIZE = 26;
const LIFE_GAP = 10;
/** The scenery's own seed: the valley looks the same in every game, only the play changes. */
const SCENERY_SEED = 20261117;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** A hill layer: a ridge of sine bumps across a span wider than the field, for parallax. */
function makeHill(random, baseY, amp1, amp2) {
  const points = [];
  const phase1 = random() * Math.PI * 2;
  const phase2 = random() * Math.PI * 2;
  const span = FIELD.width + 400;
  for (let x = -200; x <= span - 200; x += 20) {
    points.push({
      x,
      y: baseY + Math.sin(x * 0.004 + phase1) * amp1 + Math.sin(x * 0.011 + phase2) * amp2,
    });
  }
  return points;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Skor ');
  const levelLabel = cachedLabel('Level ');
  const comboLabel = cachedLabel('Combo ');
  const finalLabel = cachedLabel('Skor ');
  const bestLabel = cachedLabel('Terbaik ');
  let skyGradient = null;
  let moonGlow = null;

  const scenery = createRandom(SCENERY_SEED);
  const stars = [];
  for (let index = 0; index < 110; index += 1) {
    stars.push({
      x: scenery() * FIELD.width,
      y: scenery() * 380,
      size: 0.6 + scenery() * 1.6,
      phase: scenery() * Math.PI * 2,
      speed: 0.6 + scenery() * 1.8,
    });
  }
  const hills = [
    { points: makeHill(scenery, 560, 46, 18), color: PALETTE.hillFar, parallax: 0.02 },
    { points: makeHill(scenery, 610, 40, 16), color: PALETTE.hillMid, parallax: 0.04 },
    { points: makeHill(scenery, 668, 30, 12), color: PALETTE.hillNear, parallax: 0.06 },
  ];
  const clouds = [];
  for (let index = 0; index < 5; index += 1) {
    clouds.push({
      x: scenery() * FIELD.width,
      y: 60 + scenery() * 180,
      scale: 0.7 + scenery() * 0.9,
      drift: 4 + scenery() * 7,
    });
  }
  const fireflies = [];
  for (let index = 0; index < 24; index += 1) {
    fireflies.push({
      x: scenery() * FIELD.width,
      y: 380 + scenery() * 300,
      phase: scenery() * Math.PI * 2,
      speed: 0.3 + scenery() * 0.7,
      amp: 12 + scenery() * 26,
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    skyGradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    skyGradient.addColorStop(0, PALETTE.skyTop);
    skyGradient.addColorStop(0.55, PALETTE.skyMid);
    skyGradient.addColorStop(1, PALETTE.skyHorizon);
    moonGlow = context.createRadialGradient(1120, 108, 10, 1120, 108, 150);
    moonGlow.addColorStop(0, 'rgba(246, 232, 200, 0.55)');
    moonGlow.addColorStop(1, 'rgba(246, 232, 200, 0)');
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawSky(time) {
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of stars) {
      const alpha = 0.25 + 0.65 * Math.abs(Math.sin(time * star.speed + star.phase));
      context.globalAlpha = alpha;
      context.fillStyle = '#fff6d8';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    context.fillStyle = moonGlow;
    context.fillRect(950, -60, 340, 340);
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(1120, 108, 46, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(210, 190, 150, 0.5)';
    context.beginPath();
    context.arc(1106, 96, 9, 0, Math.PI * 2);
    context.arc(1134, 122, 12, 0, Math.PI * 2);
    context.arc(1112, 128, 6, 0, Math.PI * 2);
    context.fill();
    for (const cloud of clouds) {
      const cx = (((cloud.x + time * cloud.drift) % (FIELD.width + 320)) + FIELD.width + 320) % (FIELD.width + 320) - 160;
      context.fillStyle = PALETTE.cloud;
      context.globalAlpha = 0.16;
      context.beginPath();
      context.ellipse(cx, cloud.y, 74 * cloud.scale, 20 * cloud.scale, 0, 0, Math.PI * 2);
      context.ellipse(cx - 44 * cloud.scale, cloud.y + 8 * cloud.scale, 44 * cloud.scale, 15 * cloud.scale, 0, 0, Math.PI * 2);
      context.ellipse(cx + 46 * cloud.scale, cloud.y + 8 * cloud.scale, 48 * cloud.scale, 16 * cloud.scale, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawHills(playerX) {
    for (const hill of hills) {
      const shift = (playerX - FIELD.width / 2) * -hill.parallax;
      context.fillStyle = hill.color;
      context.beginPath();
      context.moveTo(hill.points[0].x + shift, hill.points[0].y);
      for (let index = 1; index < hill.points.length; index += 1) {
        context.lineTo(hill.points[index].x + shift, hill.points[index].y);
      }
      context.lineTo(hill.points[hill.points.length - 1].x + shift, FIELD.height);
      context.lineTo(hill.points[0].x + shift, FIELD.height);
      context.closePath();
      context.fill();
    }
  }

  function drawFireflies(time) {
    for (const firefly of fireflies) {
      const x = firefly.x + Math.sin(time * firefly.speed + firefly.phase) * firefly.amp;
      const y = firefly.y + Math.cos(time * firefly.speed * 0.8 + firefly.phase) * firefly.amp * 0.6;
      const alpha = 0.25 + 0.55 * Math.abs(Math.sin(time * 1.4 + firefly.phase * 2));
      context.globalAlpha = alpha * 0.35;
      context.fillStyle = PALETTE.firefly;
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x, y, 2.2, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawOrb(orb, time) {
    const cx = orb.x;
    const cy = orb.y;
    const pulse = 1 + Math.sin(time * 3 + orb.phase) * 0.12;
    const glow = context.createRadialGradient(cx, cy, 2, cx, cy, 34 * pulse);
    glow.addColorStop(0, 'rgba(255, 217, 77, 0.55)');
    glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, 34 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.orb;
    context.beginPath();
    context.arc(cx, cy, 12 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.orbCore;
    context.beginPath();
    context.arc(cx, cy, 6.5 * pulse, 0, Math.PI * 2);
    context.fill();
  }

  function drawWisp(wisp, time) {
    const wobble = Math.sin(time * 2.2 + wisp.phase) * 3;
    const cx = wisp.x;
    const cy = wisp.y + wobble;
    const glow = context.createRadialGradient(cx, cy, 4, cx, cy, 52);
    glow.addColorStop(0, 'rgba(91, 74, 138, 0.5)');
    glow.addColorStop(1, 'rgba(91, 74, 138, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, 52, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.wisp;
    context.beginPath();
    context.arc(cx - 8, cy + 4, 15, 0, Math.PI * 2);
    context.arc(cx + 9, cy - 2, 17, 0, Math.PI * 2);
    context.arc(cx, cy - 10, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#3a2d63';
    context.beginPath();
    context.arc(cx - 2, cy + 12, 13, 0, Math.PI * 2);
    context.fill();
    const eyeY = cy - 4 + Math.sin(time * 3 + wisp.phase) * 1.5;
    context.fillStyle = PALETTE.wispEye;
    context.beginPath();
    context.arc(cx - 7, eyeY, 3.4, 0, Math.PI * 2);
    context.arc(cx + 7, eyeY, 3.4, 0, Math.PI * 2);
    context.fill();
  }

  function drawLantern(x, y, scale, time, alpha) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.globalAlpha = alpha;
    const flicker = 1 + Math.sin(time * 13) * 0.06 + Math.sin(time * 29) * 0.04;
    const glow = context.createRadialGradient(0, 0, 4, 0, 0, 74);
    glow.addColorStop(0, 'rgba(255, 205, 95, 0.5)');
    glow.addColorStop(0.55, 'rgba(255, 180, 80, 0.18)');
    glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 74, 0, Math.PI * 2);
    context.fill();
    // Handle.
    context.strokeStyle = '#8a5a1e';
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(0, -20, 9, Math.PI, 0);
    context.stroke();
    // Body: a warm paper lantern with ribs.
    const body = context.createLinearGradient(-15, -18, 15, 18);
    body.addColorStop(0, '#ffe08a');
    body.addColorStop(0.5, '#ffcf5c');
    body.addColorStop(1, '#f0a832');
    context.fillStyle = body;
    context.beginPath();
    context.moveTo(-13, -16);
    context.quadraticCurveTo(0, -21, 13, -16);
    context.lineTo(16, 12);
    context.quadraticCurveTo(0, 19, -16, 12);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(138, 90, 30, 0.8)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-5, -18);
    context.lineTo(-6, 16);
    context.moveTo(5, -18);
    context.lineTo(6, 16);
    context.stroke();
    // Caps.
    context.fillStyle = '#8a5a1e';
    context.fillRect(-14, -20, 28, 5);
    context.fillRect(-14, 15, 28, 5);
    // Flame.
    context.fillStyle = PALETTE.flame;
    context.beginPath();
    context.ellipse(0, 0, 6 * flicker, 9 * flicker, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.ellipse(0, 1, 3.2 * flicker, 5 * flicker, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawParticles(state) {
    context.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      if (!particle.active) continue;
      const alpha = Math.max(0, particle.life / particle.max);
      context.globalAlpha = alpha;
      context.fillStyle = `rgb(${particle.r}, ${particle.g}, ${particle.b})`;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function drawField(state, time) {
    drawSky(time);
    drawHills(state.player.x);
    drawFireflies(time);
    for (const orb of state.orbs) if (orb.active) drawOrb(orb, time);
    for (const wisp of state.wisps) if (wisp.active) drawWisp(wisp, time);
    drawParticles(state);
    const player = state.player;
    const visible = player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1;
    if (visible) drawLantern(player.x, player.y, 1, time, 1);
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 240, 200, ${state.flash * 0.3})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    if (state.combo >= 2) {
      text(`${comboLabel(state.combo)}  ×${state.multiplier}`, 24, 56, 22, PALETTE.orb, 'left');
    }
    // Level and the light meter, centred.
    text(levelLabel(state.level), FIELD.width / 2, 18, 24, PALETTE.muted, 'center');
    const barWidth = 260;
    const barX = (FIELD.width - barWidth) / 2;
    const barY = 50;
    context.fillStyle = 'rgba(10, 6, 26, 0.55)';
    context.beginPath();
    context.roundRect(barX - 4, barY - 4, barWidth + 8, 22, 11);
    context.fill();
    const fraction = Math.max(0, state.light / 100);
    const low = fraction < 0.25;
    context.fillStyle = low ? PALETTE.lightBarLow : PALETTE.lightBar;
    context.beginPath();
    context.roundRect(barX, barY, Math.max(0, barWidth * fraction), 14, 7);
    context.fill();
    text('CAHAYA', FIELD.width / 2, 74, 13, low ? PALETTE.danger : PALETTE.muted, 'center');
    // Lives: little lanterns, top right.
    const firstLife = FIELD.width - 24 - LIVES * (LIFE_SIZE + LIFE_GAP) + LIFE_GAP;
    text('Nyawa', firstLife - 12, 18, 24, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      if (life < state.lives) drawLantern(firstLife + life * (LIFE_SIZE + LIFE_GAP) + LIFE_SIZE / 2, 36, 0.42, 0, 1);
      else drawLantern(firstLife + life * (LIFE_SIZE + LIFE_GAP) + LIFE_SIZE / 2, 36, 0.42, 0, 0.25);
    }
    // Level-up toast, fading.
    if (state.toastTimer > 0) {
      context.globalAlpha = Math.min(1, state.toastTimer);
      text(state.toast, FIELD.width / 2, 108, 26, PALETTE.orb, 'center');
      context.globalAlpha = 1;
    }
    // Burst cooldown: a small ring under the lantern while it recharges.
    if (state.burstCooldown > 0) {
      const player = state.player;
      context.strokeStyle = 'rgba(255, 217, 77, 0.7)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - state.burstCooldown / 0.8));
      context.stroke();
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20, 12, 44, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.orb, 'center');
  }

  const TITLE_LINES = [
    'Terbanglah menembus lembah senja. Kumpulkan cahaya,',
    'hindari bayang, dan jangan biarkan lentera padam.',
    'Gerak: WASD / panah / mouse',
    'Burst: Spasi / klik (18 cahaya)',
    'Jeda: P  ·  Suara: M',
    '',
  ];
  const PAUSED_LINES = ['Bayang-bayang menunggu dengan sabar.'];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state, time);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('LENTERA', TITLE_LINES, 'Tekan Spasi atau klik untuk mulai');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Jeda', PAUSED_LINES, 'Tekan P untuk lanjut');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Cahayamu Padam', OVER_LINES, 'Tekan Spasi atau klik untuk main lagi');
    }
  }

  /** Convert a client (mouse/touch) position to field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    return { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
