import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
  menuItemToggle: boolean = false;

  topNavItems: MenuItem[] = [];
  navItems: MenuItem[] = [];

  constructor(private router: Router){

  }

  ngOnInit(): void {
    this.topNavItems = [
      { label: 'Alerts', icon: 'pi pi-bell' }
    ];

    this.navItems = [
      { 
        label: 'Home', 
        icon: 'pi pi-home', 
        routerLink: '/home' 
      },
      { 
        label: 'Assets', 
        icon: 'pi pi-sitemap',
        items: [
          {
            label: 'Hierarchy',
            icon: 'pi pi-sitemap',
            routerLink: '/assets/hierarchy'
          },
          {
            label: 'Configure',
            icon: 'pi pi-cog',
            routerLink: '/assets/configure'
          }
        ]
      },
      { 
        label: 'Analytics', 
        icon: 'pi pi-chart-line', 
        routerLink: '/analytics' 
      },
      { 
        label: 'Settings', 
        icon: 'pi pi-cog', 
        routerLink: '/settings' 
      }
    ];
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  navigateTo(item: any){
    console.log(item)
    if(!item.items) {
      this.router.navigate([item.routerLink])
    }
  }

  toggleMenuItem(item:any){
    this.menuItemToggle = !this.menuItemToggle
    console.log(item)
  }
}
