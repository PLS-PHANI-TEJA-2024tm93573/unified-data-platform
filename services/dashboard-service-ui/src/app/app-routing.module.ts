import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetRootComponent } from './asset/asset-root/asset-root.component';
import { AssetModule } from './asset/asset.module';
import { AssetConfigureComponent } from './asset/asset-configure/asset-configure.component';

const routes: Routes = [
  { path: '', redirectTo: '/asset/hierarchy', pathMatch: 'full' },
  {
    path: 'asset',
    loadChildren: () => import('./asset/asset.module').then((mod) => mod.AssetModule),
  },
  { path: '**', redirectTo: '/asset/' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes), AssetModule],
  exports: [RouterModule]
})
export class AppRoutingModule {}
