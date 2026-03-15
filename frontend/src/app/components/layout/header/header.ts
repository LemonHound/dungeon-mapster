import {Component, OnInit, OnDestroy, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterModule} from '@angular/router';
import {AuthService, User} from '../../../services/auth.service';
import {EditorActionsService} from '../../../services/editor-actions.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private editorActionsService = inject(EditorActionsService);

  currentUser: User | null = null;
  showDmAdmin = false;
  dmAdminActive = false;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.authService.currentUser$.subscribe((user: User | null) => {
        this.currentUser = user;
      }),
      this.editorActionsService.dmAdminVisible.subscribe(v => {
        this.showDmAdmin = v;
      }),
      this.editorActionsService.dmAdminActive.subscribe(v => {
        this.dmAdminActive = v;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  getInitials(): string {
    if (!this.currentUser?.name) return '?';
    return this.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  onDmAdminClick(): void {
    this.editorActionsService.emitDmAdminClicked();
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
