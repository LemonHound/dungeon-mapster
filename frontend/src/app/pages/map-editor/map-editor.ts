import {Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, NgZone, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {GridCell, GridStrategy} from '../../models/grid-strategy.interface';
import {SquareGridStrategy} from '../../models/square-grid.strategy';
import {HexGridStrategy, HexOrientation} from '../../models/hex-grid.strategy';
import {MapService, DungeonMap, MapMembership} from '../../services/map';
import {GridCellDataService} from '../../services/grid-cell-data.service';
import {AuthService, User} from '../../services/auth.service';
import {MapImageCacheService} from '../../services/map-image-cache.service';
import {WebSocketService} from '../../services/websocket.service';
import {HttpClient} from '@angular/common/http';
import {UserPresence, SelectionState, FieldFocusState, WsMessage} from '../../models/presence.model';
import {Subscription} from 'rxjs';
import {MapVariableService} from '../../services/map-variable.service';
import {CellVariableValueService} from '../../services/cell-variable-value.service';
import {MapVariable, CellVariableValue} from '../../models/map-variable.model';
import {NoteService} from '../../services/note.service';
import {NoteBundle} from '../../models/note.model';
import {EditorActionsService} from '../../services/editor-actions.service';

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
  private wsService = inject(WebSocketService);
  private mapVariableService = inject(MapVariableService);
  private cellVariableValueService = inject(CellVariableValueService);
  private noteService = inject(NoteService);
  private editorActionsService = inject(EditorActionsService);
  private ngZone = inject(NgZone);

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
  private cellNameTimeout?: ReturnType<typeof setTimeout>;

  public activePanel: 'cell' | 'notes' | 'admin' | null = null;
  public adminTab: 'map' | 'members' | 'variables' = 'map';
  public cellNoteTab: 'shared' | 'public' | 'private' = 'shared';
  public showGrid = true;
  public notesAccordion: Record<string, boolean> = {};
  public cellNoteBundle: NoteBundle | null = null;
  public mapNoteBundle: NoteBundle | null = null;
  private noteSaveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  public imageLoading = false;
  public noImagePrompt = false;
  public cacheStaleMessage: string | null = null;
  public cacheStaleIsError = false;
  private cacheStaleTimeout?: ReturnType<typeof setTimeout>;
  private hadLocalChangesWhenCachedServed = false;
  private cellCache = new Map<string, string>();

  public variables: MapVariable[] = [];
  public cellVariableValues = new Map<string, CellVariableValue[]>();
  public manageVariablesOpen = false;
  public variableForm: Partial<MapVariable> | null = null;
  public editingVariableId: string | null = null;
  public newPicklistLabel = '';
  public activeTintVariableId: string | null = null;
  private variableSaveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

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
  private saveTimeout?: ReturnType<typeof setTimeout>;

  public userRole: 'OWNER' | 'DM' | 'PLAYER' | null = null;
  public members: MapMembership[] = [];
  public memberUsers = new Map<number, User>();
  public loadingMemberId: number | null = null;

  public connectionStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  public connectedUsers: UserPresence[] = [];
  public remoteSelections = new Map<number, SelectionState>();
  public remoteFieldFocus: FieldFocusState | null = null;

  private wsSub?: Subscription;
  private statusSub?: Subscription;
  private adminClickSub?: Subscription;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id && id !== 'new') {
      this.mapId = parseInt(id);
      this.loadMap(this.mapId);
    } else {
      this.createInitialMap();
    }

    this.adminClickSub = this.editorActionsService.dmAdminClicked.subscribe(() => {
      this.toggleAdminPanel();
    });
  }

  ngAfterViewInit(): void {
    this.mapCanvas = this.mapCanvasRef.nativeElement;
    this.gridCanvas = this.gridCanvasRef.nativeElement;
    this.mapCtx = this.mapCanvas.getContext('2d')!;
    this.gridCtx = this.gridCanvas.getContext('2d')!;

    this.resizeCanvas();
    this.setupMouseEvents();
    this.setupTouchEvents();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  ngOnDestroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveMap();
    }
    this.wsSub?.unsubscribe();
    this.statusSub?.unsubscribe();
    this.wsService.disconnect();
    this.variableSaveTimeouts.forEach(t => clearTimeout(t));
    this.noteSaveTimeouts.forEach(t => clearTimeout(t));
    this.adminClickSub?.unsubscribe();
    this.editorActionsService.setDmAdminVisible(false);
    this.editorActionsService.setDmAdminActive(false);
  }

  canEdit(): boolean {
    return this.userRole === 'OWNER' || this.userRole === 'DM' || this.userRole === 'PLAYER';
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
            const isDmOrOwner = this.isDmOrOwner();
            this.editorActionsService.setDmAdminVisible(isDmOrOwner);
            if (isDmOrOwner && !this.mapData.imageUrl) {
              this.activePanel = 'admin';
              this.editorActionsService.setDmAdminActive(true);
            }
            if (this.mapId) this.connectWebSocket(this.mapId);
          }
        });
      },
      error: (error) => console.error('Error loading members:', error)
    });
  }

  private connectWebSocket(mapId: number): void {
    this.wsService.connect(mapId);

    this.statusSub = this.wsService.connectionStatus$.subscribe(status => {
      this.connectionStatus = status;
    });

    this.wsSub = this.wsService.messages$.subscribe(msg => this.handleWsMessage(msg));
  }

  private handleWsMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'FULL_STATE': {
        this.connectedUsers = msg.users;
        this.cellCache.clear();
        this.cellVariableValues.clear();
        msg.cellData.forEach(c => {
          this.cellCache.set(`${c.row}:${c.col}`, c.name);
          if (c.variableValues?.length) {
            this.cellVariableValues.set(`${c.row}:${c.col}`, c.variableValues);
          }
        });
        this.variables = msg.variables ?? [];
        break;
      }
      case 'USER_JOINED': {
        const existing = this.connectedUsers.find(u => u.userId === msg.userId);
        if (!existing) {
          this.connectedUsers = [...this.connectedUsers, {
            userId: msg.userId,
            userName: msg.userName,
            color: msg.color,
            role: msg.role as UserPresence['role'],
          }];
        }
        break;
      }
      case 'USER_LEFT': {
        this.connectedUsers = this.connectedUsers.filter(u => u.userId !== msg.userId);
        this.remoteSelections.delete(msg.userId);
        if (this.remoteFieldFocus?.userId === msg.userId) this.remoteFieldFocus = null;
        this.render();
        break;
      }
      case 'SELECTION': {
        this.remoteSelections.set(msg.userId, {userId: msg.userId, row: msg.row, col: msg.col, color: msg.color});
        this.render();
        break;
      }
      case 'FIELD_FOCUS': {
        this.remoteFieldFocus = {userId: msg.userId, row: msg.row, col: msg.col, field: msg.field, color: msg.color};
        break;
      }
      case 'FIELD_BLUR': {
        if (this.remoteFieldFocus?.userId === msg.userId) this.remoteFieldFocus = null;
        break;
      }
      case 'CELL_UPDATE': {
        if (msg.field === 'name') {
          this.cellCache.set(`${msg.row}:${msg.col}`, msg.value);
        }
        if (
          this.selectedCell?.row === msg.row &&
          this.selectedCell?.col === msg.col &&
          msg.field === 'name'
        ) {
          this.selectedCellName = msg.value;
        }
        break;
      }
      case 'MAP_UPDATE': {
        this.applyRemoteMapField(msg.field, msg.value);
        break;
      }
      case 'CELL_VARIABLE_UPDATE': {
        const key = `${msg.row}:${msg.col}`;
        const existing = [...(this.cellVariableValues.get(key) ?? [])];
        if (msg.cleared) {
          this.cellVariableValues.set(key, existing.filter(v => v.variableId !== msg.variableId));
        } else {
          const idx = existing.findIndex(v => v.variableId === msg.variableId);
          if (idx >= 0) existing[idx] = {variableId: msg.variableId, value: msg.value};
          else existing.push({variableId: msg.variableId, value: msg.value});
          this.cellVariableValues.set(key, existing);
        }
        if (this.activeTintVariableId === msg.variableId) this.render();
        break;
      }
      case 'VARIABLE_CREATED': {
        if (!this.variables.find(v => v.id === msg.variable.id)) {
          this.variables = [...this.variables, msg.variable].sort((a, b) => a.sortOrder - b.sortOrder);
        }
        break;
      }
      case 'VARIABLE_UPDATED': {
        this.variables = this.variables.map(v => v.id === msg.variable.id ? msg.variable : v);
        break;
      }
      case 'VARIABLE_DELETED': {
        this.variables = this.variables.filter(v => v.id !== msg.variableId);
        if (this.activeTintVariableId === msg.variableId) {
          this.activeTintVariableId = null;
          this.render();
        }
        for (const [key, vals] of this.cellVariableValues) {
          this.cellVariableValues.set(key, vals.filter(v => v.variableId !== msg.variableId));
        }
        break;
      }
      case 'PICKLIST_VALUE_ADDED':
      case 'PICKLIST_VALUE_UPDATED': {
        this.variables = this.variables.map(v => {
          if (v.id !== msg.variableId) return v;
          const pvList = v.picklistValues ?? [];
          const idx = pvList.findIndex(p => p.id === msg.picklistValue.id);
          const updated = idx >= 0
            ? pvList.map(p => p.id === msg.picklistValue.id ? msg.picklistValue : p)
            : [...pvList, msg.picklistValue];
          return {...v, picklistValues: updated.sort((a, b) => a.sortOrder - b.sortOrder)};
        });
        if (this.activeTintVariableId === msg.variableId) this.render();
        break;
      }
      case 'PICKLIST_VALUE_DELETED': {
        this.variables = this.variables.map(v => {
          if (v.id !== msg.variableId) return v;
          return {...v, picklistValues: (v.picklistValues ?? []).filter(p => p.id !== msg.picklistValueId)};
        });
        for (const [key, vals] of this.cellVariableValues) {
          this.cellVariableValues.set(key,
            vals.filter(v => !(v.variableId === msg.variableId && v.value === msg.picklistValueId))
          );
        }
        if (this.activeTintVariableId === msg.variableId) this.render();
        break;
      }
    }
  }

  private applyRemoteMapField(field: string, value: unknown): void {
    switch (field) {
      case 'name':
        this.mapData.name = value as string;
        break;
      case 'gridType':
        this.gridType = value as 'square' | 'hex';
        this.mapData.gridType = this.gridType;
        this.gridStrategy = this.gridType === 'square' ? new SquareGridStrategy() : new HexGridStrategy(this.hexOrientation);
        break;
      case 'gridSize':
        this.gridSize = Number(value);
        break;
      case 'gridOffsetX':
        this.gridOffsetX = Number(value);
        break;
      case 'gridOffsetY':
        this.gridOffsetY = Number(value);
        break;
      case 'gridScale':
        this.gridScale = Number(value);
        break;
      case 'gridRotation':
        this.mapData.gridRotation = Number(value);
        break;
      case 'hexOrientation':
        this.hexOrientation = value as HexOrientation;
        if (this.gridType === 'hex') this.gridStrategy = new HexGridStrategy(this.hexOrientation);
        break;
      case 'mapOffsetX':
        this.offsetX = Number(value);
        break;
      case 'mapOffsetY':
        this.offsetY = Number(value);
        break;
      case 'mapScale':
        this.scale = Number(value);
        break;
    }
    this.render();
  }

  private createInitialMap(): void {
    this.mapService.createMap(this.mapData).subscribe({
      next: (created) => {
        this.mapData = created;
        this.mapId = created.id;
        this.router.navigate(['/map-editor', this.mapId], {replaceUrl: true});
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
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveMap(), 3000);
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
        if (previousImageUrl) await this.cacheService.evict(previousImageUrl);
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
    this.gridStrategy = type === 'square' ? new SquareGridStrategy() : new HexGridStrategy(this.hexOrientation);
    this.render();
    this.scheduleAutoSave();
  }

  setHexOrientation(orientation: HexOrientation): void {
    if (!this.canEdit()) return;
    this.hexOrientation = orientation;
    if (this.gridType === 'hex') {
      this.gridStrategy = new HexGridStrategy(orientation);
      this.render();
      this.scheduleAutoSave();
    }
  }

  closePanel(): void {
    this.activePanel = null;
    if (this.editorActionsService) {
      this.editorActionsService.setDmAdminActive(false);
    }
  }

  handleNotesFab(): void {
    if (this.activePanel === 'notes') {
      this.closePanel();
    } else {
      this.activePanel = 'notes';
      this.editorActionsService.setDmAdminActive(false);
      if (this.mapId && this.mapNoteBundle === null) {
        this.loadMapNotes();
      }
    }
  }

  toggleAdminPanel(): void {
    if (this.activePanel === 'admin') {
      this.closePanel();
    } else {
      this.activePanel = 'admin';
      this.editorActionsService.setDmAdminActive(true);
    }
  }

  toggleShowGrid(): void {
    this.render();
  }

  toggleAccordion(key: string): void {
    this.notesAccordion[key] = !this.notesAccordion[key];
  }

  getCellLabel(): string {
    if (!this.selectedCell) return '—';
    const col = this.selectedCell.col;
    const row = this.selectedCell.row + 1;
    let colLabel = '';
    let c = col;
    do {
      colLabel = String.fromCharCode(65 + (c % 26)) + colLabel;
      c = Math.floor(c / 26) - 1;
    } while (c >= 0);
    return colLabel + row;
  }

  getMemberName(userId: number): string {
    return this.memberUsers.get(userId)?.name ?? `User ${userId}`;
  }

  getMemberInitials(userId: number): string {
    const name = this.memberUsers.get(userId)?.name;
    if (!name) return '?';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getMemberBgColor(userId: number): string {
    const colors = ['#e74c3c','#3498db','#27ae60','#f39c12','#9b59b6','#1abc9c','#e67e22','#2980b9'];
    return colors[userId % colors.length];
  }

  getMemberFgColor(_userId: number): string {
    return '#ffffff';
  }

  isUserOnline(userId: number): boolean {
    return this.connectedUsers.some(u => u.userId === userId);
  }

  startCreateVariableAdmin(): void {
    this.manageVariablesOpen = true;
    this.variableForm = {dataType: 'TEXT', visibility: 'PLAYER_EDIT', showColorOnCells: false};
    this.editingVariableId = null;
  }

  private loadCellNotes(row: number, col: number): void {
    if (!this.mapId) return;
    this.cellNoteBundle = null;
    this.noteService.getCellNotes(this.mapId, row, col).subscribe({
      next: (bundle) => this.cellNoteBundle = bundle,
      error: (e) => console.error('Error loading cell notes:', e)
    });
  }

  private loadMapNotes(): void {
    if (!this.mapId) return;
    this.noteService.getMapNotes(this.mapId).subscribe({
      next: (bundle) => this.mapNoteBundle = bundle,
      error: (e) => console.error('Error loading map notes:', e)
    });
  }

  onCellNoteChange(type: 'shared' | 'public' | 'private', content: string): void {
    if (!this.cellNoteBundle) this.cellNoteBundle = {sharedContent: null, myPublicContent: null, myPrivateContent: null, othersPublic: []};
    if (type === 'shared') this.cellNoteBundle = {...this.cellNoteBundle, sharedContent: content};
    if (type === 'public') this.cellNoteBundle = {...this.cellNoteBundle, myPublicContent: content};
    if (type === 'private') this.cellNoteBundle = {...this.cellNoteBundle, myPrivateContent: content};
    this.debounceSaveCellNote(type, content);
  }

  onMapNoteChange(type: 'shared' | 'public' | 'private', content: string): void {
    if (!this.mapNoteBundle) this.mapNoteBundle = {sharedContent: null, myPublicContent: null, myPrivateContent: null, othersPublic: []};
    if (type === 'shared') this.mapNoteBundle = {...this.mapNoteBundle, sharedContent: content};
    if (type === 'public') this.mapNoteBundle = {...this.mapNoteBundle, myPublicContent: content};
    if (type === 'private') this.mapNoteBundle = {...this.mapNoteBundle, myPrivateContent: content};
    this.debounceSaveMapNote(type, content);
  }

  private debounceSaveCellNote(type: 'shared' | 'public' | 'private', content: string): void {
    if (!this.selectedCell || !this.mapId) return;
    const key = `cell:${this.selectedCell.row}:${this.selectedCell.col}:${type}`;
    const existing = this.noteSaveTimeouts.get(key);
    if (existing) clearTimeout(existing);
    const row = this.selectedCell.row;
    const col = this.selectedCell.col;
    this.noteSaveTimeouts.set(key, setTimeout(() => {
      if (!this.mapId) return;
      this.noteService.saveCellNote(this.mapId, row, col, type, content).subscribe({
        error: (e) => console.error('Error saving cell note:', e)
      });
    }, 500));
  }

  private debounceSaveMapNote(type: 'shared' | 'public' | 'private', content: string): void {
    if (!this.mapId) return;
    const key = `map:${type}`;
    const existing = this.noteSaveTimeouts.get(key);
    if (existing) clearTimeout(existing);
    this.noteSaveTimeouts.set(key, setTimeout(() => {
      if (!this.mapId) return;
      this.noteService.saveMapNote(this.mapId, type, content).subscribe({
        error: (e) => console.error('Error saving map note:', e)
      });
    }, 500));
  }

  onCellNameChange(): void {
    if (!this.canEdit()) return;
    if (this.cellNameTimeout) clearTimeout(this.cellNameTimeout);

    if (this.selectedCell) {
      this.wsService.sendFieldFocus(this.selectedCell.row, this.selectedCell.col, 'name');
    }

    this.cellNameTimeout = setTimeout(() => {
      if (this.selectedCell && this.mapId) {
        this.saveCellName();
      }
    }, 300);
  }

  private saveCellName(): void {
    if (!this.canEdit()) return;
    if (!this.selectedCell || !this.mapId) return;

    this.gridCellDataService.saveCell(
      this.mapId,
      this.selectedCell.row,
      this.selectedCell.col,
      this.selectedCellName
    ).subscribe({
      next: () => {
        if (this.selectedCell) {
          this.cellCache.set(`${this.selectedCell.row}:${this.selectedCell.col}`, this.selectedCellName);
        }
        this.wsService.sendFieldBlur();
      },
      error: (error: unknown) => console.error('Error saving cell name:', error)
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  loginAndSave(): void {
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

  private drawGrid(): void {
    if (!this.gridCanvas || !this.gridCtx) return;
    if (!this.mapImage) return;

    const imageBounds = {
      x: this.offsetX,
      y: this.offsetY,
      width: this.mapImage.width * this.scale,
      height: this.mapImage.height * this.scale
    };

    if (!this.showGrid) {
      this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
      this.drawCellTints(imageBounds);
      return;
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

    this.drawCellTints(imageBounds);

    if (this.gridStrategy.drawHighlight) {
      if (this.selectedCell) {
        this.gridCtx.save();
        this.gridCtx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
        this.gridCtx.lineWidth = 3;
        this.gridStrategy.drawHighlight(
          this.gridCtx,
          this.selectedCell,
          this.gridSize,
          this.gridOffsetX,
          this.gridOffsetY,
          this.gridScale
        );
        this.gridCtx.restore();
      }

      this.remoteSelections.forEach((sel) => {
        this.gridCtx.save();
        this.gridCtx.strokeStyle = sel.color;
        this.gridCtx.lineWidth = 3;
        this.gridStrategy.drawHighlight!(
          this.gridCtx,
          {row: sel.row, col: sel.col},
          this.gridSize,
          this.gridOffsetX,
          this.gridOffsetY,
          this.gridScale
        );
        this.gridCtx.restore();
      });
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
      isDragging = false;
      const clickDuration = Date.now() - this.mouseDownTime;
      if (clickDuration < 200 && this.gridLocked) {
        const rect = this.gridCanvas.getBoundingClientRect();
        this.handleCellClick(e.clientX - rect.left, e.clientY - rect.top);
      }
      if (!this.gridLocked && clickDuration >= 200) {
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

  private setupTouchEvents(): void {
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastX = 0;
    let lastY = 0;
    let cumulativeMovement = 0;
    let isTap = false;
    let isPinching = false;
    let lastPinchDist = 0;
    let lastMidX = 0;
    let lastMidY = 0;

    this.ngZone.runOutsideAngular(() => {
    this.gridCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastX = touch.clientX;
        lastY = touch.clientY;
        cumulativeMovement = 0;
        isTap = true;
        isPinching = false;
      } else if (e.touches.length === 2) {
        isPinching = true;
        isTap = false;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        lastMidX = (t0.clientX + t1.clientX) / 2;
        lastMidY = (t0.clientY + t1.clientY) / 2;
        lastPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      }
    }, { passive: false });

    this.gridCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        cumulativeMovement += Math.abs(dx) + Math.abs(dy);
        if (cumulativeMovement > 5) isTap = false;

        if (this.gridLocked) {
          this.offsetX += dx;
          this.offsetY += dy;
          this.gridOffsetX = this.offsetX + this.gridOffsetRatioX;
          this.gridOffsetY = this.offsetY + this.gridOffsetRatioY;
        } else {
          this.gridOffsetX += dx;
          this.gridOffsetY += dy;
        }
        lastX = touch.clientX;
        lastY = touch.clientY;
        this.render();
      } else if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const rect = this.gridCanvas.getBoundingClientRect();
        const canvasMidX = midX - rect.left;
        const canvasMidY = midY - rect.top;
        const panDx = midX - lastMidX;
        const panDy = midY - lastMidY;

        if (this.gridLocked) {
          this.offsetX += panDx;
          this.offsetY += panDy;
          this.gridOffsetX = this.offsetX + this.gridOffsetRatioX;
          this.gridOffsetY = this.offsetY + this.gridOffsetRatioY;
        } else {
          this.gridOffsetX += panDx;
          this.gridOffsetY += panDy;
        }

        if (lastPinchDist > 0 && dist > 0) {
          const distRatio = dist / lastPinchDist;
          if (this.gridLocked) {
            const newScale = Math.max(0.1, Math.min(5, this.scale * distRatio));
            const scaleChange = newScale / this.scale;
            this.offsetX = canvasMidX - (canvasMidX - this.offsetX) * scaleChange;
            this.offsetY = canvasMidY - (canvasMidY - this.offsetY) * scaleChange;
            this.gridOffsetX = canvasMidX - (canvasMidX - this.gridOffsetX) * scaleChange;
            this.gridOffsetY = canvasMidY - (canvasMidY - this.gridOffsetY) * scaleChange;
            this.scale = newScale;
            this.gridScale = newScale * this.gridScaleRatio;
            this.gridOffsetRatioX = this.gridOffsetX - this.offsetX;
            this.gridOffsetRatioY = this.gridOffsetY - this.offsetY;
          } else {
            const newGridScale = Math.max(0.1, Math.min(5, this.gridScale * distRatio));
            const scaleChange = newGridScale / this.gridScale;
            this.gridOffsetX = canvasMidX - (canvasMidX - this.gridOffsetX) * scaleChange;
            this.gridOffsetY = canvasMidY - (canvasMidY - this.gridOffsetY) * scaleChange;
            this.gridScale = newGridScale;
          }
        }

        lastMidX = midX;
        lastMidY = midY;
        lastPinchDist = dist;
        this.render();
      }
    }, { passive: false });

    this.gridCanvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        if (isTap && Date.now() - touchStartTime < 200 && this.gridLocked) {
          const rect = this.gridCanvas.getBoundingClientRect();
          this.ngZone.run(() => {
            this.handleCellClick(touchStartX - rect.left, touchStartY - rect.top);
          });
        } else if (!this.gridLocked && !isTap) {
          this.ngZone.run(() => {
            this.scheduleAutoSave();
          });
        }
        isPinching = false;
        isTap = false;
      } else if (e.touches.length === 1) {
        isPinching = false;
        isTap = false;
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
      }
    });

    this.gridCanvas.addEventListener('touchcancel', () => {
      isPinching = false;
      isTap = false;
    });
    }); // runOutsideAngular
  }

  private handleCellClick(x: number, y: number): void {
    this.selectedCell = this.gridStrategy.getCellFromPoint(
      x, y, this.gridSize, this.gridOffsetX, this.gridOffsetY, this.gridScale
    );

    if (this.selectedCell) {
      this.wsService.sendSelection(this.selectedCell.row, this.selectedCell.col);
      const key = `${this.selectedCell.row}:${this.selectedCell.col}`;
      this.selectedCellName = this.cellCache.get(key) ?? '';

      if (this.mapId) {
        this.gridCellDataService.ensureCell(this.mapId, this.selectedCell.row, this.selectedCell.col).subscribe({
          next: (cell) => {
            if (cell.name && !this.cellCache.has(key)) {
              this.cellCache.set(key, cell.name);
              if (this.selectedCell?.row === cell.rowIndex && this.selectedCell?.col === cell.colIndex) {
                this.selectedCellName = cell.name;
              }
            }
          }
        });
        this.loadCellNotes(this.selectedCell.row, this.selectedCell.col);
      }

      this.activePanel = 'cell';
    }

    this.render();
  }

  isDmOrOwner(): boolean {
    return this.userRole === 'OWNER' || this.userRole === 'DM';
  }

  get editingVariable(): MapVariable | null {
    return this.variables.find(v => v.id === this.editingVariableId) ?? null;
  }

  openManageVariables(): void {
    this.manageVariablesOpen = true;
    this.variableForm = null;
    this.editingVariableId = null;
  }

  closeManageVariables(): void {
    this.manageVariablesOpen = false;
    this.variableForm = null;
    this.editingVariableId = null;
  }

  startCreateVariable(): void {
    this.variableForm = {dataType: 'TEXT', visibility: 'PLAYER_EDIT', showColorOnCells: false};
    this.editingVariableId = null;
  }

  startEditVariable(variable: MapVariable): void {
    this.variableForm = {...variable};
    this.editingVariableId = variable.id;
  }

  saveVariable(): void {
    if (!this.mapId || !this.variableForm) return;
    if (this.editingVariableId) {
      this.mapVariableService.updateVariable(this.mapId, this.editingVariableId, this.variableForm).subscribe({
        next: () => {
          this.variableForm = null;
          this.editingVariableId = null;
        },
        error: (e) => console.error('Error updating variable:', e)
      });
    } else {
      this.mapVariableService.createVariable(this.mapId, this.variableForm).subscribe({
        next: (created) => {
          if (created.dataType === 'PICKLIST') {
            this.editingVariableId = created.id;
          } else {
            this.variableForm = null;
          }
        },
        error: (e) => console.error('Error creating variable:', e)
      });
    }
  }

  cancelVariableForm(): void {
    this.variableForm = null;
    this.editingVariableId = null;
  }

  confirmDeleteVariable(variable: MapVariable): void {
    if (!this.mapId) return;
    if (!confirm(`Delete variable "${variable.name}"? All cell values will be lost.`)) return;
    this.mapVariableService.deleteVariable(this.mapId, variable.id).subscribe({
      error: (e) => console.error('Error deleting variable:', e)
    });
  }

  addPicklistValue(): void {
    if (!this.mapId || !this.editingVariableId || !this.newPicklistLabel.trim()) return;
    const label = this.newPicklistLabel.trim();
    const existing = this.editingVariable?.picklistValues ?? [];
    if (existing.some(pv => pv.label.toLowerCase() === label.toLowerCase())) {
      alert(`"${label}" already exists in this picklist.`);
      return;
    }

    this.mapVariableService.addPicklistValue(this.mapId, this.editingVariableId, label).subscribe({
      next: () => {
        this.newPicklistLabel = '';
      },
      error: (e) => {
        if (e.status === 409) {
          alert(`"${label}" already exists in this picklist.`);
        } else {
          console.error('Error adding picklist value:', e)
        }
      }
    });
  }

  deletePicklistValueFromForm(pvId: string): void {
    if (!this.editingVariable) return;
    this.deletePicklistValue(this.editingVariable, pvId);
  }

  deletePicklistValue(variable: MapVariable, pvId: string): void {
    if (!this.mapId) return;
    this.mapVariableService.deletePicklistValue(this.mapId, variable.id, pvId).subscribe({
      error: (e) => console.error('Error deleting picklist value:', e)
    });
  }

  getCellVariableValue(variableId: string): string {
    if (!this.selectedCell) return '';
    const key = `${this.selectedCell.row}:${this.selectedCell.col}`;
    return (this.cellVariableValues.get(key) ?? []).find(v => v.variableId === variableId)?.value ?? '';
  }

  onCellVariableChange(variable: MapVariable, value: string): void {
    if (!this.selectedCell || !this.mapId) return;
    const key = `${this.selectedCell.row}:${this.selectedCell.col}`;
    const existing = [...(this.cellVariableValues.get(key) ?? [])];

    if (value === '') {
      this.cellVariableValues.set(key, existing.filter(v => v.variableId !== variable.id));
    } else {
      const idx = existing.findIndex(v => v.variableId === variable.id);
      if (idx >= 0) existing[idx] = {variableId: variable.id, value};
      else existing.push({variableId: variable.id, value});
      this.cellVariableValues.set(key, existing);
    }

    if (this.activeTintVariableId === variable.id) this.render();

    const timeoutKey = `${this.selectedCell.row}:${this.selectedCell.col}:${variable.id}`;
    if (this.variableSaveTimeouts.has(timeoutKey)) clearTimeout(this.variableSaveTimeouts.get(timeoutKey));

    const cell = this.selectedCell;
    this.variableSaveTimeouts.set(timeoutKey, setTimeout(() => {
      if (!this.mapId) return;
      if (value === '') {
        this.cellVariableValueService.clearValue(this.mapId, cell.row, cell.col, variable.id).subscribe({
          error: (e) => console.error('Error clearing variable value:', e)
        });
      } else {
        this.cellVariableValueService.setValue(this.mapId, cell.row, cell.col, variable.id, value).subscribe({
          error: (e) => console.error('Error saving variable value:', e)
        });
      }
    }, 300));
  }

  canEditVariable(variable: MapVariable): boolean {
    if (this.isDmOrOwner()) return true;
    return variable.visibility === 'PLAYER_EDIT';
  }

  getPicklistLabel(variable: MapVariable, valueId: string): string {
    return variable.picklistValues?.find(p => p.id === valueId)?.label ?? '';
  }

  getPicklistColor(variable: MapVariable, valueId: string): string | null {
    if (!valueId) return null;
    return variable.picklistValues?.find(p => p.id === valueId)?.color ?? null;
  }

  tintColorableVariables(): MapVariable[] {
    return this.variables.filter(v => v.dataType === 'PICKLIST' && v.showColorOnCells);
  }

  setActiveTint(variableId: string | null): void {
    this.activeTintVariableId = variableId;
    this.render();
  }

  private drawCellTints(imageBounds: { x: number; y: number; width: number; height: number }): void {
    if (!this.activeTintVariableId) return;
    const variable = this.variables.find(v => v.id === this.activeTintVariableId);
    if (!variable?.picklistValues?.length) return;

    const colorMap = new Map(variable.picklistValues.map(p => [p.id, p.color]));

    for (const [key, vals] of this.cellVariableValues) {
      const val = vals.find(v => v.variableId === this.activeTintVariableId);
      if (!val?.value) continue;
      const color = colorMap.get(val.value);
      if (!color) continue;

      const [rowStr, colStr] = key.split(':');
      const row = parseInt(rowStr);
      const col = parseInt(colStr);

      this.gridCtx.save();
      this.gridCtx.globalAlpha = 0.35;
      this.gridCtx.fillStyle = color;

      if (this.gridType === 'square') {
        const effectiveSize = this.gridSize * this.gridScale;
        const x = this.gridOffsetX + col * effectiveSize;
        const y = this.gridOffsetY + row * effectiveSize;
        if (x + effectiveSize < imageBounds.x || x > imageBounds.x + imageBounds.width
          || y + effectiveSize < imageBounds.y || y > imageBounds.y + imageBounds.height) {
          this.gridCtx.restore();
          continue;
        }
        this.gridCtx.fillRect(x, y, effectiveSize, effectiveSize);
      } else {
        const size = this.gridSize * this.gridScale;
        let centerX: number, centerY: number, rotation: number;
        if (this.hexOrientation === 'flat') {
          const width = size * 2;
          const height = Math.sqrt(3) * size;
          const yOffset = col % 2 === 0 ? 0 : height / 2;
          centerX = this.gridOffsetX + col * (width * 0.75) + size;
          centerY = this.gridOffsetY + row * height + height / 2 + yOffset;
          rotation = 0;
        } else {
          const width = Math.sqrt(3) * size;
          const height = size * 2;
          const xOffset = row % 2 === 0 ? 0 : width / 2;
          centerX = this.gridOffsetX + col * width + width / 2 + xOffset;
          centerY = this.gridOffsetY + row * (height * 0.75) + size;
          rotation = 30;
        }
        this.gridCtx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i + (rotation * Math.PI / 180);
          const px = centerX + size * Math.cos(angle);
          const py = centerY + size * Math.sin(angle);
          if (i === 0) this.gridCtx.moveTo(px, py);
          else this.gridCtx.lineTo(px, py);
        }
        this.gridCtx.closePath();
        this.gridCtx.fill();
      }
      this.gridCtx.restore();
    }
  }
}
