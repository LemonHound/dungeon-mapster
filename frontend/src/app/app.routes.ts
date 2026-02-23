import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { MapsListComponent } from './pages/maps-list/maps-list';
import { MapEditor } from './pages/map-editor/map-editor';
import {AuthCallbackComponent} from './components/auth-callback/callback.component';
import { authGuard } from './guards/auth.guard';
import {JoinMapComponent} from './pages/join-map/join-map';
import {DemoMapEditor} from './pages/demo-map-editor/demo-map-editor';

export const routes: Routes = [
  { path: '', component: Home },
  {path: 'demo', component: DemoMapEditor},
  { path: 'maps', component: MapsListComponent, canActivate: [authGuard] },
  {path: 'map-editor/:id', component: MapEditor, canActivate: [authGuard]},
  { path: 'auth/callback', component: AuthCallbackComponent },
  {path: 'join/:joinCode', component: JoinMapComponent, canActivate: [authGuard]},

  // always last - catch-all that routes to the home page.
  { path: '**', redirectTo: '' },
];
