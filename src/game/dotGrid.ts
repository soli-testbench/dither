import { GridData, GAME_CONFIG } from "./types";

export function buildGrid(
  canvasW: number,
  canvasH: number,
  spacing: number = GAME_CONFIG.gridSpacing
): GridData {
  const cols = Math.floor(canvasW / spacing);
  const rows = Math.floor(canvasH / spacing);
  const offsetX = (canvasW - cols * spacing) / 2;
  const offsetY = (canvasH - rows * spacing) / 2;
  const gridCount = cols * rows;
  const maxDots = gridCount + GAME_CONFIG.maxObstacleDots;

  const x = new Float32Array(maxDots);
  const y = new Float32Array(maxDots);
  const brightness = new Float32Array(maxDots);
  const size = new Float32Array(maxDots);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      x[i] = offsetX + c * spacing + spacing / 2;
      y[i] = offsetY + r * spacing + spacing / 2;
      brightness[i] =
        GAME_CONFIG.baseBrightness +
        Math.random() * GAME_CONFIG.brightnessVariation;
      size[i] = spacing * 0.6;
    }
  }

  return { x, y, brightness, size, gridCount, maxDots, spacing, cols, rows };
}
