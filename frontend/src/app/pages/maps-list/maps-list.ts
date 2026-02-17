import {Component, OnInit, inject} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {FormsModule} from '@angular/forms';
import { Router } from '@angular/router';
import {MapService, DungeonMap, MapMembership} from '../../services/map';
import {AuthService} from '../../services/auth.service';
import {environment} from '../../config/environment';
import {forkJoin} from 'rxjs';

@Component({
  selector: 'app-maps-list',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, FormsModule],
  templateUrl: './maps-list.html',
  styleUrl: './maps-list.css'
})
export class MapsListComponent implements OnInit {
  private mapService = inject(MapService);
  private authService = inject(AuthService);
  private router = inject(Router);

  maps: DungeonMap[] = [];
  ownedMaps: DungeonMap[] = [];
  joinedMaps: DungeonMap[] = [];
  loading = true;
  joinCode = '';
  currentUserId: number | null = null;

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.id;
        this.loadMaps();
      }
    });
  }

  loadMaps(): void {
    this.mapService.getUserMaps().subscribe({
      next: (maps) => {
        const membershipRequests = maps.map(map =>
          this.mapService.getMembers(map.id!)
        );

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
          },
          error: (error) => {
            console.error('Error loading memberships:', error);
            this.loading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error loading maps:', error);
        this.loading = false;
      }
    });
  }

  getImageUrl(imageUrl: string): string {
    return `${environment.apiUrl}${imageUrl}`;
  }

  createNewMap(): void {
    this.router.navigate(['/map-editor', 'new']);
  }

  openMap(mapId: number): void {
    this.router.navigate(['/map-editor', mapId]);
  }

  deleteMap(mapId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this map?')) {
      this.mapService.deleteMap(mapId).subscribe({
        next: () => this.loadMaps(),
        error: (error) => console.error('Error deleting map:', error)
      });
    }
  }

  leaveMap(mapId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to leave this map?')) {
      this.mapService.removeMember(mapId, this.currentUserId!).subscribe({
        next: () => this.loadMaps(),
        error: (error) => console.error('Error leaving map:', error)
      });
    }
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
