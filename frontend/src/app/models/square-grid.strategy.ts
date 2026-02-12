import { GridStrategy, GridCell } from './grid-strategy.interface';

export class SquareGridStrategy implements GridStrategy {
  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number,
    isLocked: boolean
  ): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = isLocked ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = isLocked ? 1 : 2;

    const effectiveSize = cellSize * scale;

    for (let x = offsetX % effectiveSize; x < canvasWidth; x += effectiveSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    for (let y = offsetY % effectiveSize; y < canvasHeight; y += effectiveSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  getCellFromPoint(
    x: number,
    y: number,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number
  ): GridCell {
    const effectiveSize = cellSize * scale;
    const col = Math.floor((x - offsetX) / effectiveSize);
    const row = Math.floor((y - offsetY) / effectiveSize);
    return { row, col };
  }
}
