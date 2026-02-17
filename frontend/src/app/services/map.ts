import {Injectable, inject} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface MapMembership {
  id: number;
  mapId: number;
  userId: number;
  role: 'OWNER' | 'DM' | 'PLAYER';
}

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
  joinCode?: string;
  userRole?: 'OWNER' | 'DM' | 'PLAYER';
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

  getMapByJoinCode(joinCode: string): Observable<DungeonMap> {
    return this.http.get<DungeonMap>(`${this.apiUrl}/join/${joinCode}`);
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

  joinMap(joinCode: string): Observable<DungeonMap> {
    return this.http.post<DungeonMap>(`${this.apiUrl}/join`, {joinCode});
  }

  getMembers(mapId: number): Observable<MapMembership[]> {
    return this.http.get<MapMembership[]>(`${this.apiUrl}/${mapId}/members`);
  }

  promoteUser(mapId: number, targetUserId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${mapId}/members/${targetUserId}/promote`, {});
  }

  demoteUser(mapId: number, targetUserId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${mapId}/members/${targetUserId}/demote`, {});
  }

  transferOwnership(mapId: number, targetUserId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${mapId}/transfer`, {targetUserId});
  }

  removeMember(mapId: number, targetUserId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${mapId}/members/${targetUserId}`);
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${environment.apiUrl}/api/upload/image`, formData);
  }
}
