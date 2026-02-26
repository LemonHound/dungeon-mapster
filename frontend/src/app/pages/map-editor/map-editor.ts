import {Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {GridCell, GridStrategy} from '../../models/grid-strategy.interface';
import { SquareGridStrategy } from '../../models/square-grid.strategy';
import { HexGridStrategy, HexOrientation } from '../../models/hex-grid.strategy';
import {MapService, DungeonMap, MapMembership} from '../../services/map';
import {GridCellDataService} from '../../services/grid-cell-data.service';
import {AuthService, User} from '../../services/auth.service';
import {MapImageCacheService} from '../../services/map-image-cache.service';
import {HttpClient} from '@angular/common/http';

type TabType = 'map-details' | 'grid' | 'variables' | 'members' | 'actions';

@Component({
  selector: 'app-map-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './map-editor.html',
  styleUrl: './map-editor.css',
})
export class MapEditor implements AfterViewInit, OnInit, OnDestroy {
  public isDemo = false;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mapService = inject(MapService);
  private gridCellDataService = inject(GridCellDataService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private cacheService = inject(MapImageCacheService);

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

  private mouseDownTime = 0;
  public selectedCell: GridCell | null = null;
  public selectedCellName = '';
  private cellNameTimeout?: NodeJS.Timeout | number;

  public activeTab: TabType = 'grid';
  public isPanelExpanded = false;

  public imageLoading = false;
  public noImagePrompt = false;
  public cacheStaleMessage: string | null = null;
  public cacheStaleIsError = false;
  private cacheStaleTimeout?: NodeJS.Timeout | number;
  private hadLocalChangesWhenCachedServed = false;

  public mapData: DungeonMap = {
    name: 'Untitled Map',
    gridType: 'square',
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    gridRotation: 0,
    gridScale: 1,
  };

  private mapId?: number;
  private saveTimeout?: NodeJS.Timeout | number;

  public userRole: 'OWNER' | 'DM' | 'PLAYER' | null = null;
  public members: MapMembership[] = [];
  public memberUsers = new Map<number, User>();
  public loadingMemberId: number | null = null;

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

  canEdit(): boolean {
    return this.userRole === 'OWNER' || this.userRole === 'DM';
  }

  isOwner(): boolean {
    return this.userRole === 'OWNER';
  }

  getJoinUrl(): string {
    if (!this.mapData.joinCode) return '';
    return `${window.location.origin}/join/${this.mapData.joinCode}`;
  }

  copyJoinCode(): void {
    if (!this.mapData.joinCode) return;
    navigator.clipboard.writeText(this.mapData.joinCode);
  }

  copyJoinUrl(): void {
    navigator.clipboard.writeText(this.getJoinUrl());
  }

  promoteMember(userId: number): void {
    if (!this.mapId) return;
    this.loadingMemberId = userId;
    this.mapService.promoteUser(this.mapId, userId).subscribe({
      next: () => {
        this.loadingMemberId = null;
        this.loadMembership();
      },
      error: (error) => {
        console.error('Error promoting user:', error);
        this.loadingMemberId = null;
      }
    });
  }

  demoteMember(userId: number): void {
    if (!this.mapId) return;
    this.loadingMemberId = userId;
    this.mapService.demoteUser(this.mapId, userId).subscribe({
      next: () => {
        this.loadingMemberId = null;
        this.loadMembership();
      },
      error: (error) => {
        console.error('Error demoting user:', error);
        this.loadingMemberId = null;
      }
    });
  }

  transferOwnership(userId: number): void {
    if (!this.mapId) return;
    if (!confirm('Are you sure you want to transfer ownership? You will become a DM.')) return;
    this.loadingMemberId = userId;
    this.mapService.transferOwnership(this.mapId, userId).subscribe({
      next: () => {
        this.loadingMemberId = null;
        this.loadMembership();
      },
      error: (error) => {
        console.error('Error transferring ownership:', error);
        this.loadingMemberId = null;
      }
    });
  }

  removeMember(userId: number): void {
    if (!this.mapId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
    this.loadingMemberId = userId;
    this.mapService.removeMember(this.mapId, userId).subscribe({
      next: () => {
        this.loadingMemberId = null;
        this.loadMembership();
      },
      error: (error) => {
        console.error('Error removing member:', error);
        this.loadingMemberId = null;
      }
    });
  }

  getCurrentUserId(): number | null {
    let userId: number | null = null;
    this.authService.currentUser$.subscribe(user => {
      if (user) userId = user.id;
    });
    return userId;
  }

  dismissCacheStale(): void {
    this.cacheStaleMessage = null;
    if (this.cacheStaleTimeout) clearTimeout(this.cacheStaleTimeout);
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
        this.loadMembership();
        this.applyMapData();
      },
      error: (error) => {
        console.error('Error loading map:', error);
        this.router.navigate(['/maps']);
      }
    });
  }

  private loadMembership(): void {
    if (!this.mapId) return;

    this.mapService.getMembers(this.mapId).subscribe({
      next: (members) => {
        this.members = members;

        const userIds = members.map(m => m.userId);
        this.authService.getUsersByIds(userIds).subscribe({
          next: (users) => {
            this.memberUsers.clear();
            users.forEach(user => this.memberUsers.set(user.id, user));
          },
          error: (error) => console.error('Error loading user details:', error)
        });

        this.authService.currentUser$.subscribe(user => {
          if (user) {
            const membership = members.find(m => m.userId === user.id);
            this.userRole = membership?.role || null;
          }
        });
      },
      error: (error) => console.error('Error loading members:', error)
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
    this.gridScale = this.mapData.gridScale || 1;
    this.hexOrientation = (this.mapData.hexOrientation as HexOrientation) || 'flat';
    this.offsetX = this.mapData.mapOffsetX || 0;
    this.offsetY = this.mapData.mapOffsetY || 0;
    this.scale = this.mapData.mapScale || 1;

    this.gridScaleRatio = this.gridScale / this.scale;
    this.gridOffsetRatioX = this.gridOffsetX - this.offsetX;
    this.gridOffsetRatioY = this.gridOffsetY - this.offsetY;

    if (this.gridType === 'square') {
      this.gridStrategy = new SquareGridStrategy();
    } else {
      this.gridStrategy = new HexGridStrategy(this.hexOrientation);
    }

    if (this.mapData.imageUrl) {
      this.loadMapImageWithCache(this.mapData.imageUrl);
    } else {
      this.noImagePrompt = true;
    }
  }

  private async loadMapImageWithCache(imageUrl: string): Promise<void> {
    const cached = await this.cacheService.get(imageUrl);

    if (cached) {
      const objectUrl = URL.createObjectURL(cached);
      this.mapImage = new Image();
      this.mapImage.onload = () => {
        this.render();
        URL.revokeObjectURL(objectUrl);
      };
      this.mapImage.src = objectUrl;
      this.hadLocalChangesWhenCachedServed = false;

      this.http.get(`/api/upload/image/${imageUrl}`, {responseType: 'blob'}).subscribe({
        next: async (freshBlob) => {
          const freshUrl = URL.createObjectURL(freshBlob);
          const freshImg = new Image();
          freshImg.onload = async () => {
            const stale = this.mapImage!.naturalWidth !== freshImg.naturalWidth ||
              this.mapImage!.naturalHeight !== freshImg.naturalHeight;
            if (stale) {
              this.mapImage = freshImg;
              this.render();
              await this.cacheService.put(imageUrl, freshBlob);
              if (this.hadLocalChangesWhenCachedServed) {
                this.cacheStaleIsError = true;
                this.cacheStaleMessage = 'Your cached map image was out of sync. Any unsaved changes to this map have been lost.';
              } else {
                this.cacheStaleIsError = false;
                this.cacheStaleMessage = 'Your cached map image was out of sync and has been updated.';
                this.cacheStaleTimeout = setTimeout(() => this.cacheStaleMessage = null, 10000);
              }
            } else {
              URL.revokeObjectURL(freshUrl);
            }
          };
          freshImg.src = freshUrl;
        },
        error: (e) => console.error('Background image fetch failed:', e)
      });
    } else {
      this.imageLoading = true;
      this.http.get(`/api/upload/image/${imageUrl}`, {responseType: 'blob'}).subscribe({
        next: async (blob) => {
          await this.cacheService.put(imageUrl, blob);
          const objectUrl = URL.createObjectURL(blob);
          this.mapImage = new Image();
          this.mapImage.onload = () => {
            this.imageLoading = false;
            this.render();
            URL.revokeObjectURL(objectUrl);
          };
          this.mapImage.src = objectUrl;
        },
        error: (e) => {
          console.error('Image failed to load:', e);
          this.imageLoading = false;
        }
      });
    }
  }

  private scheduleAutoSave(): void {
    this.hadLocalChangesWhenCachedServed = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveMap();
    }, 3000);
  }

  private saveMap(): void {
    if (!this.canEdit()) return;
    if (!this.mapId) return;
    this.mapData.gridType = this.gridType;
    this.mapData.gridSize = this.gridSize;
    this.mapData.gridOffsetX = this.gridOffsetX;
    this.mapData.gridOffsetY = this.gridOffsetY;
    this.mapData.gridScale = this.gridScale;
    this.mapData.hexOrientation = this.hexOrientation;
    this.mapData.mapOffsetX = this.offsetX;
    this.mapData.mapOffsetY = this.offsetY;
    this.mapData.mapScale = this.scale;

    this.mapService.updateMap(this.mapId, this.mapData).subscribe({
      next: (updated) => this.mapData = updated,
      error: (error) => console.error('Error saving map:', error)
    });
  }

  onFileSelected(event: Event): void {
    if (!this.canEdit()) return;
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const localObjectUrl = URL.createObjectURL(file);

    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.noImagePrompt = false;
      this.render();
    };
    this.mapImage.src = localObjectUrl;

    const previousImageUrl = this.mapData.imageUrl;

    this.mapService.uploadImage(file).subscribe({
      next: async (response) => {
        URL.revokeObjectURL(localObjectUrl);
        if (previousImageUrl) {
          await this.cacheService.evict(previousImageUrl);
        }
        this.http.get(`/api/upload/image/${response.imageUrl}`, {responseType: 'blob'}).subscribe({
          next: async (blob) => {
            await this.cacheService.put(response.imageUrl, blob);
          },
          error: (e) => console.error('Failed to cache uploaded image:', e)
        });
        this.mapData.imageUrl = response.imageUrl;
        this.scheduleAutoSave();
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        URL.revokeObjectURL(localObjectUrl);
      }
    });
  }

  onMapNameChange(): void {
    if (!this.canEdit()) return;
    this.scheduleAutoSave();
  }

  onGridChange(): void {
    this.scheduleAutoSave();
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
    if (!this.canEdit()) return;
    this.gridType = type;
    this.gridStrategy = type === 'square' ?
      new SquareGridStrategy() : new HexGridStrategy(this.hexOrientation);
    this.render();
    this.scheduleAutoSave();
  }

  setHexOrientation(orientation: HexOrientation) {
    if (!this.canEdit()) return;
    this.hexOrientation = orientation;
    if (this.gridType === 'hex') {
      this.gridStrategy = new HexGridStrategy(orientation);
      this.render();
      this.scheduleAutoSave();
    }
  }

  setActiveTab(tab: TabType) {
    if (this.activeTab === tab && this.isPanelExpanded) {
      this.isPanelExpanded = false;
    } else {
      this.activeTab = tab;
      this.isPanelExpanded = true;
    }
  }

  onCellNameChange() {
    if (!this.canEdit()) return;
    if (this.cellNameTimeout) {
      clearTimeout(this.cellNameTimeout);
    }

    this.cellNameTimeout = setTimeout(() => {
      if (this.selectedCell && this.mapId) {
        this.saveCellName();
      }
    }, 300);
  }

  private saveCellName() {
    if (!this.canEdit()) return;
    if (!this.selectedCell || !this.mapId) return;

    this.gridCellDataService.saveCell(
      this.mapId,
      this.selectedCell.row,
      this.selectedCell.col,
      this.selectedCellName
    ).subscribe({
      next: () => console.log('Cell name saved'),
      error: (error: unknown) => console.error('Error saving cell name:', error)
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  loginAndSave(): void {
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
    this.mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    if (!this.mapImage) return;
    this.mapCtx.drawImage(
      this.mapImage,
      this.offsetX,
      this.offsetY,
      this.mapImage.width * this.scale,
      this.mapImage.height * this.scale
    );
  }

  private drawGrid() {
    if (!this.gridCanvas || !this.gridCtx) return;
    if (!this.mapImage) return;

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
      this.gridStrategy.drawHighlight(
        this.gridCtx,
        this.selectedCell,
        this.gridSize,
        this.gridOffsetX,
        this.gridOffsetY,
        this.gridScale
      );
    }
  }

  private setupMouseEvents(): void {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.gridCanvas.addEventListener('mousedown', (e) => {
      this.mouseDownTime = Date.now();
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

    this.gridCanvas.addEventListener('mouseup', (e) => {
      const clickDuration = Date.now() - this.mouseDownTime;
      if (clickDuration < 200 && this.gridLocked) {
        const rect = this.gridCanvas.getBoundingClientRect();
        this.handleCellClick(e.clientX - rect.left, e.clientY - rect.top);
      }
      isDragging = false;
      if (!this.gridLocked) {
        this.scheduleAutoSave();
      }
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

  private handleCellClick(x: number, y: number) {
    this.selectedCell = this.gridStrategy.getCellFromPoint(
      x,
      y,
      this.gridSize,
      this.gridOffsetX,
      this.gridOffsetY,
      this.gridScale
    );

    if (this.selectedCell && this.mapId) {
      this.gridCellDataService.getCell(
        this.mapId,
        this.selectedCell.row,
        this.selectedCell.col
      ).subscribe({
        next: (cellData) => this.selectedCellName = cellData.name || '',
        error: () => this.selectedCellName = ''
      });
    }

    this.render();
  }
}
