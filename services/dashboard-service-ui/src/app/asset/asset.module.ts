import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetRootComponent } from './asset-root/asset-root.component';
import { DividerModule } from 'primeng/divider';
import { TreeTableModule } from 'primeng/treetable';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { PanelModule } from 'primeng/panel'
import { MenuModule} from 'primeng/menu';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { FieldsetModule } from 'primeng/fieldset'



import { AssetHierarchyTableComponent } from './asset-hierarchy-table/asset-hierarchy-table.component';
import { ButtonModule } from 'primeng/button';
import { AssetVariableDialogComponent } from './asset-variable-dialog/asset-variable-dialog.component';
import { AssetConfigureComponent } from './asset-configure/asset-configure.component';
import { AssetRoutingModule } from './asset-routing.module';

import { AssetConfigureOptionsComponent } from './asset-configure-options/asset-configure-options.component';
import { ConfigureChildComponent } from './configure-child/configure-child.component';
import { ConfigureVariablesComponent } from './configure-variables/configure-variables.component';

@NgModule({
  declarations: [
    AssetRootComponent,
    AssetHierarchyTableComponent,
    AssetVariableDialogComponent,
    AssetConfigureComponent,
    AssetConfigureOptionsComponent,
    ConfigureChildComponent,
    ConfigureVariablesComponent
  ],
  imports: [
    CommonModule,
    DividerModule,
    TreeTableModule,
    ButtonModule,
    TableModule,
    DialogModule,
    PanelModule,
    MenuModule,
    ChipModule,
    TagModule,
    CardModule,
    FieldsetModule,
    AssetRoutingModule,
  ]
})
export class AssetModule { }
