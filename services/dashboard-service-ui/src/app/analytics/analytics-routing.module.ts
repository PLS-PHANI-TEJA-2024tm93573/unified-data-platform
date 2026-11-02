import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnalyticsRootComponent } from './analytics-root/analytics-root.component';
import { OeeComponent } from './oee/oee.component';
import { TelemetryComponent } from './telemetry/telemetry.component';

const routes: Routes = [
  {
    path: '',
    component: AnalyticsRootComponent,
    children: [
      {
        path: '',
        redirectTo: 'oee',
        pathMatch: 'full'
      },
      {
        path: 'oee',
        component: OeeComponent
      },
      {
        path: 'telemetry',
        component: TelemetryComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnalyticsRoutingModule {}
