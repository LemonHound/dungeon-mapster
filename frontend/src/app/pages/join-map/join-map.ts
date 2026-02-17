import {Component, OnInit, inject} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {MapService} from '../../services/map';

@Component({
  selector: 'app-join-map',
  standalone: true,
  template: '<p>Joining map...</p>'
})
export class JoinMapComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mapService = inject(MapService);

  ngOnInit(): void {
    const joinCode = this.route.snapshot.paramMap.get('joinCode');
    if (!joinCode) {
      this.router.navigate(['/maps']);
      return;
    }

    this.mapService.joinMap(joinCode).subscribe({
      next: (map) => this.router.navigate(['/map-editor', map.id]),
      error: () => this.router.navigate(['/maps'])
    });
  }
}
