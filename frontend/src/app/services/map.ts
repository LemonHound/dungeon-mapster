import {Injectable, inject} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface DungeonMap {
  id?: number;
  name: string;
  imageUrl?: string;
  gridType?: string;
  gridSize?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  gridRotation?: number;
  gridScale?: number;
  hexOrientation?: string;
  mapOffsetX?: number;
  mapOffsetY?: number;
  mapScale?: number;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/maps`;

  getUserMaps(): Observable<DungeonMap[]> {
    return this.http.get<DungeonMap[]>(this.apiUrl);
  }

  getMapById(id: number): Observable<DungeonMap> {
    return this.http.get<DungeonMap>(`${this.apiUrl}/${id}`);
  }

  createMap(map: DungeonMap): Observable<DungeonMap> {
    return this.http.post<DungeonMap>(this.apiUrl, map);
  }

  updateMap(id: number, map: DungeonMap): Observable<DungeonMap> {
    return this.http.put<DungeonMap>(`${this.apiUrl}/${id}`, map);
  }

  deleteMap(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${environment.apiUrl}/api/upload/image`, formData);
  }
}
