
import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import {
  Subscription,
  switchMap,
  timer
} from 'rxjs';

import { AssetService } from 'src/app/services/asset-service.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

import {
  OeeReading,
  WebsocketService
} from 'src/app/services/websocket.service';

import {
  ChartData,
  ChartOptions,
  Plugin
} from 'chart.js';

import { UIChart } from 'primeng/chart';

@Component({
  selector: 'app-oee',
  standalone: false,
  templateUrl: './oee.component.html',
  styleUrl: './oee.component.scss'
})
export class OeeComponent implements OnInit, OnDestroy {

  // --------------------------------------------------
  // Chart references
  // --------------------------------------------------

  @ViewChild('availabilityChart') availabilityChart!: UIChart;
  @ViewChild('performanceChart') performanceChart!: UIChart;
  @ViewChild('qualityChart') qualityChart!: UIChart;

  // --------------------------------------------------
  // Configuration
  // --------------------------------------------------

  private readonly oeeWindowSize = 60;

  readonly stateOptions = [
    { label: 'LIVE', value: 'live' },
    { label: 'History', value: 'history' }
  ];

  // --------------------------------------------------
  // KPI values
  // --------------------------------------------------

  availability = 92.5;
  performance = 87.2;
  quality = 98.1;
  oee = 79.2;

  reading?: OeeReading;

  // --------------------------------------------------
  // Centre percentage plugin
  // --------------------------------------------------

  readonly centerTextPlugin: Plugin<'doughnut'> = {
    id: 'centerText',

    afterDraw: (chart) => {

      const value = Number(
        chart.data.datasets[0]?.data[0] ?? 0
      );

      const { ctx, chartArea } = chart;

      if (!chartArea) {
        return;
      }

      const centerX =
        (chartArea.left + chartArea.right) / 2;

      const centerY =
        (chartArea.top + chartArea.bottom) / 2;

      ctx.save();

      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillText(
        `${value.toFixed(1)}%`,
        centerX,
        centerY
      );

      ctx.restore();
    }
  };

  readonly gaugePlugins: Plugin<'doughnut'>[] = [
    this.centerTextPlugin
  ];

  // --------------------------------------------------
  // Gauge chart options
  // --------------------------------------------------

  gaugeOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,

    cutout: '75%',

    animation: false,

    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    }
  };

  // --------------------------------------------------
  // Gauge chart data
  // --------------------------------------------------

  availabilityData: ChartData<'doughnut'> =
    this.createKpiChart(this.availability, '#22C55E');

  performanceData: ChartData<'doughnut'> =
    this.createKpiChart(this.performance, '#3B82F6');

  qualityData: ChartData<'doughnut'> =
    this.createKpiChart(this.quality, '#14B8A6');

  createKpiChart(
    value: number,
    color: string
  ): ChartData<'doughnut'> {

    return {
      labels: ['Achieved', 'Remaining'],

      datasets: [
        {
          data: [value, 100 - value],

          backgroundColor: [
            color,
            '#E5E7EB'
          ],

          borderWidth: 0,
          hoverOffset: 0
        }
      ]
    };
  }

  // --------------------------------------------------
  // Update existing gauge instances
  // --------------------------------------------------

  private updateGauge(
    chartComponent: UIChart | undefined,
    value: number
  ): void {

    if (!chartComponent?.chart) {
      return;
    }

    const chart = chartComponent.chart;

    chart.data.datasets[0].data = [
      value,
      100 - value
    ];

    // Update without animation or chart recreation
    chart.update('none');
  }

  private updateKpiCharts(): void {

    this.updateGauge(
      this.availabilityChart,
      this.availability
    );

    this.updateGauge(
      this.performanceChart,
      this.performance
    );

    this.updateGauge(
      this.qualityChart,
      this.quality
    );
  }

  // --------------------------------------------------
  // OEE line chart
  // --------------------------------------------------

  oeeChartData: ChartData<'line'> = {

    labels: [],

    datasets: [
      {
        label: 'OEE',

        data: [],

        borderColor: '#22C55E',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',

        borderWidth: 2,

        pointRadius: 2,
        pointHoverRadius: 5,

        tension: 0,
        fill: false
      }
    ]
  };

  oeeChartOptions: ChartOptions<'line'> = {

    responsive: true,
    maintainAspectRatio: false,

    animation: false,

    interaction: {
      intersect: false,
      mode: 'index'
    },

    plugins: {
      legend: {
        display: false
      },

      tooltip: {
        enabled: true
      }
    },

    scales: {

      x: {
        title: {
          display: true,
          text: 'Time'
        },

        grid: {
          display: false
        }
      },

      y: {
        min: 0,
        max: 100,

        title: {
          display: true,
          text: 'OEE (%)'
        },

        ticks: {
          callback: (value) => `${value}%`
        }
      }
    }
  };

  // --------------------------------------------------
  // Asset selection
  // --------------------------------------------------

  value = 'live';

  allAssets: any[] = [];
  availableAssets: any[] = [];
  availableVariables: any[] = [];

  selectedAssetId: string | null = null;
  selectedVariableId: string | null = null;
  historyStart: Date | null = null;
  historyEnd: Date | null = null;
  historyError = '';
  isHistoryLoading = false;

  private readonly liveAssetNames = new Set([
    'ProductionLine01',
    'Packager'
  ]);

  // --------------------------------------------------
  // WebSocket connection
  // --------------------------------------------------

  isConnectionEstablished = false;
  connectionLabel = 'Load Data';

  private liveConnection?: Subscription;
  private historyRequest?: Subscription;

  constructor(
    private readonly assetService: AssetService,
    private readonly websocketService: WebsocketService,
    private readonly analyticsService: AnalyticsService
  ) {}

  get isLoadDataDisabled(): boolean {

    const hasValidAsset = this.availableAssets.some(
      asset => asset.id === this.selectedAssetId
    );

    if (!hasValidAsset) {
      return true;
    }

    return this.value === 'history'
      && (!this.historyStart || !this.historyEnd || this.isHistoryLoading);
  }

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnInit(): void {
    this.loadAssetHierarchy();
  }

  ngOnDestroy(): void {
    this.stopLiveConnection();
    this.historyRequest?.unsubscribe();
  }

  // --------------------------------------------------
  // Asset hierarchy
  // --------------------------------------------------

  private loadAssetHierarchy(): void {

    this.assetService.getAssetHierarchy().subscribe({

      next: (response) => {

        const roots = Array.isArray(response)
          ? response
          : response?.roots;

        this.allAssets = Array.isArray(roots)
          ? this.flattenAssets(roots)
          : [];

        this.updateAvailableAssets();
      },

      error: (error) => {

        console.error(
          'Failed to load asset hierarchy:',
          error
        );

        this.allAssets = [];
        this.availableAssets = [];
        this.availableVariables = [];

        this.selectedAssetId = null;
        this.selectedVariableId = null;
      }
    });
  }

  private flattenAssets(assets: any[]): any[] {

    return assets.reduce(
      (flattened: any[], asset) => {

        // Support both plain API hierarchy nodes and
        // PrimeNG TreeNode-style objects.
        const assetData =
          asset?.data && typeof asset.data === 'object'
            ? asset.data
            : asset;

        if (assetData?.id) {
          flattened.push(assetData);
        }

        if (Array.isArray(asset?.children)) {
          flattened.push(
            ...this.flattenAssets(asset.children)
          );
        }

        return flattened;
      },
      []
    );
  }

  private updateAvailableAssets(): void {

    this.availableAssets = this.allAssets.filter(
      asset => this.liveAssetNames.has(asset.name)
    );
  }

  // --------------------------------------------------
  // Asset selection handlers
  // --------------------------------------------------

  onModeChange(mode: string): void {

    this.stopLiveConnection();
    this.historyRequest?.unsubscribe();
    this.historyRequest = undefined;

    // Changing to History must close the live WebSocket immediately.
    this.historyError = '';
    this.isHistoryLoading = false;

    this.value = mode;
    this.connectionLabel = mode === 'history' ? 'Load History' : 'Load Data';

    this.selectedAssetId = null;
    this.selectedVariableId = null;

    this.availableVariables = [];
    this.historyStart = null;
    this.historyEnd = null;

    this.updateAvailableAssets();
  }

  onAssetChange(assetId: string | null): void {

    this.stopLiveConnection();
    this.historyRequest?.unsubscribe();
    this.historyRequest = undefined;
    this.isHistoryLoading = false;
    this.historyError = '';

    this.selectedAssetId = assetId;
    this.selectedVariableId = null;

    const selectedAsset = this.allAssets.find(
      asset => asset.id === assetId
    );

    this.availableVariables =
      Array.isArray(selectedAsset?.variables)
        ? selectedAsset.variables
        : [];
  }

  // --------------------------------------------------
  // WebSocket connection
  // --------------------------------------------------

  connect(): void {

    if (this.value === 'history') {
      this.loadHistory();
      return;
    }

    const assetId = this.selectedAssetId;

    if (!assetId) {
      return;
    }

    this.stopLiveConnection();

    this.isConnectionEstablished = true;
    this.connectionLabel = 'Connecting';

    this.liveConnection = timer(2000)
      .pipe(
        switchMap(() =>
          this.websocketService.connect(assetId)
        )
      )
      .subscribe({

        next: (reading) => {

          this.reading = reading;

          this.applyReading(reading);

          console.log('Live OEE reading:', reading);

          this.isConnectionEstablished = false;
          this.connectionLabel = 'Connected';
        },

        error: (error: unknown) => {

          console.error(
            'Live OEE WebSocket error:',
            error
          );

          this.isConnectionEstablished = false;
          this.connectionLabel = 'Load Data';
        },

        complete: () => {

          this.isConnectionEstablished = false;
          this.connectionLabel = 'Load Data';
        }
      });
  }

  private loadHistory(): void {
    // Ensure no live stream remains active while viewing historical data.
    this.stopLiveConnection();

    const assetId = this.selectedAssetId;
    const start = this.historyStart;
    const end = this.historyEnd;

    if (!assetId || !start || !end) {
      return;
    }

    if (start.getTime() > end.getTime()) {
      this.historyError = 'The start time must be earlier than the end time.';
      return;
    }

    this.historyError = '';
    this.isHistoryLoading = true;
    this.connectionLabel = 'Loading History';

    this.historyRequest?.unsubscribe();
    this.historyRequest = this.analyticsService.getOeeHistory(
      assetId,
      start.toISOString(),
      end.toISOString()
    ).subscribe({
      next: (readings) => {
        const history = Array.isArray(readings)
          ? [...readings].sort(
              (left, right) =>
                new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
            )
          : [];

        const latestReading = history[history.length - 1];
        if (latestReading) {
          this.reading = latestReading;
          this.applyReading(latestReading);
        }

        const validReadings = history
          .filter(reading => this.validPercentage(reading.oee_percent) !== undefined);
        this.oeeChartData = {
          ...this.oeeChartData,
          labels: validReadings.map(reading => this.formatHistoryTimestamp(reading.timestamp)),
          datasets: this.oeeChartData.datasets.map((dataset, index) =>
            index === 0
              ? {
                  ...dataset,
                  data: validReadings.map(reading => this.validPercentage(reading.oee_percent) as number)
                }
              : dataset
          )
        };

        this.isHistoryLoading = false;
        this.connectionLabel = 'Load History';
      },
      error: (error: unknown) => {
        console.error('Failed to load OEE history:', error);
        this.historyError = 'Unable to load OEE history. Please try again.';
        this.isHistoryLoading = false;
        this.connectionLabel = 'Load History';
      }
    });
  }

  // --------------------------------------------------
  // Apply incoming KPI reading
  // --------------------------------------------------

  private applyReading(reading: OeeReading): void {

    const availability = this.validPercentage(
      reading.availability_percent
    );

    const performance = this.validPercentage(
      reading.performance_percent
    );

    const quality = this.validPercentage(
      reading.quality_percent
    );

    const oee = this.validPercentage(
      reading.oee_percent
    );

    if (availability !== undefined) {
      this.availability = availability;
    }

    if (performance !== undefined) {
      this.performance = performance;
    }

    if (quality !== undefined) {
      this.quality = quality;
    }

    // Update only the existing gauge instances.
    if (
      availability !== undefined ||
      performance !== undefined ||
      quality !== undefined
    ) {
      this.updateKpiCharts();
    }

    if (oee !== undefined) {

      this.oee = oee;

      this.appendOeePoint(
        reading.timestamp,
        oee
      );
    }
  }

  private validPercentage(
    value: number | null | undefined
  ): number | undefined {

    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : undefined;
  }

  // --------------------------------------------------
  // OEE time-series update
  // --------------------------------------------------

  private appendOeePoint(
    timestamp: string,
    value: number
  ): void {

    const labels = [
      ...(this.oeeChartData.labels ?? []),
      this.formatTimestamp(timestamp)
    ].slice(-this.oeeWindowSize);

    const data = [
      ...(this.oeeChartData.datasets[0].data as number[]),
      value
    ].slice(-this.oeeWindowSize);

    this.oeeChartData = {

      ...this.oeeChartData,

      labels,

      datasets: this.oeeChartData.datasets.map(
        (dataset, index) =>
          index === 0
            ? { ...dataset, data }
            : dataset
      )
    };
  }

  private formatTimestamp(timestamp: string): string {

    const date = new Date(timestamp);

    return Number.isNaN(date.getTime())
      ? timestamp
      : date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
  }

  private formatHistoryTimestamp(timestamp: string): string {
    const date = new Date(timestamp);

    return Number.isNaN(date.getTime())
      ? timestamp
      : date.toLocaleString([], {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
  }

  // --------------------------------------------------
  // Disconnect
  // --------------------------------------------------

  private stopLiveConnection(): void {

    this.liveConnection?.unsubscribe();

    this.liveConnection = undefined;

    this.isConnectionEstablished = false;
    this.connectionLabel = this.value === 'history' ? 'Load History' : 'Load Data';
  }
}
