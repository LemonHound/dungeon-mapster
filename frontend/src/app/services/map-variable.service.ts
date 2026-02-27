import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {MapVariable, PicklistValue, CellVariableValue} from '../models/map-variable.model';

@Injectable({providedIn: 'root'})
export class MapVariableService {
  private http = inject(HttpClient);

  private baseUrl(mapId: number): string {
    return `/api/maps/${mapId}/variables`;
  }

  getVariables(mapId: number): Observable<MapVariable[]> {
    return this.http.get<MapVariable[]>(this.baseUrl(mapId));
  }

  createVariable(mapId: number, variable: Partial<MapVariable>): Observable<MapVariable> {
    return this.http.post<MapVariable>(this.baseUrl(mapId), variable);
  }

  updateVariable(mapId: number, variableId: string, patch: Partial<MapVariable>): Observable<MapVariable> {
    return this.http.put<MapVariable>(`${this.baseUrl(mapId)}/${variableId}`, patch);
  }

  deleteVariable(mapId: number, variableId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(mapId)}/${variableId}`);
  }

  getPicklistValues(mapId: number, variableId: string): Observable<PicklistValue[]> {
    return this.http.get<PicklistValue[]>(`${this.baseUrl(mapId)}/${variableId}/picklist-values`);
  }

  addPicklistValue(mapId: number, variableId: string, label: string): Observable<PicklistValue> {
    return this.http.post<PicklistValue>(`${this.baseUrl(mapId)}/${variableId}/picklist-values`, {label});
  }

  updatePicklistValue(mapId: number, variableId: string, picklistValueId: string, label: string): Observable<PicklistValue> {
    return this.http.put<PicklistValue>(`${this.baseUrl(mapId)}/${variableId}/picklist-values/${picklistValueId}`, {label});
  }

  deletePicklistValue(mapId: number, variableId: string, picklistValueId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(mapId)}/${variableId}/picklist-values/${picklistValueId}`);
  }
}
