import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface OeeReading {
  asset_id: string;
  timestamp: string;
  availability_percent: number | null;
  performance_percent: number | null;
  quality_percent: number | null;
  oee_percent: number | null;
  planned_production_seconds?: number | null;
  operating_seconds?: number | null;
  total_output?: number | null;
  good_output?: number | null;
  rejected_output?: number | null;
  calculation_start?: string;
  calculation_period?: 'since_start' | 'since_recovery';
}

const KPI_SERVICE_BASE_URL = 'http://localhost:8000';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  /**
   * Connect to the KPI service's live OEE stream for an asset.
   * Unsubscribing closes the underlying WebSocket connection.
   */
  connect(assetId: string): Observable<OeeReading> {
    return new Observable<OeeReading>((observer) => {
      let socket: WebSocket;

      try {
        socket = new WebSocket(this.getLiveUrl(assetId));
      } catch (error) {
        observer.error(error);
        return;
      }

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          observer.next(JSON.parse(event.data) as OeeReading);
        } catch (error) {
          observer.error(error);
          socket.close();
        }
      };

      socket.onerror = () => {
        observer.error(new Error('WebSocket connection to the KPI service failed.'));
      };

      socket.onclose = () => observer.complete();

      return () => {
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    });
  }

  private getLiveUrl(assetId: string): string {
    const serviceUrl = new URL(KPI_SERVICE_BASE_URL);
    const protocol = serviceUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const encodedAssetId = encodeURIComponent(assetId);

    return `${protocol}//${serviceUrl.host}/api/v1/oee/${encodedAssetId}/live`;
  }
}
