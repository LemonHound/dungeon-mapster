import {Component, OnInit, NgZone, inject, PLATFORM_ID} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {FormsModule} from '@angular/forms';
import { Router } from '@angular/router';
import {MapService, DungeonMap} from '../../services/map';
import {AuthService} from '../../services/auth.service';
import {MapImageCacheService} from '../../services/map-image-cache.service';
import {forkJoin, filter, take, switchMap} from 'rxjs';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-maps-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './maps-list.html',
  styleUrl: './maps-list.css'
})
export class MapsListComponent implements OnInit {
  private mapService = inject(MapService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cacheService = inject(MapImageCacheService);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  blobUrls: Record<number, string> = {};
  imageLoading: Record<number, boolean> = {};

  maps: DungeonMap[] = [];
  ownedMaps: DungeonMap[] = [];
  joinedMaps: DungeonMap[] = [];
  loading = true;
  joinCode = '';
  currentUserId: number | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.authService.currentUser$.pipe(
      filter(user => {
        return user !== null;
      }),
      take(1),
      switchMap(user => {
        this.currentUserId = user!.id;
        return this.mapService.getUserMaps();
      })
    ).subscribe({
      next: (maps) => {
        this.processMaps(maps);
      },
      error: (error) => {
        console.error('Error loading maps:', error);
        this.loading = false;
      }
    });
  }

  loadMaps(): void {
    this.mapService.getUserMaps().subscribe({
      next: (maps) => this.processMaps(maps),
      error: (error) => {
        console.error('Error loading maps:', error);
        this.loading = false;
      }
    });
  }

  private processMaps(maps: DungeonMap[]): void {

    if (maps.length === 0) {
      this.maps = [];
      this.ownedMaps = [];
      this.joinedMaps = [];
      this.loading = false;
      return;
    }

    const membershipRequests = maps.map(map => this.mapService.getMembers(map.id!));

    forkJoin(membershipRequests).subscribe({
      next: (membershipsArray) => {
        maps.forEach((map, index) => {
          const membership = membershipsArray[index].find(m => m.userId === this.currentUserId);
          map.userRole = membership?.role;
        });

        this.maps = maps;
        this.ownedMaps = maps.filter(m => m.userRole === 'OWNER');
        this.joinedMaps = maps.filter(m => m.userRole === 'DM' || m.userRole === 'PLAYER');
        this.loading = false;

        const validUrls = maps.filter(m => m.imageUrl).map(m => m.imageUrl!);
        this.cacheService.sweep(validUrls);

        this.maps.forEach(map => this.loadImage(map));
      },
      error: (error) => {
        console.error('Error loading memberships:', error);
        this.loading = false;
      }
    });
  }

  async loadImage(map: DungeonMap): Promise<void> {

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!map.imageUrl) {
      return;
    }
    if (this.blobUrls[map.id!]) {
      return;
    }

    this.zone.run(() => {
      this.imageLoading = {...this.imageLoading, [map.id!]: true};
    });
    const cached = await this.cacheService.get(map.imageUrl);
    if (cached) {
      if (cached.size > 0) {
        this.zone.run(() => {
          this.blobUrls = {...this.blobUrls, [map.id!]: URL.createObjectURL(cached)};
          this.imageLoading = {...this.imageLoading, [map.id!]: false};
        });
        return;
      }
      await this.cacheService.evict(map.imageUrl);
    }
    this.http.get(`/api/upload/image/${map.imageUrl}`, {responseType: 'blob'}).subscribe({
      next: async (blob) => {
        await this.cacheService.put(map.imageUrl!, blob);
        this.zone.run(() => {
          this.blobUrls = {...this.blobUrls, [map.id!]: URL.createObjectURL(blob)};
          this.imageLoading = {...this.imageLoading, [map.id!]: false};
        });
      },
      error: (e) => {
        console.error('Image failed to load:', e);
        this.zone.run(() => {
          this.imageLoading = {...this.imageLoading, [map.id!]: false};
        });
      }
    });
  }

  createNewMap(): void {
    this.router.navigate(['/map-editor', 'new']);
  }

  openMap(mapId: number): void {
    this.router.navigate(['/map-editor', mapId]);
  }

  deleteMap(mapId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this map?'))
      this.mapService.deleteMap(mapId).subscribe({
        next: () => {
          this.maps = this.maps.filter(m => m.id !== mapId);
          this.ownedMaps = this.ownedMaps.filter(m => m.id !== mapId);
          this.joinedMaps = this.joinedMaps.filter(m => m.id !== mapId);
          if (this.blobUrls[mapId]) {
            URL.revokeObjectURL(this.blobUrls[mapId]);
            const {[mapId]: _, ...rest} = this.blobUrls;
            this.blobUrls = rest;
          }
        },
        error: (error) => console.error('Error deleting map:', error)
      });
  }

  leaveMap(mapId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to leave this map?'))
      this.mapService.removeMember(mapId, this.currentUserId!).subscribe({
        next: () => {
          this.maps = this.maps.filter(m => m.id !== mapId);
          this.joinedMaps = this.joinedMaps.filter(m => m.id !== mapId);
          if (this.blobUrls[mapId]) {
            URL.revokeObjectURL(this.blobUrls[mapId]);
            const {[mapId]: _, ...rest} = this.blobUrls;
            this.blobUrls = rest;
          }
        },
        error: (error) => console.error('Error leaving map:', error)
      });
  }

  joinMapByCode(): void {
    if (!this.joinCode.trim()) return;
    this.mapService.joinMap(this.joinCode).subscribe({
      next: (map) => {
        this.joinCode = '';
        this.router.navigate(['/map-editor', map.id]);
      },
      error: (error) => {
        console.error('Error joining map:', error);
        alert('Invalid join code or you are already a member of this map.');
      }
    });
  }
}
