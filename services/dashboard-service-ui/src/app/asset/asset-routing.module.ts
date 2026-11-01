import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetHierarchyTableComponent } from './asset-hierarchy-table/asset-hierarchy-table.component';
import { AssetRootComponent } from './asset-root/asset-root.component';
import { AssetConfigureComponent } from './asset-configure/asset-configure.component';
import { AssetConfigureOptionsComponent } from './asset-configure-options/asset-configure-options.component';

const routes: Routes = [
  {
    path: 'asset',
    component: AssetRootComponent,
    children: [
      {
        path: 'hierarchy',
        component: AssetHierarchyTableComponent
      },
      {
        path: 'configure',
        component: AssetConfigureComponent
      },
      {
        path:'configure/:id',
        component: AssetConfigureOptionsComponent
      },
      {
        path: '**',
        redirectTo: 'hierarchy'
      },


    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AssetRoutingModule {}
