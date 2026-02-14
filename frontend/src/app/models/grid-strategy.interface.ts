export interface GridCell {
  row: number;
  col: number;
}

export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridStrategy {
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
  ): void;

  getCellFromPoint(
    x: number,
    y: number,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number
  ): GridCell;

  drawHighlight?(
    ctx: CanvasRenderingContext2D,
    cell: GridCell,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number
  ): void;
}
