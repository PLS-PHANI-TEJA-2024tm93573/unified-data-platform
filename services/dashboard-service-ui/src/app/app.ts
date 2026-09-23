import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class App {
  protected readonly title = signal('Dashboard Service UI');
  protected readonly sidebarCollapsed = signal(true);

  protected expandSidebar(): void {
    this.sidebarCollapsed.set(false);
  }

  protected collapseSidebar(): void {
    this.sidebarCollapsed.set(true);
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
  }
}
