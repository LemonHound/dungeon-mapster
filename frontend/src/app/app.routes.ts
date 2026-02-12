import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { MapsList } from './pages/maps-list/maps-list';
import { MapEditor } from './pages/map-editor/map-editor';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'maps', component: MapsList },
  { path: '**', redirectTo: '' },
  { path: 'map/:id', component: MapEditor }
];
