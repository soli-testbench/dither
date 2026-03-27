import {
  type GameState,
  type Shockwave,
  type ShockwaveOptions,
  GAME_CONFIG,
} from "./types";
import { spawnObstacle, spawnPickup } from "./obstacles";
import { checkPlayerCollision, checkShockwaveHits } from "./collision";

export interface GameEvent {
  type: "spawn" | "destroy" | "hit" | "gameover" | "levelup" | "shrink";
}

export function createGameState(): GameState {
  return {
    phase: "menu",
    score: 0,
    lives: 1,
    level: 1,
    elapsed: 0,
    spawnTimer: 1500,
    spawnInterval: GAME_CONFIG.spawn.initialInterval,
    obstacles: [],
    nextObstacleId: 0,
    obstacleDotsUsed: 0,
    maxObstacleDots: GAME_CONFIG.maxObstacleDots,
    flashIntensity: 0,
    flashType: "red",
    invulnTimer: 0,
    chargeStart: 0,
    charging: false,
    playerSize: 1.0,
    growTimer: GAME_CONFIG.player.growIntervalMs,
    pickupTimer: GAME_CONFIG.pickup.baseIntervalMs,
    combo: 1,
    comboTimer: 0,
  };
}

export function tickGame(
  game: GameState,
  dt: number,
  mouseX: number,
  mouseY: number,
  mouseActive: boolean,
  shockwaves: Shockwave[],
  now: number,
  canvasW: number,
  canvasH: number,
  shockOpts: ShockwaveOptions
): GameEvent[] {
  if (game.phase !== "playing") return [];

  // Pause everything when mouse is off-screen
  if (!mouseActive) return [];

  const events: GameEvent[] = [];
  game.elapsed += dt;

  // Invulnerability timer (after taking a hit)
  if (game.invulnTimer > 0) {
    game.invulnTimer -= dt;
  }

  // Player growth — continuous, smooth
  const growPerMs = GAME_CONFIG.player.growAmount / GAME_CONFIG.player.growIntervalMs;
  game.playerSize = Math.min(
    GAME_CONFIG.player.maxSize,
    game.playerSize + growPerMs * dt
  );

  // Combo decay
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 1;
    }
  }

  // Difficulty ramp
  const newLevel = 1 + Math.floor(game.elapsed / GAME_CONFIG.spawn.levelUpEveryMs);
  if (newLevel > game.level) {
    game.level = newLevel;
    game.spawnInterval = Math.max(
      GAME_CONFIG.spawn.minInterval,
      GAME_CONFIG.spawn.initialInterval -
        game.level * GAME_CONFIG.spawn.intervalDecreasePerLevel
    );
    events.push({ type: "levelup" });
  }

  // Spawn timer
  game.spawnTimer -= dt;
  if (
    game.spawnTimer <= 0 &&
    game.obstacles.filter((o) => o.alive).length < GAME_CONFIG.spawn.maxAliveObstacles
  ) {
    game.spawnTimer =
      game.spawnInterval * (0.7 + Math.random() * 0.6);
    const obs = spawnObstacle(game, canvasW, canvasH, mouseX, mouseY);
    game.obstacles.push(obs);
    events.push({ type: "spawn" });
  }

  // Pickup spawn timer
  game.pickupTimer -= dt;
  if (game.pickupTimer <= 0) {
    const pickup = spawnPickup(game, canvasW, canvasH);
    game.obstacles.push(pickup);
    game.pickupTimer = Math.max(
      GAME_CONFIG.pickup.minIntervalMs,
      GAME_CONFIG.pickup.baseIntervalMs - game.level * GAME_CONFIG.pickup.intervalDecreasePerLevel
    );
  }

  // Move obstacles — straight lines, no homing
  for (const obs of game.obstacles) {
    if (!obs.alive) continue;
    obs.cx += obs.vx;
    obs.cy += obs.vy;
    obs.rotation += obs.rotationSpeed;

    // Off-screen removal
    const margin = 150;
    if (
      obs.cx < -margin ||
      obs.cx > canvasW + margin ||
      obs.cy < -margin ||
      obs.cy > canvasH + margin
    ) {
      obs.alive = false;
    }
  }

  // Shockwave hits
  const destroyed = checkShockwaveHits(shockwaves, game.obstacles, now, shockOpts);
  let killCount = 0;
  for (const obs of destroyed) {
    if (obs.isPickup) {
      // Green pickup: shrink player
      game.playerSize = Math.max(
        GAME_CONFIG.player.minSize,
        game.playerSize - GAME_CONFIG.player.shrinkAmount
      );
      events.push({ type: "shrink" });
    } else {
      killCount++;
      game.score += 100 * game.level * game.combo;
      events.push({ type: "destroy" });
    }
  }
  if (killCount > 0) {
    game.combo += killCount;
    game.comboTimer = GAME_CONFIG.combo.windowMs;
  }

  // Player collision
  if (mouseX > -9000) {
    const hit = checkPlayerCollision(mouseX, mouseY, game.obstacles, game.playerSize);
    if (hit) {
      if (hit.isPickup) {
        // Collect green pickup — shrink player
        hit.alive = false;
        game.playerSize = Math.max(
          GAME_CONFIG.player.minSize,
          game.playerSize - GAME_CONFIG.player.shrinkAmount
        );
        events.push({ type: "shrink" });
      } else if (game.invulnTimer <= 0) {
        // Red obstacle — instant death
        hit.alive = false;
        game.lives = 0;
        game.phase = "gameover";
        events.push({ type: "hit" });
        events.push({ type: "gameover" });
      }
    }
  }

  // Passive score
  game.score += 1;

  return events;
}
