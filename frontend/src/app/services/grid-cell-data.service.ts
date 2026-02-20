import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

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
  private http = inject(HttpClient);
  private apiUrl = `/api/grid-cells`;


  getCell(mapId: number, row: number, col: number): Observable<GridCellData> {
    return this.http.get<GridCellData>(`${this.apiUrl}/${mapId}/${row}/${col}`);
  }

  saveCell(mapId: number, row: number, col: number, name: string): Observable<GridCellData> {
    return this.http.post<GridCellData>(`${this.apiUrl}/${mapId}/${row}/${col}`, {name});
  }
}
