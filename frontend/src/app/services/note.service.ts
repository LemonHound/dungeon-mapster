import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {NoteBundle} from '../models/note.model';

@Injectable({providedIn: 'root'})
export class NoteService {
  private http = inject(HttpClient);

  getCellNotes(mapId: number, row: number, col: number): Observable<NoteBundle> {
    return this.http.get<NoteBundle>(`/api/maps/${mapId}/notes/cell/${row}/${col}`);
  }

  saveCellNote(mapId: number, row: number, col: number, type: 'shared' | 'public' | 'private', content: string): Observable<void> {
    return this.http.put<void>(`/api/maps/${mapId}/notes/cell/${row}/${col}/${type}`, {content});
  }

  getMapNotes(mapId: number): Observable<NoteBundle> {
    return this.http.get<NoteBundle>(`/api/maps/${mapId}/notes/map`);
  }

  saveMapNote(mapId: number, type: 'shared' | 'public' | 'private', content: string): Observable<void> {
    return this.http.put<void>(`/api/maps/${mapId}/notes/map/${type}`, {content});
  }
}
