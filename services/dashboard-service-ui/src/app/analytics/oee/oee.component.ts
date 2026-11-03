import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, switchMap, timer } from 'rxjs';
import { AssetService } from 'src/app/services/asset-service.service';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-oee',
  standalone: false,
  templateUrl: './oee.component.html',
  styleUrl: './oee.component.scss'
})
export class OeeComponent implements OnInit, OnDestroy {
  readonly stateOptions = [
    { label: 'LIVE', value: 'live' },
    { label: 'History', value: 'history' }
  ];

  reading! : any;

  value = 'live';
  allAssets: any[] = [];
  availableAssets: any[] = [];
  availableVariables: any[] = [];
  selectedAssetId: string | null = null;
  selectedVariableId: string | null = null;

  isConnectionEstablished: boolean = false;
  connectionLabel: string = 'Load Data';

  private readonly liveAssetNames = new Set(['ProductionLine01', 'Packager']);
  private liveConnection?: Subscription;

  constructor(
    private readonly assetService: AssetService,
    private readonly websocketService: WebsocketService
  ) {}

  get isLoadDataDisabled(): boolean {
    const hasValidAsset = this.availableAssets.some((asset) => asset.id === this.selectedAssetId);
    if (!hasValidAsset) {
      return true;
    }

    return this.value === 'history'
      && !this.availableVariables.some((variable) => variable.id === this.selectedVariableId);
  }

  ngOnInit(): void {
    this.loadAssetHierarchy();
  }

  onModeChange(mode: string): void {
    this.stopLiveConnection();
    this.value = mode;
    this.selectedAssetId = null;
    this.selectedVariableId = null;
    this.availableVariables = [];
    this.updateAvailableAssets();
  }

  onAssetChange(assetId: string | null): void {
    this.stopLiveConnection();
    this.selectedAssetId = assetId;
    this.selectedVariableId = null;
    const selectedAsset = this.allAssets.find((asset) => asset.id === assetId);
    this.availableVariables = Array.isArray(selectedAsset?.variables)
      ? selectedAsset.variables
      : [];
  }

  private loadAssetHierarchy(): void {
    this.assetService.getAssetHierarchy().subscribe({
      next: (response) => {
        const roots = Array.isArray(response) ? response : response?.roots;
        this.allAssets = Array.isArray(roots) ? this.flattenAssets(roots) : [];
        this.updateAvailableAssets();
      },
      error: (error) => {
        console.error('Failed to load asset hierarchy for OEE dashboard:', error);
        this.allAssets = [];
        this.availableAssets = [];
        this.availableVariables = [];
        this.selectedAssetId = null;
        this.selectedVariableId = null;
      }
    });
  }

  private flattenAssets(assets: any[]): any[] {
    return assets.reduce((flattened: any[], asset) => {
      // The hierarchy endpoint returns PrimeNG tree nodes. Asset fields live
      // under `data`; keep those original objects in the flat list.
      if (asset?.data && typeof asset.data === 'object') {
        flattened.push(asset.data);
      }
      if (Array.isArray(asset?.children)) {
        flattened.push(...this.flattenAssets(asset.children));
      }
      return flattened;
    }, []);
  }

  private updateAvailableAssets(): void {
    this.availableAssets = this.value === 'live'
      ? this.allAssets.filter((asset) => this.liveAssetNames.has(asset.name))
      : [...this.allAssets];
  }

  connect(): void {
    const assetId = this.selectedAssetId;
    if (!assetId) {
      return;
    }

    this.stopLiveConnection();
    this.isConnectionEstablished = true;
    this.connectionLabel = 'Connecting';

    this.liveConnection = timer(2000).pipe(
      switchMap(() => this.websocketService.connect(assetId))
    ).subscribe({
      next: (reading) => {
        this.reading = JSON.stringify(reading);
        console.log('Live OEE reading:', reading);
        this.isConnectionEstablished = false;
        this.connectionLabel = 'Connected';
      },
      error: (error: unknown) => {
        console.error('Live OEE WebSocket error:', error);
        this.isConnectionEstablished = false;
        this.connectionLabel = 'Load Data';
      },
      complete: () => {
        this.isConnectionEstablished = false;
        this.connectionLabel = 'Load Data';
      }
    });
  }

  ngOnDestroy(): void {
    this.stopLiveConnection();
  }

  private stopLiveConnection(): void {
    this.liveConnection?.unsubscribe();
    this.liveConnection = undefined;
    this.isConnectionEstablished = false;
    this.connectionLabel = 'Load Data';
  }
}
