import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetRootComponent } from './asset/asset-root/asset-root.component';
import { AssetModule } from './asset/asset.module';

const routes: Routes = [
  { path: '', redirectTo: '/asset/hierarchy', pathMatch: 'full' },
  {
    path: 'asset',
    children: [
      { path: 'hierarchy', component: AssetRootComponent }
    ]
  },
  { path: '**', redirectTo: '/asset/hierarchy' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes), AssetModule],
  exports: [RouterModule]
})
export class AppRoutingModule {}
