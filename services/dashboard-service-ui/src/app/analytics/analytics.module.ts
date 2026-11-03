import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart'
import { DatePickerModule } from 'primeng/datepicker';
import { MultiSelectModule } from 'primeng/multiselect';


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
    FormsModule,
    DividerModule,
    CardModule,
    TabsModule,
    SelectModule,
    ChartModule,
    SelectButtonModule,
    ButtonModule,
    DatePickerModule,
    MultiSelectModule,

    AnalyticsRoutingModule
  ]
})
export class AnalyticsModule { }
