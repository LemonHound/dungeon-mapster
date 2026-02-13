import { Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GridStrategy } from '../../models/grid-strategy.interface';
import { SquareGridStrategy } from '../../models/square-grid.strategy';
import { HexGridStrategy, HexOrientation } from '../../models/hex-grid.strategy';
import { MapService, DungeonMap } from '../../services/map';
import { environment } from '../../config/environment';

@Component({
  selector: 'app-map-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './map-editor.html',
  styleUrl: './map-editor.css',
})
export class MapEditor implements AfterViewInit, OnInit, OnDestroy {
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

  public activeTab: 'map-details' | 'grid' | 'variables' | 'actions' = 'grid';
  public isPanelExpanded = false;

  public mapData: DungeonMap = {
    name: 'Untitled Map',
    gridType: 'square',
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    gridRotation: 0
  };

  private mapId?: number;
  private saveTimeout?: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mapService: MapService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id && id !== 'new') {
      this.mapId = parseInt(id);
      this.loadMap(this.mapId);
    } else {
      this.createInitialMap();
    }
  }

  ngAfterViewInit() {
    this.mapCanvas = this.mapCanvasRef.nativeElement;
    this.gridCanvas = this.gridCanvasRef.nativeElement;
    this.mapCtx = this.mapCanvas.getContext('2d')!;
    this.gridCtx = this.gridCanvas.getContext('2d')!;

    this.resizeCanvas();
    this.setupMouseEvents();

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  ngOnDestroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveMap();
    }
  }

  private loadMap(id: number): void {
    this.mapService.getMapById(id).subscribe({
      next: (map) => {
        this.mapData = map;
        this.mapId = map.id;
        this.applyMapData();
      },
      error: (error) => {
        console.error('Error loading map:', error);
        this.router.navigate(['/maps']);
      }
    });
  }

  private createInitialMap(): void {
    this.mapService.createMap(this.mapData).subscribe({
      next: (created) => {
        this.mapData = created;
        this.mapId = created.id;
        this.router.navigate(['/map-editor', this.mapId], { replaceUrl: true });
      },
      error: (error) => console.error('Error creating map:', error)
    });
  }

  private applyMapData(): void {
    this.gridType = (this.mapData.gridType as 'square' | 'hex') || 'square';
    this.gridSize = this.mapData.gridSize || 50;
    this.gridOffsetX = this.mapData.gridOffsetX || 0;
    this.gridOffsetY = this.mapData.gridOffsetY || 0;

    this.setGridType(this.gridType);

    if (this.mapData.imageUrl) {
      this.loadMapImageFromUrl(this.mapData.imageUrl);
    } else {
      this.render();
    }
  }

  private loadMapImageFromUrl(url: string): void {
    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.render();
    };
    this.mapImage.onerror = (e) => {
      console.error('Image failed to load:', e);
    };
    this.mapImage.src = `${environment.apiUrl}${url}`;
  }

  private scheduleAutoSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveMap();
    }, 1000);
  }

  private saveMap(): void {
    if (!this.mapId) return;

    this.mapData.gridType = this.gridType;
    this.mapData.gridSize = this.gridSize;
    this.mapData.gridOffsetX = this.gridOffsetX;
    this.mapData.gridOffsetY = this.gridOffsetY;

    this.mapService.updateMap(this.mapId, this.mapData).subscribe({
      next: (updated) => this.mapData = updated,
      error: (error) => console.error('Error saving map:', error)
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.mapService.uploadImage(file).subscribe({
        next: (response) => {
          this.mapData.imageUrl = response.imageUrl;
          this.loadMapImageFromUrl(response.imageUrl);
          this.scheduleAutoSave();
        },
        error: (error) => console.error('Error uploading image:', error)
      });
    }
  }

  onMapNameChange(): void {
    this.scheduleAutoSave();
  }

  private resizeCanvas() {
    const container = this.mapCanvas.parentElement!;
    this.mapCanvas.width = container.clientWidth;
    this.mapCanvas.height = container.clientHeight;
    this.gridCanvas.width = container.clientWidth;
    this.gridCanvas.height = container.clientHeight;

    this.render();
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
      this.scheduleAutoSave();
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
    this.scheduleAutoSave();
  }

  setGridType(type: 'square' | 'hex') {
    this.gridType = type;
    if (type === 'square') {
      this.gridStrategy = new SquareGridStrategy();
    } else {
      this.gridStrategy = new HexGridStrategy(this.hexOrientation);
    }
    this.render();
    this.scheduleAutoSave();
  }

  setHexOrientation(orientation: HexOrientation) {
    this.hexOrientation = orientation;
    if (this.gridType === 'hex') {
      this.gridStrategy = new HexGridStrategy(orientation);
      this.render();
      this.scheduleAutoSave();
    }
  }

  setActiveTab(tab: 'map-details' | 'grid' | 'variables' | 'actions') {
    if (this.activeTab === tab && this.isPanelExpanded) {
      this.isPanelExpanded = false;
    } else {
      this.activeTab = tab;
      this.isPanelExpanded = true;
    }
  }
}
