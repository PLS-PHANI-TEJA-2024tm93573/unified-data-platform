import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AssetHierarchy } from './asset-hierarchy/asset-hierarchy';
import { AssetRoutingModule } from './asset-routing.module';
import { PlottingComponent } from './plotting/plotting.component';

@NgModule({
  declarations: [AssetHierarchy, PlottingComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AssetRoutingModule,
  ],
})
export class AssetModelModule {}
