import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OeeReading } from './websocket.service';

const KPI_SERVICE_BASE_URL = 'http://localhost:8000';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private readonly http: HttpClient) {}

  getOeeHistory(
    assetId: string,
    start: string,
    end: string
  ): Observable<OeeReading[]> {
    const params = new HttpParams()
      .set('start', start)
      .set('end', end);

    return this.http.get<OeeReading[]>(
      `${KPI_SERVICE_BASE_URL}/api/v1/oee/${encodeURIComponent(assetId)}/history`,
      { params }
    );
  }
}
