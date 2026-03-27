import { useRef, useEffect, useCallback, useState } from "react";
import { buildGrid } from "./game/dotGrid";
import {
  type RenderState,
  type GameState,
  type GamePhase,
  GAME_CONFIG,
} from "./game/types";
import {
  createGameState,
  tickGame,
} from "./game/gameLoop";
import { writeObstacleDots, removeObstacleDots } from "./game/obstacles";

// --- Dot colors ---
// Grid dots: gray. Obstacle dots: red. Tint=1 → gray, tint=0 → red.
const GRAY_R = 138, GRAY_G = 143, GRAY_B = 152;

// 6 tint buckets: 0=red, 1=red, 2=green, 3=green-gray, 4=gray, 5=gray
const TINT_COLORS: [number, number, number][] = [
  [220, 40, 40],     // 0 — enemies (red)
  [200, 60, 40],     // 1 — enemies (red-orange)
  [40, 210, 80],     // 2 — pickups (green)
  [80, 180, 130],    // 3 — green-gray
  [GRAY_R, GRAY_G, GRAY_B], // 4 — grid (gray)
  [GRAY_R, GRAY_G, GRAY_B], // 5 — grid (gray)
];

// --- Bucketed batch renderer ---

function renderDots(
  ctx: CanvasRenderingContext2D,
  rx: Float32Array,
  ry: Float32Array,
  br: Float32Array,
  sz: Float32Array,
  tint: Float32Array,
  count: number,
  w: number,
  h: number,
  buckets: { indices: Int32Array[]; lengths: Int32Array }
) {
  ctx.clearRect(0, 0, w, h);

  buckets.lengths.fill(0);

  for (let i = 0; i < count; i++) {
    const b = br[i];
    if (b < 0.01) continue;
    const bucket = 6 * Math.round(20 * b) + Math.round(5 * tint[i]);
    const idx = buckets.lengths[bucket]++;
    buckets.indices[bucket][idx] = i;
  }

  for (let b = 0; b < 126; b++) {
    const len = buckets.lengths[b];
    if (len === 0) continue;
    const alpha = Math.floor(b / 6) / 20;
    const tintIdx = b % 6;
    const [cr, cg, cb] = TINT_COLORS[tintIdx];
    const indices = buckets.indices[b];
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
    for (let j = 0; j < len; j++) {
      const idx = indices[j];
      const s = sz[idx];
      ctx.fillRect(rx[idx] - 0.25, ry[idx] - 0.25, s + 0.5, s + 0.5);
    }
  }
}

// --- Component ---

export default function DitherGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<RenderState | null>(null);
  const gameRef = useRef<GameState>(createGameState());

  const [uiState, setUiState] = useState<{
    phase: GamePhase;
    score: number;
    lives: number;
    level: number;
    highScore: number;
    chargePower: number;
    combo: number;
  }>({
    phase: "menu",
    score: 0,
    lives: 3,
    level: 1,
    highScore: parseInt(localStorage.getItem("dither-highscore") || "0", 10),
    chargePower: 0,
    combo: 1,
  });

  const initCanvas = useCallback((canvas: HTMLCanvasElement): RenderState => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grid = buildGrid(w, h);
    const maxDots = grid.maxDots;

    const renderX = new Float32Array(maxDots);
    const renderY = new Float32Array(maxDots);
    const renderBr = new Float32Array(maxDots);
    const renderSize = new Float32Array(maxDots);
    const renderTint = new Float32Array(maxDots);
    const displaceX = new Float32Array(maxDots);
    const displaceY = new Float32Array(maxDots);

    for (let i = 0; i < grid.gridCount; i++) {
      renderX[i] = grid.x[i];
      renderY[i] = grid.y[i];
      renderBr[i] = grid.brightness[i];
      renderSize[i] = grid.size[i];
      renderTint[i] = 1;
    }

    const bucketIndices: Int32Array[] = Array(126);
    for (let i = 0; i < 126; i++) {
      bucketIndices[i] = new Int32Array(maxDots);
    }

    return {
      ctx,
      w,
      h,
      dpr,
      grid,
      renderX,
      renderY,
      renderBr,
      renderSize,
      renderTint,
      displaceX,
      displaceY,
      buckets: { indices: bucketIndices, lengths: new Int32Array(126) },
      count: grid.gridCount,
      mouseX: -9999,
      mouseY: -9999,
      mouseActive: false,
      shockwaves: [],
      _needsAnim: false,
      _hasDisplacement: false,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    stateRef.current = initCanvas(canvas);
    let raf: number | null = null;
    let lastTime = 0;

    const shockOpts = GAME_CONFIG.shockwave;

    const tick = (now: number) => {
      const st = stateRef.current;
      if (!st) return;

      const dt = lastTime === 0 ? 16 : Math.min(now - lastTime, 50);
      lastTime = now;
      const game = gameRef.current;

      // --- Game logic ---
      if (game.phase === "playing") {
        const events = tickGame(
          game,
          dt,
          st.mouseX,
          st.mouseY,
          st.mouseActive,
          st.shockwaves,
          now,
          st.w,
          st.h,
          shockOpts
        );

        // Write alive obstacle dots into the buffers
        let obsDotsUsed = 0;
        for (const obs of game.obstacles) {
          if (!obs.alive) {
            removeObstacleDots(obs, st.renderBr);
            continue;
          }
          obs.dotOffset = st.grid.gridCount + obsDotsUsed;
          writeObstacleDots(
            obs,
            st.renderX,
            st.renderY,
            st.renderBr,
            st.renderSize,
            st.renderTint,
            st.grid.spacing
          );
          obsDotsUsed += obs.dotCount;
        }
        game.obstacleDotsUsed = obsDotsUsed;
        st.count = st.grid.gridCount + obsDotsUsed;

        // Process events FIRST so flash type is correct before rendering
        let hasHit = false;
        for (const ev of events) {
          if (ev.type === "hit") {
            game.flashIntensity = 1;
            game.flashType = "red";
            hasHit = true;
          }
          if (ev.type === "shrink" && !hasHit) {
            game.flashIntensity = 0.6;
            game.flashType = "green";
          }
          if (ev.type === "gameover") {
            const hs = Math.max(
              game.score,
              parseInt(localStorage.getItem("dither-highscore") || "0", 10)
            );
            localStorage.setItem("dither-highscore", String(hs));
            setUiState((prev) => ({
              ...prev,
              phase: "gameover",
              score: game.score,
              highScore: hs,
            }));
          }
        }

        // Compute charge power
        let chargePower = 0;
        if (game.charging && game.chargeStart > 0) {
          const chargeMs = Math.min(now - game.chargeStart, GAME_CONFIG.charge.maxChargeMs);
          const t = chargeMs / GAME_CONFIG.charge.maxChargeMs;
          chargePower = GAME_CONFIG.charge.minPower + t * (GAME_CONFIG.charge.maxPower - GAME_CONFIG.charge.minPower);
        }

        // Handle flash effect + charge glow
        if (game.flashIntensity > 0) {
          game.flashIntensity *= 0.96;
          if (game.flashIntensity < 0.01) game.flashIntensity = 0;
          const flashBr =
            GAME_CONFIG.baseBrightness +
            game.flashIntensity * (0.7 - GAME_CONFIG.baseBrightness);
          const flashTint = game.flashIntensity;
          const targetTint = game.flashType === "green" ? 0.4 : 0.0;
          for (let i = 0; i < st.grid.gridCount; i++) {
            st.renderBr[i] = flashBr;
            st.renderTint[i] = 1 - flashTint * (1 - targetTint);
          }
        } else {
          // Restore base brightness + tint, then apply charge glow
          for (let i = 0; i < st.grid.gridCount; i++) {
            let br = st.grid.brightness[i];
            st.renderTint[i] = 1;
            if (chargePower > 0 && st.mouseActive) {
              const dx = st.grid.x[i] - st.mouseX;
              const dy = st.grid.y[i] - st.mouseY;
              const d2 = dx * dx + dy * dy;
              const glowRadius = 80 + chargePower * 80;
              if (d2 < glowRadius * glowRadius) {
                const dist = Math.sqrt(d2);
                const t = 1 - dist / glowRadius;
                br += t * t * chargePower * 0.4;
              }
            }
            st.renderBr[i] = br;
          }
        }

        // Clean dead obstacles
        game.obstacles = game.obstacles.filter((o) => o.alive);

        // Update UI state periodically (throttle to avoid re-renders every frame)
        if (Math.floor(now / 100) !== Math.floor((now - dt) / 100)) {
          setUiState((prev) => ({
            ...prev,
            phase: game.phase,
            score: game.score,
            lives: game.lives,
            level: game.level,
            chargePower,
            combo: game.combo,
          }));
        }
      }

      // --- Physics (mouse repulsion + shockwaves + spring-back) ---
      st._needsAnim = false;
      const dur = shockOpts.shockwaveDuration;
      st.shockwaves = st.shockwaves.filter((sw) => now - sw.start < dur);
      const hasShockwaves = st.shockwaves.length > 0;
      const isPlaying = game.phase === "playing";

      if (st.mouseActive || hasShockwaves || st._hasDisplacement) {
        const mx = st.mouseX;
        const my = st.mouseY;
        const swScale = 1 + (st.shockwaves.length - 1) * 0.5;

        if (hasShockwaves) st._needsAnim = true;
        st._hasDisplacement = false;

        const pSize = game.playerSize;
        const repR2 = isPlaying
          ? GAME_CONFIG.repulsionRadius * pSize * pSize
          : 10000;
        const repF = isPlaying ? GAME_CONFIG.repulsionForce * pSize : 40;
        const repDist = Math.sqrt(repR2);

        for (let i = 0; i < st.count; i++) {
          // Base position: grid dots use grid.x/y, obstacle dots use renderX/Y as-is
          const isGridDot = i < st.grid.gridCount;
          const bx = isGridDot ? st.grid.x[i] : st.renderX[i];
          const by = isGridDot ? st.grid.y[i] : st.renderY[i];
          let fx = 0;
          let fy = 0;

          // Mouse repulsion
          if (st.mouseActive) {
            const dx = bx + st.displaceX[i] - mx;
            const dy = by + st.displaceY[i] - my;
            const d2 = dx * dx + dy * dy;
            if (d2 < repR2 && d2 > 0.1) {
              const dist = Math.sqrt(d2);
              const t = 1 - dist / repDist;
              const force = t * t * t * repF;
              fx = (dx / dist) * force;
              fy = (dy / dist) * force;
            }
          }

          // Shockwave forces
          for (let s = 0; s < st.shockwaves.length; s++) {
            const sw = st.shockwaves[s];
            const swPower = sw.power;
            const elapsed =
              ((now - sw.start) / 1000) * shockOpts.shockwaveSpeed * swPower;
            const fade = 1 - (now - sw.start) / dur;
            const dx = bx - sw.x;
            const dy = by - sw.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.1) continue;
            const swWidth = shockOpts.shockwaveWidth * swPower;
            const gap = Math.abs(dist - elapsed);
            if (gap < swWidth) {
              const strength =
                (1 - gap / swWidth) *
                fade *
                shockOpts.shockwaveStrength *
                swPower *
                swScale;
              fx += (dx / dist) * strength;
              fy += (dy / dist) * strength;
            }
          }

          // Spring back
          st.displaceX[i] += (fx - st.displaceX[i]) * 0.12;
          st.displaceY[i] += (fy - st.displaceY[i]) * 0.12;
          if (Math.abs(st.displaceX[i]) < 0.01) st.displaceX[i] = 0;
          if (Math.abs(st.displaceY[i]) < 0.01) st.displaceY[i] = 0;

          if (st.displaceX[i] !== 0 || st.displaceY[i] !== 0) {
            st._needsAnim = true;
            st._hasDisplacement = true;
          }

          if (isGridDot) {
            st.renderX[i] = bx + st.displaceX[i];
            st.renderY[i] = by + st.displaceY[i];
          }
        }
      }

      // --- Render ---
      renderDots(
        st.ctx,
        st.renderX,
        st.renderY,
        st.renderBr,
        st.renderSize,
        st.renderTint,
        st.count,
        st.w,
        st.h,
        st.buckets
      );

      if (!st._firstRender) {
        st._firstRender = true;
        requestAnimationFrame(() => {
          canvas.dataset.ready = "";
        });
      }

      // Always animate during gameplay; otherwise only when needed
      if (isPlaying) {
        raf = requestAnimationFrame(tick);
      } else {
        raf =
          st.mouseActive || st._needsAnim
            ? requestAnimationFrame(tick)
            : null;
      }
    };

    raf = requestAnimationFrame(tick);

    const onResize = () => {
      stateRef.current = initCanvas(canvas);
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const getLocalPos = (e: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st || e.pointerType !== "mouse") return;
      const { x, y } = getLocalPos(e);
      st.mouseX = x;
      st.mouseY = y;
      st.mouseActive = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointerLeave = (e: PointerEvent) => {
      const st = stateRef.current;
      if (st && e.pointerType === "mouse") {
        st.mouseActive = false;
        if (!raf) raf = requestAnimationFrame(tick);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const game = gameRef.current;
      if (game.phase === "playing") {
        game.charging = true;
        game.chargeStart = performance.now();
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st) return;
      const game = gameRef.current;
      const { x, y } = getLocalPos(e);

      if (game.phase === "menu") {
        gameRef.current = createGameState();
        gameRef.current.phase = "playing";
        setUiState((prev) => ({
          ...prev,
          phase: "playing",
          score: 0,
          lives: 1,
          level: 1,
          chargePower: 0,
        }));
      } else if (game.phase === "playing") {
        // Only fire if charged for at least minChargeMs
        const heldMs = game.charging && game.chargeStart > 0
          ? performance.now() - game.chargeStart
          : 0;
        if (heldMs >= GAME_CONFIG.charge.minChargeMs) {
          const chargeMs = Math.min(heldMs, GAME_CONFIG.charge.maxChargeMs);
          const t = chargeMs / GAME_CONFIG.charge.maxChargeMs;
          const power = GAME_CONFIG.charge.minPower + t * (GAME_CONFIG.charge.maxPower - GAME_CONFIG.charge.minPower);
          st.shockwaves.push({ x, y, start: performance.now(), power });
        }
        game.charging = false;
        game.chargeStart = 0;
      } else if (game.phase === "gameover") {
        gameRef.current = createGameState();
        gameRef.current.phase = "playing";
        setUiState((prev) => ({
          ...prev,
          phase: "playing",
          score: 0,
          lives: 1,
          level: 1,
          chargePower: 0,
        }));
      }

      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, [initCanvas]);

  return (
    <div className="game-wrapper">
      <canvas ref={canvasRef} className="game-canvas" />

      {uiState.phase === "menu" && (
        <div className="game-overlay">
          <div className="overlay-box">
            <div className="menu-title">DITHER</div>
            <div className="menu-subtitle">survive the swarm</div>
            <div className="menu-controls">
              <div className="menu-control">move mouse to dodge</div>
              <div className="menu-control">hold click to charge &middot; release to blast</div>
              <div className="menu-legend">
                <div className="legend-item">
                  <span className="legend-dot legend-red">◆ ◆ ◆</span>
                  <span>enemies &middot; avoid or destroy</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot legend-green">◇ ◇ ◇</span>
                  <span>pickups &middot; collect to shrink</span>
                </div>
              </div>
              <div className="menu-control">you grow over time &middot; don't get too big</div>
            </div>
            <div className="menu-hint">click anywhere to start</div>
          </div>
        </div>
      )}

      {uiState.phase === "playing" && (
        <>
          <div className="game-hud">
            <span className="hud-score">
              {uiState.score.toLocaleString()}
              {uiState.combo > 1 && (
                <span className="hud-combo">x{uiState.combo}</span>
              )}
            </span>
            <span className="hud-level">LV {uiState.level}</span>
          </div>
          {uiState.chargePower > 0 && (
            <div className="charge-bar-container">
              <div
                className="charge-bar-fill"
                style={{
                  width: `${Math.min(100, (uiState.chargePower / GAME_CONFIG.charge.maxPower) * 100)}%`,
                }}
              />
            </div>
          )}
        </>
      )}

      {uiState.phase === "gameover" && (
        <div className="game-overlay">
          <div className="overlay-box">
            <div className="gameover-label">GAME OVER</div>
            <div className="gameover-score">{uiState.score.toLocaleString()}</div>
            {uiState.score >= uiState.highScore && uiState.score > 0 && (
              <div className="gameover-highscore">NEW HIGH SCORE</div>
            )}
            <div className="menu-hint">click to retry</div>
          </div>
        </div>
      )}
    </div>
  );
}
