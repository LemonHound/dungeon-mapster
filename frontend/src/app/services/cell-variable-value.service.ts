import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CellVariableValue} from '../models/map-variable.model';

@Injectable({providedIn: 'root'})
export class CellVariableValueService {
  private http = inject(HttpClient);

  private baseUrl(mapId: number, row: number, col: number): string {
    return `/api/maps/${mapId}/cells/${row}/${col}/variable-values`;
  }

  getValues(mapId: number, row: number, col: number): Observable<CellVariableValue[]> {
    return this.http.get<CellVariableValue[]>(this.baseUrl(mapId, row, col));
  }

  setValue(mapId: number, row: number, col: number, variableId: string, value: string): Observable<CellVariableValue> {
    return this.http.put<CellVariableValue>(`${this.baseUrl(mapId, row, col)}/${variableId}`, {value});
  }

  clearValue(mapId: number, row: number, col: number, variableId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(mapId, row, col)}/${variableId}`);
  }
}
