import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AssetService } from 'src/app/services/asset-service.service';
import {
  MeasurementHistory,
  TelemetryService
} from 'src/app/services/telemetry.service';

interface AssetVariableOption {
  assetVariableId: string;
  name: string;
  dataType: string;
  unit: string | null;
}

interface AssetOption {
  id: string;
  name: string;
  variables: AssetVariableOption[];
}

@Component({
  selector: 'app-telemetry',
  standalone: false,
  templateUrl: './telemetry.component.html',
  styleUrl: './telemetry.component.scss'
})
export class TelemetryComponent implements OnInit, OnDestroy {
  assets: AssetOption[] = [];
  variables: AssetVariableOption[] = [];
  selectedAssetId: string | null = null;
  selectedVariableIds: string[] = [];
  historyStart: Date | null = null;
  historyEnd: Date | null = null;

  isLoadingAssets = false;
  isLoadingHistory = false;
  errorMessage = '';

  private historyRequest?: Subscription;

  readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        title: { display: true, text: 'Time' },
        grid: { display: false }
      },
      y: {
        title: { display: true, text: 'Value' }
      }
    }
  };

  chartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  private readonly lineColors = [
    '#22C55E', '#3B82F6', '#F97316', '#A855F7',
    '#EF4444', '#14B8A6', '#EAB308', '#EC4899'
  ];

  constructor(
    private readonly assetService: AssetService,
    private readonly telemetryService: TelemetryService
  ) {}

  get isLoadDisabled(): boolean {
    return !this.selectedAssetId
      || this.selectedVariableIds.length === 0
      || !this.historyStart
      || !this.historyEnd
      || this.isLoadingHistory;
  }

  ngOnInit(): void {
    this.isLoadingAssets = true;
    this.assetService.getAssetHierarchy().subscribe({
      next: (response) => {
        const roots = Array.isArray(response) ? response : response?.roots;
        this.assets = Array.isArray(roots) ? this.flattenAssets(roots) : [];
        this.isLoadingAssets = false;
      },
      error: (error: unknown) => {
        console.error('Failed to load asset hierarchy for telemetry:', error);
        this.errorMessage = 'Unable to load assets.';
        this.isLoadingAssets = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.historyRequest?.unsubscribe();
  }

  onAssetChange(assetId: string | null): void {
    this.historyRequest?.unsubscribe();
    this.isLoadingHistory = false;
    this.selectedAssetId = assetId;
    this.variables = this.assets.find(asset => asset.id === assetId)?.variables ?? [];
    this.selectedVariableIds = [];
    this.errorMessage = '';
    this.clearChart();
  }

  onVariablesChange(): void {
    this.historyRequest?.unsubscribe();
    this.isLoadingHistory = false;
    this.errorMessage = '';
    this.clearChart();
  }

  loadHistory(): void {
    const from = this.historyStart;
    const to = this.historyEnd;

    if (
      !this.selectedAssetId ||
      this.selectedVariableIds.length === 0 ||
      !from ||
      !to
    ) {
      return;
    }

    if (from.getTime() > to.getTime()) {
      this.errorMessage = 'The start time must be earlier than the end time.';
      return;
    }

    this.historyRequest?.unsubscribe();
    this.errorMessage = '';
    this.isLoadingHistory = true;
    const failedVariableNames: string[] = [];

    const requests = this.selectedVariableIds.map(assetVariableId =>
      this.telemetryService.getMeasurementHistory(
        assetVariableId,
        from.toISOString(),
        to.toISOString()
      ).pipe(
        catchError((error: unknown) => {
          console.error(`Failed to load telemetry for ${assetVariableId}:`, error);
          failedVariableNames.push(
            this.variables.find(option => option.assetVariableId === assetVariableId)?.name
              ?? assetVariableId
          );
          return of({
            asset_variable_id: assetVariableId,
            data_type: '',
            unit: null,
            data: []
          } satisfies MeasurementHistory);
        })
      )
    );

    this.historyRequest = forkJoin(requests).subscribe({
      next: histories => {
        this.updateChart(histories);
        if (failedVariableNames.length > 0 && histories.some(history => history.data.length > 0)) {
          this.errorMessage = `Some selected variables could not be loaded: ${failedVariableNames.join(', ')}.`;
        } else if (failedVariableNames.length > 0) {
          this.errorMessage = `Unable to load telemetry for: ${failedVariableNames.join(', ')}.`;
        } else if (histories.every(history => history.data.length === 0)) {
          this.errorMessage = 'No telemetry readings were found for this range.';
        }
        this.isLoadingHistory = false;
      },
      error: (error: unknown) => {
        console.error('Failed to load telemetry history:', error);
        this.errorMessage = 'Unable to load telemetry history. Please try again.';
        this.isLoadingHistory = false;
      }
    });
  }

  private flattenAssets(nodes: any[]): AssetOption[] {
    return nodes.reduce((result: AssetOption[], node) => {
      const asset = node?.data && typeof node.data === 'object' ? node.data : node;
      if (asset?.id) {
        const variables = Array.isArray(asset.variables)
          ? asset.variables
              .map((variable: any) => ({
                assetVariableId: variable?.assetVariableId ?? variable?.id,
                name: variable?.name ?? variable?.label ?? 'Unnamed variable',
                dataType: variable?.dataType ?? '',
                unit: variable?.unit ?? null
              }))
              .filter((variable: AssetVariableOption) => Boolean(variable.assetVariableId))
          : [];
        result.push({ id: asset.id, name: asset.name, variables });
      }
      if (Array.isArray(node?.children)) {
        result.push(...this.flattenAssets(node.children));
      }
      return result;
    }, []);
  }

  private updateChart(histories: MeasurementHistory[]): void {
    const timestamps = [...new Set(
      histories.flatMap(history => history.data.map(point => point.timestamp))
    )].sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

    this.chartData = {
      labels: timestamps.map(timestamp => this.formatTimestamp(timestamp)),
      datasets: histories.map((history, index) => {
        const variable = this.variables.find(
          option => option.assetVariableId === history.asset_variable_id
        );
        const readings = new Map(history.data.map(point => [
          point.timestamp,
          this.numericValue(point.value)
        ]));
        const color = this.lineColors[index % this.lineColors.length];
        const name = variable?.name ?? history.asset_variable_id;

        return {
          label: `${name}${history.unit ? ` (${history.unit})` : ''}`,
          data: timestamps.map(timestamp => readings.get(timestamp) ?? null),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0,
          spanGaps: false
        };
      })
    };
  }

  private numericValue(value: number | boolean | string | null): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string' && value.trim() !== '') {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    }
    return null;
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? timestamp
      : date.toLocaleString([], {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
  }

  private clearChart(): void {
    this.chartData = { labels: [], datasets: [] };
  }
}
