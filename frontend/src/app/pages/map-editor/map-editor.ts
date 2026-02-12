import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import {FormsModule} from '@angular/forms';
import { GridStrategy } from '../../models/grid-strategy.interface';
import { SquareGridStrategy } from '../../models/square-grid.strategy';
import { HexGridStrategy, HexOrientation } from '../../models/hex-grid.strategy';

@Component({
  selector: 'app-map-editor',
  imports: [FormsModule],
  templateUrl: './map-editor.html',
  styleUrl: './map-editor.css',
})
export class MapEditor implements AfterViewInit {
  @ViewChild('mapCanvas') mapCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gridCanvas') gridCanvasRef!: ElementRef<HTMLCanvasElement>;

  private mapCanvas!: HTMLCanvasElement;
  private gridCanvas!: HTMLCanvasElement;
  private mapCtx!: CanvasRenderingContext2D;
  private gridCtx!: CanvasRenderingContext2D;

  private mapImage: HTMLImageElement | null = null;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  public gridLocked = true;
  public gridOffsetX = 0;
  public gridOffsetY = 0;
  public gridScale = 1;
  public gridSize = 50;
  private gridScaleRatio = 1;
  private gridOffsetRatioX = 0;
  private gridOffsetRatioY = 0;

  public gridType: 'square' | 'hex' = 'square';
  private gridStrategy: GridStrategy = new SquareGridStrategy();
  public hexOrientation: HexOrientation = 'flat';

  public activeTab: 'grid' | 'variables' | 'actions' = 'grid';
  public isPanelExpanded = false;

  ngAfterViewInit() {
    this.mapCanvas = this.mapCanvasRef.nativeElement;
    this.gridCanvas = this.gridCanvasRef.nativeElement;
    this.mapCtx = this.mapCanvas.getContext('2d')!;
    this.gridCtx = this.gridCanvas.getContext('2d')!;

    this.resizeCanvas();
    this.loadMapImage();
    this.setupMouseEvents();

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas() {
    const container = this.mapCanvas.parentElement!;
    this.mapCanvas.width = container.clientWidth;
    this.mapCanvas.height = container.clientHeight;
    this.gridCanvas.width = container.clientWidth;
    this.gridCanvas.height = container.clientHeight;

    this.render();
  }

  private loadMapImage() {
    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.render();
    };
    this.mapImage.src = 'assets/images/StolenLands.png';
  }

  private render() {
    this.drawMap();
    this.drawGrid();
  }

  private drawMap() {
    if (!this.mapImage) return;

    this.mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    this.mapCtx.drawImage(
      this.mapImage,
      this.offsetX,
      this.offsetY,
      this.mapImage.width * this.scale,
      this.mapImage.height * this.scale
    );
  }

  private drawGrid() {
    this.gridStrategy.draw(
      this.gridCtx,
      this.gridCanvas.width,
      this.gridCanvas.height,
      this.gridSize,
      this.gridOffsetX,
      this.gridOffsetY,
      this.gridScale,
      this.gridLocked
    );
  }

  private setupMouseEvents() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.gridCanvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    });

    this.gridCanvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      if (this.gridLocked) {
        this.offsetX += deltaX;
        this.offsetY += deltaY;
        this.gridOffsetX = this.offsetX + this.gridOffsetRatioX;
        this.gridOffsetY = this.offsetY + this.gridOffsetRatioY;
      } else {
        this.gridOffsetX += deltaX;
        this.gridOffsetY += deltaY;
      }

      lastX = e.clientX;
      lastY = e.clientY;

      this.render();
    });

    this.gridCanvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.gridCanvas.addEventListener('mouseleave', () => {
      isDragging = false;
    });

    this.gridCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.gridCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomIntensity = e.ctrlKey ? 0.002 : 0.1;
      const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;

      if (this.gridLocked) {
        const newScale = Math.max(0.1, Math.min(5, this.scale + delta));
        const scaleChange = newScale / this.scale;

        this.offsetX = mouseX - (mouseX - this.offsetX) * scaleChange;
        this.offsetY = mouseY - (mouseY - this.offsetY) * scaleChange;
        this.gridOffsetX = mouseX - (mouseX - this.gridOffsetX) * scaleChange;
        this.gridOffsetY = mouseY - (mouseY - this.gridOffsetY) * scaleChange;

        this.scale = newScale;
        this.gridScale = newScale * this.gridScaleRatio;

        this.gridOffsetRatioX = this.gridOffsetX - this.offsetX;
        this.gridOffsetRatioY = this.gridOffsetY - this.offsetY;
      } else {
        const newGridScale = Math.max(0.1, Math.min(5, this.gridScale + delta));
        const scaleChange = newGridScale / this.gridScale;

        this.gridOffsetX = mouseX - (mouseX - this.gridOffsetX) * scaleChange;
        this.gridOffsetY = mouseY - (mouseY - this.gridOffsetY) * scaleChange;

        this.gridScale = newGridScale;
      }

      this.render();
    });

    this.gridCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  toggleGridLock() {
    if (!this.gridLocked) {
      this.gridScaleRatio = this.gridScale / this.scale;
      this.gridOffsetRatioX = this.gridOffsetX - this.offsetX;
      this.gridOffsetRatioY = this.gridOffsetY - this.offsetY;
    }
    this.gridLocked = !this.gridLocked;
    this.render();
  }

  onGridChange() {
    this.render();
  }

  setGridType(type: 'square' | 'hex') {
    this.gridType = type;
    if (type === 'square') {
      this.gridStrategy = new SquareGridStrategy();
    } else {
      this.gridStrategy = new HexGridStrategy(this.hexOrientation);
    }
    this.render();
  }

  setHexOrientation(orientation: HexOrientation) {
    this.hexOrientation = orientation;
    if (this.gridType === 'hex') {
      this.gridStrategy = new HexGridStrategy(orientation);
      this.render();
    }
  }

  setActiveTab(tab: 'grid' | 'variables' | 'actions') {
    if (this.activeTab === tab && this.isPanelExpanded) {
      this.isPanelExpanded = false;
    } else {
      this.activeTab = tab;
      this.isPanelExpanded = true;
    }
  }
}
