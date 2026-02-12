import { GridStrategy, GridCell } from './grid-strategy.interface';

export type HexOrientation = 'flat' | 'pointy';

export class HexGridStrategy implements GridStrategy {
  constructor(private orientation: HexOrientation = 'flat') {}

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

    const size = cellSize * scale;

    if (this.orientation === 'flat') {
      const width = size * 2;
      const height = Math.sqrt(3) * size;
      const horizDistance = width * 0.75;
      const vertDistance = height;

      const startCol = Math.floor(-offsetX / horizDistance) - 2;
      const endCol = Math.ceil((canvasWidth - offsetX) / horizDistance) + 2;
      const startRow = Math.floor(-offsetY / vertDistance) - 2;
      const endRow = Math.ceil((canvasHeight - offsetY) / vertDistance) + 2;

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const yOffset = col % 2 === 0 ? 0 : vertDistance / 2;
          const centerX = offsetX + col * horizDistance + size;
          const centerY = offsetY + row * vertDistance + height / 2 + yOffset;

          this.drawHexagon(ctx, centerX, centerY, size, 0);
        }
      }
    } else {
      const width = Math.sqrt(3) * size;
      const height = size * 2;
      const horizDistance = width;
      const vertDistance = height * 0.75;

      const startCol = Math.floor(-offsetX / horizDistance) - 2;
      const endCol = Math.ceil((canvasWidth - offsetX) / horizDistance) + 2;
      const startRow = Math.floor(-offsetY / vertDistance) - 2;
      const endRow = Math.ceil((canvasHeight - offsetY) / vertDistance) + 2;

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const xOffset = row % 2 === 0 ? 0 : horizDistance / 2;
          const centerX = offsetX + col * horizDistance + width / 2 + xOffset;
          const centerY = offsetY + row * vertDistance + size;

          this.drawHexagon(ctx, centerX, centerY, size, Math.PI / 2);
        }
      }
    }
  }

  private drawHexagon(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number, rotation: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = rotation + (Math.PI / 3) * i;
      const x = centerX + size * Math.cos(angle);
      const y = centerY + size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  getCellFromPoint(
    x: number,
    y: number,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number
  ): GridCell {
    const size = cellSize * scale;

    if (this.orientation === 'flat') {
      const width = size * 2;
      const height = Math.sqrt(3) * size;
      const horizDistance = width * 0.75;
      const vertDistance = height;

      const row = Math.round((y - offsetY) / vertDistance);
      const xOffset = row % 2 === 0 ? 0 : horizDistance / 2;
      const col = Math.round((x - offsetX - xOffset) / horizDistance);

      return { row, col };
    } else {
      const width = Math.sqrt(3) * size;
      const height = size * 2;
      const horizDistance = width;
      const vertDistance = height * 0.75;

      const col = Math.round((x - offsetX) / horizDistance);
      const yOffset = col % 2 === 0 ? 0 : vertDistance / 2;
      const row = Math.round((y - offsetY - yOffset) / vertDistance);

      return { row, col };
    }
  }
}
