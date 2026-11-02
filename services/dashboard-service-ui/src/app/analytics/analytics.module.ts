import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';

import { AnalyticsRootComponent } from './analytics-root/analytics-root.component';
import { AnalyticsRoutingModule } from './analytics-routing.module';
import { OeeComponent } from './oee/oee.component';
import { TelemetryComponent } from './telemetry/telemetry.component';


@NgModule({
  declarations: [
    AnalyticsRootComponent,
    OeeComponent,
    TelemetryComponent
  ],
  imports: [
    CommonModule,
    DividerModule,
    CardModule,
    TabsModule,
    AnalyticsRoutingModule
  ]
})
export class AnalyticsModule { }
