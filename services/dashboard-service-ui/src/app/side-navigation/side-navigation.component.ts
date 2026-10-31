import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-side-navigation',
  standalone: false,
  templateUrl: './side-navigation.component.html',
  styleUrl: './side-navigation.component.scss'
})
export class SideNavigationComponent implements OnInit {
  // Controls expanded (wide) vs collapsed (mini icon-only) state
  isCollapsed: boolean = true;

  topNavItems: MenuItem[] = [];
  navItems: MenuItem[] = [];

  ngOnInit(): void {
    this.topNavItems = [
      { label: 'Alerts', icon: 'pi pi-bell' }
    ];

    this.navItems = [
      { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/' },
      { label: 'Asset Hierarchy', icon: 'pi pi-sitemap' },
      { label: 'Analytics', icon: 'pi pi-chart-line' },
      { label: 'Settings', icon: 'pi pi-cog' }
    ];
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }
}
