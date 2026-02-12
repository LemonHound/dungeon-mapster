export interface GridCell {
  row: number;
  col: number;
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
    isLocked: boolean
  ): void;

  getCellFromPoint(
    x: number,
    y: number,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    scale: number
  ): GridCell;
}
