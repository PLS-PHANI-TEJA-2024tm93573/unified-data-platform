import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface Metric {
  label: string;
  value: string;
  change: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class DashboardComponent {
  readonly pageTitle = signal('Dashboard');
  readonly metrics = signal<Metric[]>([
    { label: 'Assets', value: '128', change: '+12.4%' },
    { label: 'Alerts', value: '09', change: '-2.1%' },
    { label: 'Uptime', value: '99.9%', change: '+0.6%' },
    { label: 'Events', value: '24.3K', change: '+8.0%' },
  ]);

  readonly activeMetric = signal('Assets');

  readonly selectedMetric = computed(
    () =>
      this.metrics().find((metric) => metric.label === this.activeMetric()) ??
      this.metrics()[0],
  );

  setActiveMetric(label: string): void {
    this.activeMetric.set(label);
  }
}
