export interface Shockwave {
  x: number;
  y: number;
  start: number;
  power: number; // 0-1 charge multiplier
}

export interface ShockwaveOptions {
  shockwaveSpeed: number;
  shockwaveWidth: number;
  shockwaveStrength: number;
  shockwaveDuration: number;
}

export interface GridData {
  x: Float32Array;
  y: Float32Array;
  brightness: Float32Array;
  size: Float32Array;
  gridCount: number;
  maxDots: number;
  spacing: number;
  cols: number;
  rows: number;
}

export interface Obstacle {
  id: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  shape: ObstacleShape;
  shapeDots: [number, number][];
  shapeRadius: number;
  rotation: number;
  rotationSpeed: number;
  dotOffset: number;
  dotCount: number;
  brightness: number;
  tint: number;
  alive: boolean;
  hp: number;
  isPickup: boolean;
}

export type ObstacleShape = "diamond" | "cross" | "ring" | "arrow" | "cluster";

export type GamePhase = "menu" | "playing" | "gameover";

export interface GameState {
  phase: GamePhase;
  score: number;
  lives: number;
  level: number;
  elapsed: number;
  spawnTimer: number;
  spawnInterval: number;
  obstacles: Obstacle[];
  nextObstacleId: number;
  obstacleDotsUsed: number;
  maxObstacleDots: number;
  flashIntensity: number;
  flashType: "red" | "green";
  invulnTimer: number;
  chargeStart: number; // 0 = not charging, else performance.now() timestamp
  charging: boolean;
  playerSize: number;
  growTimer: number;
  pickupTimer: number;
  combo: number;
  comboTimer: number;
}

export interface RenderState {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  grid: GridData;
  renderX: Float32Array;
  renderY: Float32Array;
  renderBr: Float32Array;
  renderSize: Float32Array;
  renderTint: Float32Array;
  displaceX: Float32Array;
  displaceY: Float32Array;
  buckets: { indices: Int32Array[]; lengths: Int32Array };
  count: number;
  mouseX: number;
  mouseY: number;
  mouseActive: boolean;
  shockwaves: Shockwave[];
  _needsAnim: boolean;
  _hasDisplacement: boolean;
  _firstRender?: boolean;
}

export const GAME_CONFIG = {
  gridSpacing: 7,
  playerRadius: 18,
  maxObstacleDots: 8000,
  baseBrightness: 0.18,
  brightnessVariation: 0.04,
  repulsionRadius: 14400, // 120^2
  repulsionForce: 50,
  shockwave: {
    shockwaveSpeed: 250,
    shockwaveWidth: 42,
    shockwaveStrength: 24,
    shockwaveDuration: 750,
  } as ShockwaveOptions,
  charge: {
    maxChargeMs: 1500,
    minChargeMs: 1000,
    minPower: 0.2,
    maxPower: 1.8,
  },
  player: {
    growIntervalMs: 4000,
    growAmount: 0.25,
    maxSize: 4.0,
    minSize: 0.6,
    shrinkAmount: 0.5,
  },
  pickup: {
    baseIntervalMs: 8000,
    intervalDecreasePerLevel: 500,
    minIntervalMs: 4000,
  },
  combo: {
    windowMs: 2000,
  },
  spawn: {
    initialInterval: 500,
    minInterval: 120,
    intervalDecreasePerLevel: 50,
    maxAliveObstacles: 50,
    levelUpEveryMs: 10000,
  },
  obstacle: {
    baseSpeed: 1.8,
    speedPerLevel: 0.35,
    speedRandom: 1.0,
  },
};
