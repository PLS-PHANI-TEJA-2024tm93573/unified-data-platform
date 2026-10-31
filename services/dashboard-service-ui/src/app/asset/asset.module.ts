import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetRootComponent } from './asset-root/asset-root.component';
import { DividerModule } from 'primeng/divider';
import { TreeTableModule } from 'primeng/treetable';

import { AssetHierarchyTableComponent } from './asset-hierarchy-table/asset-hierarchy-table.component';
import { ButtonModule } from 'primeng/button';



@NgModule({
  declarations: [
    AssetRootComponent,
    AssetHierarchyTableComponent
  ],
  imports: [
    CommonModule,
    DividerModule,
    TreeTableModule,
    ButtonModule
  ]
})
export class AssetModule { }
