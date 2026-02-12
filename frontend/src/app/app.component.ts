import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {Header} from './components/layout/header/header';
import {Sidebar} from './components/layout/sidebar/sidebar';


@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, Header, Sidebar],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Dungeon Mapster';
  backendMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get('http://localhost:8080/api/test', { responseType: 'text' })
      .subscribe(response => {
        this.backendMessage = response;
      });
  }
}
