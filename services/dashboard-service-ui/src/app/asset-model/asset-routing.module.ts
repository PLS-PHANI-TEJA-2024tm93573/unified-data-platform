import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetHierarchy } from './asset-hierarchy/asset-hierarchy';
import { PlottingComponent } from './plotting/plotting.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'asset-hierarchy',
    pathMatch: 'full',
  },
  {
    path: 'asset-hierarchy',
    component: AssetHierarchy,
  },
  {
    path: 'plotting',
    component: PlottingComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssetRoutingModule {}
