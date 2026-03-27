import { type Obstacle, type Shockwave, type ShockwaveOptions, GAME_CONFIG } from "./types";

export function checkPlayerCollision(
  mouseX: number,
  mouseY: number,
  obstacles: Obstacle[],
  playerSize: number = 1
): Obstacle | null {
  // Collision radius scales with player size — bigger = easier to hit
  const pr = GAME_CONFIG.playerRadius * playerSize;
  for (const obs of obstacles) {
    if (!obs.alive) continue;
    const dx = mouseX - obs.cx;
    const dy = mouseY - obs.cy;
    const hitDist = pr + obs.shapeRadius;
    if (dx * dx + dy * dy < hitDist * hitDist) return obs;
  }
  return null;
}

export function checkShockwaveHits(
  shockwaves: Shockwave[],
  obstacles: Obstacle[],
  now: number,
  shockOpts: ShockwaveOptions
): Obstacle[] {
  const destroyed: Obstacle[] = [];

  for (const sw of shockwaves) {
    const elapsed = ((now - sw.start) / 1000) * shockOpts.shockwaveSpeed * sw.power;
    const hitWidth = shockOpts.shockwaveWidth * sw.power;
    for (const obs of obstacles) {
      if (!obs.alive) continue;
      const dx = obs.cx - sw.x;
      const dy = obs.cy - sw.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(dist - elapsed) < hitWidth + obs.shapeRadius) {
        obs.hp--;
        if (obs.hp <= 0) {
          obs.alive = false;
          destroyed.push(obs);
        }
      }
    }
  }

  return destroyed;
}
