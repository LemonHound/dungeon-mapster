import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';

@Injectable({providedIn: 'root'})
export class EditorActionsService {
  private dmAdminVisible$ = new BehaviorSubject<boolean>(false);
  private dmAdminActive$ = new BehaviorSubject<boolean>(false);
  private dmAdminClicked$ = new Subject<void>();

  readonly dmAdminVisible = this.dmAdminVisible$.asObservable();
  readonly dmAdminActive = this.dmAdminActive$.asObservable();
  readonly dmAdminClicked = this.dmAdminClicked$.asObservable();

  setDmAdminVisible(visible: boolean): void {
    this.dmAdminVisible$.next(visible);
  }

  setDmAdminActive(active: boolean): void {
    this.dmAdminActive$.next(active);
  }

  emitDmAdminClicked(): void {
    this.dmAdminClicked$.next();
  }
}
