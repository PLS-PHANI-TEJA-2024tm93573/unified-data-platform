import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetRootComponent } from './asset-root/asset-root.component';
import { DividerModule } from 'primeng/divider';
import { TreeTableModule } from 'primeng/treetable';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';

import { AssetHierarchyTableComponent } from './asset-hierarchy-table/asset-hierarchy-table.component';
import { ButtonModule } from 'primeng/button';
import { AssetVariableDialogComponent } from './asset-variable-dialog/asset-variable-dialog.component';



@NgModule({
  declarations: [
    AssetRootComponent,
    AssetHierarchyTableComponent,
    AssetVariableDialogComponent
  ],
  imports: [
    CommonModule,
    DividerModule,
    TreeTableModule,
    ButtonModule,
    TableModule,
    DialogModule
  ]
})
export class AssetModule { }
