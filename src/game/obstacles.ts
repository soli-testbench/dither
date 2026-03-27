import { type Obstacle, type ObstacleShape, type GameState, GAME_CONFIG } from "./types";

const SHAPES: ObstacleShape[] = ["diamond", "cross", "ring", "arrow", "cluster"];

export function generateShape(
  type: ObstacleShape,
  size: number
): [number, number][] {
  const dots: [number, number][] = [];

  switch (type) {
    case "diamond":
      for (let dx = -size; dx <= size; dx++)
        for (let dy = -size; dy <= size; dy++)
          if (Math.abs(dx) + Math.abs(dy) <= size) dots.push([dx, dy]);
      break;

    case "cross":
      for (let d = -size; d <= size; d++) {
        dots.push([d, 0]);
        if (d !== 0) dots.push([0, d]);
      }
      break;

    case "ring":
      for (let dx = -size; dx <= size; dx++)
        for (let dy = -size; dy <= size; dy++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= size - 1.2 && dist <= size + 0.3) dots.push([dx, dy]);
        }
      break;

    case "arrow":
      for (let dy = -size; dy <= size; dy++)
        for (let dx = -size; dx <= size - Math.abs(dy); dx++)
          dots.push([dx, dy]);
      break;

    case "cluster":
      for (let dx = -size; dx <= size; dx++)
        for (let dy = -size; dy <= size; dy++)
          if (dx * dx + dy * dy <= size * size && Math.random() > 0.25)
            dots.push([dx, dy]);
      break;
  }

  return dots;
}

export function spawnObstacle(
  game: GameState,
  canvasW: number,
  canvasH: number,
  mouseX: number,
  mouseY: number
): Obstacle {
  const edge = Math.floor(Math.random() * 4);
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const size = 2 + Math.floor(Math.random() * 3); // 2-4
  const shapeDots = generateShape(shape, size);

  const speed =
    GAME_CONFIG.obstacle.baseSpeed +
    game.level * GAME_CONFIG.obstacle.speedPerLevel +
    Math.random() * GAME_CONFIG.obstacle.speedRandom;

  let cx: number, cy: number, vx: number, vy: number;
  const margin = 60;

  // 1 in 5 aimed directly at player, rest are random
  let targetX: number, targetY: number;
  if (Math.random() < 0.2) {
    const spread = 30;
    targetX = mouseX + (Math.random() - 0.5) * spread;
    targetY = mouseY + (Math.random() - 0.5) * spread;
  } else {
    targetX = Math.random() * canvasW;
    targetY = Math.random() * canvasH;
  }

  switch (edge) {
    case 0: // top
      cx = Math.random() * canvasW;
      cy = -margin;
      break;
    case 1: // right
      cx = canvasW + margin;
      cy = Math.random() * canvasH;
      break;
    case 2: // bottom
      cx = Math.random() * canvasW;
      cy = canvasH + margin;
      break;
    default: // left
      cx = -margin;
      cy = Math.random() * canvasH;
      break;
  }

  const dx = targetX - cx;
  const dy = targetY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  vx = (dx / dist) * speed;
  vy = (dy / dist) * speed;

  const shapeRadius = size * GAME_CONFIG.gridSpacing * 1.2;

  return {
    id: game.nextObstacleId++,
    cx,
    cy,
    vx,
    vy,
    shape,
    shapeDots,
    shapeRadius,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.02,
    dotOffset: 0, // assigned each frame
    dotCount: shapeDots.length,
    brightness: 0.6 + Math.random() * 0.3,
    tint: Math.random() * 0.15, // low tint = red
    alive: true,
    hp: size <= 2 ? 1 : size <= 3 ? 2 : 3,
    isPickup: false,
  };
}

export function spawnPickup(
  game: GameState,
  canvasW: number,
  canvasH: number
): Obstacle {
  const edge = Math.floor(Math.random() * 4);
  const size = 3;
  const shapeDots = generateShape("ring", size);

  const speed = 0.8 + Math.random() * 0.5;

  let cx: number, cy: number;
  const margin = 60;

  const targetX = canvasW * (0.2 + Math.random() * 0.6);
  const targetY = canvasH * (0.2 + Math.random() * 0.6);

  switch (edge) {
    case 0: cx = Math.random() * canvasW; cy = -margin; break;
    case 1: cx = canvasW + margin; cy = Math.random() * canvasH; break;
    case 2: cx = Math.random() * canvasW; cy = canvasH + margin; break;
    default: cx = -margin; cy = Math.random() * canvasH; break;
  }

  const dx = targetX - cx;
  const dy = targetY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return {
    id: game.nextObstacleId++,
    cx, cy,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    shape: "ring",
    shapeDots,
    shapeRadius: size * GAME_CONFIG.gridSpacing * 1.2,
    rotation: 0,
    rotationSpeed: 0.03,
    dotOffset: 0,
    dotCount: shapeDots.length,
    brightness: 0.85,
    tint: 0.4, // maps to green in tint color table
    alive: true,
    hp: 1,
    isPickup: true,
  };
}

export function writeObstacleDots(
  obs: Obstacle,
  renderX: Float32Array,
  renderY: Float32Array,
  renderBr: Float32Array,
  renderSize: Float32Array,
  renderTint: Float32Array,
  spacing: number
) {
  const { dotOffset, shapeDots, cx, cy, rotation, brightness, tint } = obs;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let i = 0; i < shapeDots.length; i++) {
    const [lx, ly] = shapeDots[i];
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    renderX[dotOffset + i] = cx + rx * spacing;
    renderY[dotOffset + i] = cy + ry * spacing;
    renderBr[dotOffset + i] = brightness;
    renderSize[dotOffset + i] = spacing * 0.7;
    renderTint[dotOffset + i] = tint;
  }
}

export function removeObstacleDots(obs: Obstacle, renderBr: Float32Array) {
  for (let i = 0; i < obs.dotCount; i++) {
    renderBr[obs.dotOffset + i] = 0;
  }
}
