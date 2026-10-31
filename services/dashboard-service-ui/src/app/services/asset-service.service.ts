import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private readonly baseUrl = `${environment.apiBaseUrl}:${environment.port}`;

  constructor(private readonly http: HttpClient) {}

  getAssetHierarchy(): Observable<any> {
    console.log(`${this.baseUrl}`)
    return this.http.get(`${this.baseUrl}/assets/hierarchy`).pipe(
      tap((response) => console.log('Asset hierarchy response:', response))
    );
  }

  getVaraiblesbyAssetId(assetId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/assets/${assetId}/variables`).pipe(
      tap((response) => console.log('Asset variables response:', response))
    );
  }
}
