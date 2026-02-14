import {GridStrategy, GridCell, ImageBounds} from './grid-strategy.interface';

export class SquareGridStrategy implements GridStrategy {
  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number,
    isLocked: boolean,
    imageBounds?: ImageBounds
  ): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = isLocked ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = isLocked ? 1 : 2;

    const effectiveSize = cellSize * scale;

    if (!imageBounds) {
      this.drawUnboundedGrid(ctx, canvasWidth, canvasHeight, offsetX, offsetY, effectiveSize);
      return;
    }

    const startCol = Math.floor((imageBounds.x - offsetX) / effectiveSize);
    const endCol = Math.ceil((imageBounds.x + imageBounds.width - offsetX) / effectiveSize);
    const startRow = Math.floor((imageBounds.y - offsetY) / effectiveSize);
    const endRow = Math.ceil((imageBounds.y + imageBounds.height - offsetY) / effectiveSize);

    for (let col = startCol; col <= endCol; col++) {
      const x = offsetX + col * effectiveSize;
      ctx.beginPath();
      ctx.moveTo(x, imageBounds.y);
      ctx.lineTo(x, imageBounds.y + imageBounds.height);
      ctx.stroke();
    }

    for (let row = startRow; row <= endRow; row++) {
      const y = offsetY + row * effectiveSize;
      ctx.beginPath();
      ctx.moveTo(imageBounds.x, y);
      ctx.lineTo(imageBounds.x + imageBounds.width, y);
      ctx.stroke();
    }
  }

  private drawUnboundedGrid(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    offsetX: number,
    offsetY: number,
    effectiveSize: number
  ): void {
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

  drawHighlight(
    ctx: CanvasRenderingContext2D,
    cell: GridCell,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number
  ): void {
    const effectiveSize = cellSize * scale;
    const x = offsetX + cell.col * effectiveSize;
    const y = offsetY + cell.row * effectiveSize;

    ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, effectiveSize, effectiveSize);
  }
}
