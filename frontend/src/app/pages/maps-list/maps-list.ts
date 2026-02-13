import { Component, OnInit } from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import { Router } from '@angular/router';
import { MapService, DungeonMap } from '../../services/map';
import {environment} from '../../config/environment';

@Component({
  selector: 'app-maps-list',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './maps-list.html',
  styleUrl: './maps-list.css'
})
export class MapsListComponent implements OnInit {
  maps: DungeonMap[] = [];
  loading = true;

  constructor(
    private mapService: MapService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMaps();
  }

  loadMaps(): void {
    this.mapService.getUserMaps().subscribe({
      next: (maps) => {
        this.maps = maps;
        this.loading = false;
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
}
