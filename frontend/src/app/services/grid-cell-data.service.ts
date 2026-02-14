import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../config/environment';

export interface GridCellData {
  id?: number;
  mapId: number;
  rowIndex: number;
  colIndex: number;
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GridCellDataService {
  private apiUrl = `${environment.apiUrl}/api/grid-cells`;

  constructor(private http: HttpClient) {
  }

  getCell(mapId: number, row: number, col: number): Observable<GridCellData> {
    return this.http.get<GridCellData>(`${this.apiUrl}/${mapId}/${row}/${col}`);
  }

  saveCell(mapId: number, row: number, col: number, name: string): Observable<GridCellData> {
    return this.http.post<GridCellData>(`${this.apiUrl}/${mapId}/${row}/${col}`, {name});
  }
}
