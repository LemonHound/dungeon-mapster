import {GridStrategy, GridCell, ImageBounds} from './grid-strategy.interface';

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
    isLocked: boolean,
    imageBounds?: ImageBounds
  ): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = isLocked ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = isLocked ? 1 : 2;

    const size = cellSize * scale;

    if (this.orientation === 'flat') {
      this.drawFlatHexGrid(ctx, size, offsetX, offsetY, canvasWidth, canvasHeight, imageBounds);
    } else {
      this.drawPointyHexGrid(ctx, size, offsetX, offsetY, canvasWidth, canvasHeight, imageBounds);
    }
  }

  private drawFlatHexGrid(
      ctx: CanvasRenderingContext2D,
      size: number,
      offsetX: number,
      offsetY: number,
      canvasWidth: number,
      canvasHeight: number,
      imageBounds?: ImageBounds
  ): void {
    const width = size * 2;
    const height = Math.sqrt(3) * size;
    const horizDistance = width * 0.75;
    const vertDistance = height;

    let startCol, endCol, startRow, endRow;

    if (imageBounds) {
      startCol = Math.floor((imageBounds.x - offsetX - size) / horizDistance) - 1;
      endCol = Math.ceil((imageBounds.x + imageBounds.width - offsetX) / horizDistance) + 1;
      startRow = Math.floor((imageBounds.y - offsetY - height / 2) / vertDistance) - 1;
      endRow = Math.ceil((imageBounds.y + imageBounds.height - offsetY) / vertDistance) + 1;
    } else {
      startCol = Math.floor(-offsetX / horizDistance) - 2;
      endCol = Math.ceil((canvasWidth - offsetX) / horizDistance) + 2;
      startRow = Math.floor(-offsetY / vertDistance) - 2;
      endRow = Math.ceil((canvasHeight - offsetY) / vertDistance) + 2;
    }

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const yOffset = col % 2 === 0 ? 0 : vertDistance / 2;
        const centerX = offsetX + col * horizDistance + size;
        const centerY = offsetY + row * vertDistance + height / 2 + yOffset;

        if (imageBounds && !this.hexOverlapsRect(centerX, centerY, size, 0, imageBounds)) {
          continue;
        }

        this.drawHexagon(ctx, centerX, centerY, size, 0);
      }
    }
  }

  private drawPointyHexGrid(
      ctx: CanvasRenderingContext2D,
      size: number,
      offsetX: number,
      offsetY: number,
      canvasWidth: number,
      canvasHeight: number,
      imageBounds?: ImageBounds
  ): void {
    const width = Math.sqrt(3) * size;
    const height = size * 2;
    const horizDistance = width;
    const vertDistance = height * 0.75;

    let startCol, endCol, startRow, endRow;

    if (imageBounds) {
      startCol = Math.floor((imageBounds.x - offsetX - width / 2) / horizDistance) - 1;
      endCol = Math.ceil((imageBounds.x + imageBounds.width - offsetX) / horizDistance) + 1;
      startRow = Math.floor((imageBounds.y - offsetY - size) / vertDistance) - 1;
      endRow = Math.ceil((imageBounds.y + imageBounds.height - offsetY) / vertDistance) + 1;
    } else {
      startCol = Math.floor(-offsetX / horizDistance) - 2;
      endCol = Math.ceil((canvasWidth - offsetX) / horizDistance) + 2;
      startRow = Math.floor(-offsetY / vertDistance) - 2;
      endRow = Math.ceil((canvasHeight - offsetY) / vertDistance) + 2;
    }

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const xOffset = row % 2 === 0 ? 0 : horizDistance / 2;
        const centerX = offsetX + col * horizDistance + width / 2 + xOffset;
        const centerY = offsetY + row * vertDistance + size;

        if (imageBounds && !this.hexOverlapsRect(centerX, centerY, size, 30, imageBounds)) {
          continue;
        }

        this.drawHexagon(ctx, centerX, centerY, size, 30);
      }
    }
  }

  private hexOverlapsRect(
      centerX: number,
      centerY: number,
      size: number,
      rotation: number,
      rect: ImageBounds
  ): boolean {
    const hexRadius = size * 1.2;

    if (centerX + hexRadius < rect.x) return false;
    if (centerX - hexRadius > rect.x + rect.width) return false;
    if (centerY + hexRadius < rect.y) return false;
    if (centerY - hexRadius > rect.y + rect.height) return false;

    return true;
  }

  private drawHexagon(
      ctx: CanvasRenderingContext2D,
      centerX: number,
      centerY: number,
      size: number,
      rotation: number
  ): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = ((Math.PI / 3) * i) + (rotation * Math.PI / 180);
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

      const approxCol = Math.round((x - offsetX - size) / horizDistance);
      const approxRow = Math.round((y - offsetY - height / 2 - (approxCol % 2 === 0 ? 0 : vertDistance / 2)) / vertDistance);

      return {row: approxRow, col: approxCol};
    } else {
      const width = Math.sqrt(3) * size;
      const height = size * 2;
      const horizDistance = width;
      const vertDistance = height * 0.75;

      const approxRow = Math.round((y - offsetY - size) / vertDistance);
      const approxCol = Math.round((x - offsetX - width / 2 - (approxRow % 2 === 0 ? 0 : horizDistance / 2)) / horizDistance);

      return {row: approxRow, col: approxCol};
    }
  }

  drawHighlight(
      ctx: CanvasRenderingContext2D,
      cell: GridCell,
      cellSize: number,
      offsetX: number,
      offsetY: number,
      scale: number
  ): void {
    const size = cellSize * scale;

    if (this.orientation === 'flat') {
      const width = size * 2;
      const height = Math.sqrt(3) * size;
      const horizDistance = width * 0.75;
      const vertDistance = height;
      const yOffset = cell.col % 2 === 0 ? 0 : vertDistance / 2;
      const centerX = offsetX + cell.col * horizDistance + size;
      const centerY = offsetY + cell.row * vertDistance + height / 2 + yOffset;

      ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.lineWidth = 3;
      this.drawHexagon(ctx, centerX, centerY, size, 0);
    } else {
      const width = Math.sqrt(3) * size;
      const height = size * 2;
      const horizDistance = width;
      const vertDistance = height * 0.75;
      const xOffset = cell.row % 2 === 0 ? 0 : horizDistance / 2;
      const centerX = offsetX + cell.col * horizDistance + width / 2 + xOffset;
      const centerY = offsetY + cell.row * vertDistance + size;

      ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.lineWidth = 3;
      this.drawHexagon(ctx, centerX, centerY, size, 30);
    }
  }
}
