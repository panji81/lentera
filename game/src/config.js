// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 24,
  accel: 2400,
  maxSpeed: 430,
  friction: 2000,
  invulnerable: 1.5,
};

export const LIVES = 3;

export const LIGHT = {
  max: 100,
  drainPerSecond: 2.2,
  orbGain: 14,
  burstCost: 18,
  hitLoss: 30,
  respawn: 50,
};

export const BURST = {
  radius: 180,
  pushRadius: 280,
  cooldown: 0.8,
  dissolvePoints: 5,
};

export const ORB = {
  radius: 13,
  points: 10,
  riseMin: 46,
  riseJitter: 26,
  risePerLevel: 4,
  interval: 0.9,
  intervalScale: 0.92,
  minInterval: 0.35,
};

export const WISP = {
  radius: 24,
  speedMin: 34,
  speedJitter: 26,
  speedPerLevel: 6,
  homeSpeed: 92,
  homeAccel: 36,
  interval: 2.4,
  intervalScale: 0.9,
  minInterval: 0.8,
  maxActive: 12,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 20, max: 10 };

/** Combo window in seconds; the multiplier grows one step per 5 chained orbs, to x5. */
export const COMBO = { window: 2.5, perStep: 5, maxMult: 5 };

/** Pool sizes; everything is allocated once, at boot. */
export const POOL = { orbs: 28, wisps: 16, particles: 256 };

export const PALETTE = {
  backdrop: '#171233',
  skyTop: '#171233',
  skyMid: '#3a2560',
  skyHorizon: '#e8965a',
  moon: '#f6e8c8',
  hillFar: '#2c2150',
  hillMid: '#241a44',
  hillNear: '#1a1236',
  cloud: '#8f7fb8',
  player: '#ffcf5c',
  playerCore: '#fff3c4',
  flame: '#ffb347',
  orb: '#ffd94d',
  orbCore: '#fff7cc',
  wisp: '#5b4a8a',
  wispEye: '#ff5f7a',
  firefly: '#ffe9a3',
  panel: '#221a45',
  panelEdge: '#6b52b3',
  text: '#f6efdd',
  muted: '#b9aed6',
  danger: '#ff5f7a',
  lightBar: '#ffc94d',
  lightBarLow: '#ff5f7a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lentera.best';
