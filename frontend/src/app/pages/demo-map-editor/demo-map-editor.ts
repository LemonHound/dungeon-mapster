import {Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {GridCell, GridStrategy} from '../../models/grid-strategy.interface';
import {SquareGridStrategy} from '../../models/square-grid.strategy';
import {HexGridStrategy, HexOrientation} from '../../models/hex-grid.strategy';
import {MapMembership} from '../../services/map';
import {AuthService, User} from '../../services/auth.service';
import {UserPresence, SelectionState, FieldFocusState} from '../../models/presence.model';

type TabType = 'map-details' | 'grid' | 'variables' | 'members' | 'actions';

@Component({
  selector: 'app-demo-map-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: '../map-editor/map-editor.html',
  styleUrl: '../map-editor/map-editor.css'
})
export class DemoMapEditor implements AfterViewInit, OnInit, OnDestroy {
  public isDemo = true;
  private router = inject(Router);
  private authService = inject(AuthService);

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
  public gridOffsetX = -20;
  public gridOffsetY = 30;
  public gridScale = 1;
  public gridSize = 50;
  private gridScaleRatio = 1;
  private gridOffsetRatioX = this.gridOffsetX - this.offsetX;
  private gridOffsetRatioY = this.gridOffsetY - this.offsetY;

  public gridType: 'square' | 'hex' = 'hex';
  private gridStrategy: GridStrategy = new HexGridStrategy();
  public hexOrientation: HexOrientation = 'pointy';

  private mouseDownTime = 0;
  public selectedCell: GridCell | null = null;
  public selectedCellName = '';

  public activeTab: TabType = 'grid';
  public isPanelExpanded = false;

  public imageLoading = false;
  public noImagePrompt = false;
  public cacheStaleMessage: string | null = null;
  public cacheStaleIsError = false;

  public mapData = {name: 'Demo Map', joinCode: null as string | null, imageUrl: null as string | null};
  public userRole: 'OWNER' | 'DM' | 'PLAYER' | null = 'DM';
  public members: MapMembership[] = [];
  public memberUsers = new Map<number, User>();
  public loadingMemberId: number | null = null;

  public connectionStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  public connectedUsers: UserPresence[] = [];
  public remoteSelections = new Map<number, SelectionState>();
  public remoteFieldFocus: FieldFocusState | null = null;

  private cellData = new Map<string, string>();
  private localImageFile: File | null = null;
  private localImageObjectUrl: string | null = null;

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) this.router.navigate(['/maps']);
    });
  }

  ngAfterViewInit(): void {
    this.mapCanvas = this.mapCanvasRef.nativeElement;
    this.gridCanvas = this.gridCanvasRef.nativeElement;
    this.mapCtx = this.mapCanvas.getContext('2d')!;
    this.gridCtx = this.gridCanvas.getContext('2d')!;

    this.resizeCanvas();
    this.setupMouseEvents();
    window.addEventListener('resize', () => this.resizeCanvas());

    const img = new Image();
    img.onload = () => {
      this.mapImage = img;
      this.render();
    };
    img.src = 'demo_map.jpg';
  }

  ngOnDestroy(): void {
    if (this.localImageObjectUrl) {
      URL.revokeObjectURL(this.localImageObjectUrl);
    }
  }

  /* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */
  canEdit(): boolean {
    return true;
  }

  isOwner(): boolean {
    return false;
  }

  getJoinUrl(): string {
    return '';
  }

  copyJoinCode(): void {
  }

  copyJoinUrl(): void {
  }

  getCurrentUserId(): number | null {
    return null;
  }

  promoteMember(_userId: number): void {
  }

  demoteMember(_userId: number): void {
  }

  transferOwnership(_userId: number): void {
  }

  removeMember(_userId: number): void {
  }

  onMapNameChange(): void {
  }

  dismissCacheStale(): void {
  }

  /* eslint-enable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    if (this.localImageObjectUrl) URL.revokeObjectURL(this.localImageObjectUrl);

    this.localImageFile = input.files[0];
    this.localImageObjectUrl = URL.createObjectURL(this.localImageFile);

    this.mapImage = new Image();
    this.mapImage.onload = () => this.render();
    this.mapImage.src = this.localImageObjectUrl;
    this.mapData.imageUrl = this.localImageObjectUrl;
  }

  onGridChange(): void {
    this.render();
  }

  toggleGridLock(): void {
    if (!this.gridLocked) {
      this.gridScaleRatio = this.gridScale / this.scale;
      this.gridOffsetRatioX = this.gridOffsetX - this.offsetX;
      this.gridOffsetRatioY = this.gridOffsetY - this.offsetY;
    }
    this.gridLocked = !this.gridLocked;
    this.render();
  }

  setGridType(type: 'square' | 'hex'): void {
    this.gridType = type;
    this.gridStrategy = type === 'square' ? new SquareGridStrategy() : new HexGridStrategy(this.hexOrientation);
    this.render();
  }

  setHexOrientation(orientation: HexOrientation): void {
    this.hexOrientation = orientation;
    if (this.gridType === 'hex') {
      this.gridStrategy = new HexGridStrategy(orientation);
      this.render();
    }
  }

  setActiveTab(tab: TabType): void {
    if (this.activeTab === tab && this.isPanelExpanded) {
      this.isPanelExpanded = false;
    } else {
      this.activeTab = tab;
      this.isPanelExpanded = true;
    }
  }

  onCellNameChange(): void {
    if (this.selectedCell) {
      this.cellData.set(`${this.selectedCell.row}:${this.selectedCell.col}`, this.selectedCellName);
    }
  }

  loginAndSave(): void {
    const persist = (imageBase64: string | null, imageMimeType: string | null) => {
      localStorage.setItem('demoState', JSON.stringify({
        mapName: this.mapData.name,
        gridType: this.gridType,
        gridSize: this.gridSize,
        gridOffsetX: this.gridOffsetX,
        gridOffsetY: this.gridOffsetY,
        gridScale: this.gridScale,
        gridScaleRatio: this.gridScaleRatio,
        hexOrientation: this.hexOrientation,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        scale: this.scale,
        cellData: Array.from(this.cellData.entries()),
        imageBase64,
        imageMimeType,
      }));
      localStorage.setItem('postLoginAction', 'saveDemoMap');
      this.authService.login();
    };

    if (this.localImageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        persist((reader.result as string).split(',')[1], this.localImageFile!.type);
      };
      reader.readAsDataURL(this.localImageFile);
    } else {
      persist(null, null);
    }
  }

  private resizeCanvas(): void {
    const container = this.mapCanvas.parentElement!;
    this.mapCanvas.width = container.clientWidth;
    this.mapCanvas.height = container.clientHeight;
    this.gridCanvas.width = container.clientWidth;
    this.gridCanvas.height = container.clientHeight;
    this.render();
  }

  private render(): void {
    this.drawMap();
    this.drawGrid();
  }

  private drawMap(): void {
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

  private drawGrid(): void {
    if (!this.gridCanvas || !this.gridCtx) return;

    let imageBounds;
    if (this.mapImage) {
      imageBounds = {
        x: this.offsetX,
        y: this.offsetY,
        width: this.mapImage.width * this.scale,
        height: this.mapImage.height * this.scale
      };
    }

    this.gridStrategy.draw(
      this.gridCtx,
      this.gridCanvas.width,
      this.gridCanvas.height,
      this.gridSize,
      this.gridOffsetX,
      this.gridOffsetY,
      this.gridScale,
      this.gridLocked,
      imageBounds
    );

    if (this.selectedCell && this.gridStrategy.drawHighlight) {
      this.gridCtx.save();
      this.gridCtx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      this.gridCtx.lineWidth = 3;
      this.gridStrategy.drawHighlight(this.gridCtx, this.selectedCell, this.gridSize, this.gridOffsetX, this.gridOffsetY, this.gridScale);
      this.gridCtx.restore();
    }
  }

  private setupMouseEvents(): void {
    let isDragging = false;
    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;

    this.gridCanvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragMoved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      this.mouseDownTime = Date.now();
    });

    this.gridCanvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      dragMoved = true;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (this.gridLocked) {
        this.offsetX += dx;
        this.offsetY += dy;
        this.gridOffsetX = this.offsetX + this.gridOffsetRatioX;
        this.gridOffsetY = this.offsetY + this.gridOffsetRatioY;
      } else {
        this.gridOffsetX += dx;
        this.gridOffsetY += dy;
      }
      this.render();
    });

    this.gridCanvas.addEventListener('mouseup', (e) => {
      if (!dragMoved) {
        const rect = this.gridCanvas.getBoundingClientRect();
        this.selectedCell = this.gridStrategy.getCellFromPoint(
          e.clientX - rect.left,
          e.clientY - rect.top,
          this.gridSize, this.gridOffsetX, this.gridOffsetY, this.gridScale
        );
        this.render();
      }
      isDragging = false;
    });

    this.gridCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;
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
}
