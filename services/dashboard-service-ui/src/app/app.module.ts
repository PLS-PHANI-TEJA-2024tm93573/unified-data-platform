import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AssetModule } from './asset/asset.module';
import { SideNavigationComponent } from './side-navigation/side-navigation.component';
import { TopNavBarComponent } from './top-nav-bar/top-nav-bar.component';



import { MenubarModule } from 'primeng/menubar';
import { SidebarModule } from 'primeng/sidebar';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';

@NgModule({
  declarations: [AppComponent, SideNavigationComponent, TopNavBarComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    AssetModule,
    SidebarModule,
    MenubarModule,
    PanelMenuModule,
    ButtonModule,
    DividerModule
  ],
  providers: [
    providePrimeNG({ theme: { preset: Aura } })
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
