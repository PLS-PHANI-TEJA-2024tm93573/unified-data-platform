import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-analytics-root',
  standalone: false,
  templateUrl: './analytics-root.component.html',
  styleUrl: './analytics-root.component.scss'
})
export class AnalyticsRootComponent implements OnInit {
  activeTabValue: string = 'oee';

  constructor(private router: Router,
              private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
   // Determine initial active tab immediately from the current URL
    this.setActiveTabFromUrl(this.router.url);

    // Listen for subsequent route changes
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.setActiveTabFromUrl(event.urlAfterRedirects);
        this.cd.detectChanges(); // Ensure PrimeNG re-renders the active tab highlight
      });
  }

  private setActiveTabFromUrl(url: string) {
    if (url.includes('/telemetry')) {
      this.activeTabValue = 'telemetry';
    } else {
      this.activeTabValue = 'oee';
    }
  }
}
