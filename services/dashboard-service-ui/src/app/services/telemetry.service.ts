import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MeasurementPoint {
  timestamp: string;
  value: number | boolean | string | null;
}

export interface MeasurementHistory {
  asset_variable_id: string;
  data_type: string;
  unit: string | null;
  data: MeasurementPoint[];
}

const DATA_SERVICE_BASE_URL = 'http://localhost:3001';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  constructor(private readonly http: HttpClient) {}

  getMeasurementHistory(
    assetVariableId: string,
    from: string,
    to: string
  ): Observable<MeasurementHistory> {
    const params = new HttpParams()
      .set('asset_variable_id', assetVariableId)
      .set('from', from)
      .set('to', to);

    return this.http.get<MeasurementHistory>(
      `${DATA_SERVICE_BASE_URL}/measurements`,
      { params }
    );
  }
}
